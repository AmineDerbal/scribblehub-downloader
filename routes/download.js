import express from 'express';
import puppeteer from 'puppeteer-extra';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { convert } from 'html-to-text';
import axios from 'axios';
import path from 'path';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import { executablePath } from 'puppeteer';

puppeteer.use(StealthPlugin());
const router = express.Router();
const progress = {};

const clearProgress = () => {
  progress.serieName = '';
  progress.authorName = '';
  progress.lastUpdate = '';
  progress.numberOfChapter = 0;
  progress.currentProgress = 0;
};

router.get('/', async (req, res) => {
  res.json(progress);
});

router.get('/:filename', (req, res) => {
  const filePath = path.resolve(`./downloads/${req.params.filename}`);
  res.download(filePath);
});
router.post('/', async (req, res) => {
  const url = req.body.url;
  console.log('the url', url);
  clearProgress();
  try {
    const downloadLink = await getSerieDownloadLink(url);
    res.json(downloadLink);
  } catch (err) {
    res.json({ status: 'Error', Error: err });
  }
});

const getSerieDownloadLink = async (url) => {
  try {
    const browser = await puppeteer.launch({ executablePath: executablePath() });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      'upgrade-insecure-requests': '1',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'en-US,en;q=0.9,en;q=0.8',
    });
    await page.setViewport({ width: 1280, height: 720 });

    console.log(url);
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 0,
    });

    if (response.status() != 200) {
      return {
        status: 'Error',
        Error: 'an error has occured',
      };
    }

    // if the url of given has read as a path
    let urlRead = /\/read\//;
    if (urlRead.test(url)) {
      const indexSerie = await page.$('.c_index a');
      let serieUrl = await page.evaluate((el) => el.href, indexSerie);

      console.log('the serie url', serieUrl);
      url = serieUrl;
    }
    // if url has toc path in the end eg : ?toc=11#content1
    let serieMatch = /(https?:\/\/www.scribblehub.com\/series\/\d+\/(\w|\W)*\/)\?toc=\d/;
    if (serieMatch.test(url)) {
      url = url.match(serieMatch)[1];
    }
    const linkToFile = await generatePdf(url, page);
    browser.close();
    return linkToFile;
  } catch (err) {
    console.log(err);
    return {
      status: 'Error',
      Error: err,
    };
  }
};

const generatePdf = async (url, page) => {
  try {
    // Create a document PDF
    const doc = new PDFDocument();

    await page.goto(url);
    progress.serieName = await page.$eval('.fic_title', (el) => el.innerHTML);
    console.log('the serie name', progress.serieName);

    // Pipe its output somewhere, like to a file or HTTP response
    // See below for browser usage
    doc.pipe(fs.createWriteStream(`./downloads/${progress.serieName.replace(/[^a-zA-Z0-9 ]/g, '')}.pdf`));

    // write the book infos in the PDF Document
    doc.font('Times-Bold').fontSize(35).text(progress.serieName, {
      align: 'center',
    });

    doc.moveDown();

    const serieImage = await page.$eval('.fic_image img', (el) => el.src);

    console.log('image', serieImage);
    const image = await fetchImage(serieImage);
    let imageWidth = 180;
    doc
      .image(image, doc.page.width / 2 - imageWidth / 2, doc.y, {
        width: imageWidth,
      })
      .stroke();
    doc.moveDown(0.5);
    // addImageToPdf(doc, page, serieImage);
    progress.authorName = await page.$eval('.auth_name_fic', (el) => el.textContent);
    addSerieInfoToPdf(doc, 'Author Name : ', progress.authorName);
    doc.moveDown(0.5);
    addSerieInfoToPdf(doc, 'Serie Link : ', url, 16, 'blue');
    doc.moveDown(0.5);
    addSerieInfoToPdf(doc, 'Author Link : ', await page.$eval("span[property='name'] a", (el) => el.href), 16, 'blue');
    doc.moveDown(0.5);
    progress.lastUpdate = await page.$eval('.toc_ol:first-child .fic_date_pub', (el) => el.textContent);
    addSerieInfoToPdf(doc, 'Last Update : ', progress.lastUpdate);
    doc.moveDown(0.5);
    progress.numberOfChapter = parseInt(await page.$eval('.toc_ol :first-child ', (el) => el.getAttribute('order')));
    addSerieInfoToPdf(doc, 'number of chapters : ', `${progress.numberOfChapter} chapters`);
    doc.moveDown(0.5);
    doc.addPage();
    addSerieInfoToPdf(
      doc,
      'SYNOPSIS : ',
      convert(await page.evaluate((el) => el.innerHTML, await page.$('.wi_fic_desc')), {
        wordwrap: 130,
      }),
    );

    // get the url of last table of content
    let lastTocUrl = url;
    while (
      (await page.$("a[class='page-link next']")) &&
      /\?toc/.test(await page.$eval("a[class='page-link next']", (el) => el.href))
    ) {
      await page.goto(await page.$eval("a[class='page-link next']", (el) => el.href));

      lastTocUrl = await page.$eval("a[class='current']", (el) => el.href);
    }
    // get the url of the first chapter in the book
    let firstChapterHref = await page.$eval("li[order='1'] a", (el) => el.href);

    progress.currentProgress = 1;
    console.log(`href of index ${progress.currentProgress} : ${firstChapterHref}`);

    await page.goto(firstChapterHref, {
      waitUntil: 'domcontentloaded',
      timeout: 0,
    });
    await addChapterTitle(doc, page);
    await addChapterContent(doc, page);

    while (await page.$("a[class='btn-wi btn-next']")) {
      let nextHref = await page.$eval("a[class='btn-wi btn-next']", (el) => el.href);
      await page.goto(nextHref, {
        waitUntil: 'domcontentloaded',
        timeout: 0,
      });

      progress.currentProgress++;
      console.log(`href of index ${progress.currentProgress} : ${nextHref}`);
      await addChapterTitle(doc, page);
      await addChapterContent(doc, page);
    }

    console.log('end of pdf');
    doc.end();

    return {
      status: 'Success',
      link: `http://localhost:3000/download/${progress.serieName.replace(/[^a-zA-Z0-9 ]/g, '')}.pdf`,
    };
  } catch (err) {
    return {
      status: 'Error',
      Error: err,
    };
  }
};

const fetchImage = async (src) => {
  const image = await axios.get(src, {
    responseType: 'arraybuffer',
  });
  return image.data;
};

const addSerieInfoToPdf = async (
  doc,
  boldText,
  defaultText,
  defaultFontSize = 16,
  color = 'black',
  defaultFontStyle = 'Times-Roman',
  boldFontStyle = 'Times-Bold',
) => {
  doc
    .fontSize(defaultFontSize)
    .font(boldFontStyle)
    .text(boldText, {
      continued: true,
    })
    .fillColor(color)
    .font(defaultFontStyle)
    .text(defaultText)
    .fillColor('black');
};

const addChapterTitle = async (doc, page) => {
  doc.addPage();
  doc
    .font('Times-Bold')
    .fontSize(18)
    .text(await page.$eval('.chapter-title', (el) => el.innerHTML), {
      align: 'center',
    });
};
const addChapterContent = async (doc, page) => {
  doc.moveDown();
  const content = await page.$$('#chp_raw > *');
  if (await page.$eval('#chp_raw', (el) => el.hasChildNodes())) {
    console.log('true');
  }
  for (let i = 0; i < content.length; i++) {
    const row = content[i];
    const tag = await page.evaluate((el) => el.tagName, row);

    if ((await page.evaluate((el) => el.tagName, row)) == 'IMG') {
      await addImageToPdf(doc, page, row);
    } else if (await row.$(':scope > *')) {
      let firstChild = await row.$(':scope :first-child');
      await parseHtmlContentToPdf(doc, page, row, firstChild);
    } else {
      await addTextToPdf(doc, page, row);
    }
  }
};

const addImageToPdf = async (doc, page, element) => {
  const image = await fetchImage(await page.evaluate((el) => el.src, element));
  let imageWidth = 220;
  doc.moveDown();
  doc
    .image(image, doc.page.width / 2 - imageWidth / 2, doc.y, {
      width: imageWidth,
    })
    .stroke();
  doc.moveDown(0.5);
};

const addTextToPdf = async (doc, page, element) => {
  const name = await page.evaluate((el) => el.innerHTML, element);

  doc
    .font('Times-Roman')
    .fontSize(14)
    .text(
      convert(name, {
        wordwrap: 130,
      }),
    );
  doc.moveDown(0.5);
};

const parseHtmlContentToPdf = async (doc, page, parent, firstChild) => {
  if ((await page.evaluate((el) => el.tagName, firstChild)) == 'IMG') {
    await addImageToPdf(doc, page, firstChild);
  } else {
    await addTextToPdf(doc, page, parent);
  }
};

export default router;
