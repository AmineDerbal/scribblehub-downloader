import express from 'express';
import puppeteer from 'puppeteer-extra';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { convert } from 'html-to-text';
import axios from 'axios';
import path from 'path';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import { executablePath } from 'puppeteer';
import { verify } from 'crypto';

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
  const chapterS = req.body.chapterStart; // chapters will be provided as a string (e.g. "1,2,5-7")
  const chapterF = req.body.chapterFinish
  console.log('The URL:', url);
  console.log('Selected Chapters:', chapterS,chapterF);
  
  clearProgress();
  const start = parseInt(chapterS);
  const end = parseInt(chapterF);

  try {
    // Directly generate the array of chapters from chapterS to chapterF
    const selectedChapters = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    if (!selectedChapters.length) {
      throw new Error('No valid chapters selected');
    }

    // Get the download link for the series
    const downloadLink = await getSerieDownloadLink(url, selectedChapters);
    res.json(downloadLink);
  } catch (err) {
    res.json({ status: 'Error', Error: err });
  }
});

const getSerieDownloadLink = async (url, selectedChapters) => {
  try {
    const browser = await puppeteer.launch({ executablePath: executablePath() });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      'upgrade-insecure-requests': '1',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'en-US,en;q=0.9,en;q=0.8',
    });
    await page.setViewport({ width: 1280, height: 720 });
    console.log(url,selectedChapters,"in Serire") // true
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 0,
    });

    if (response.status() !== 200) {
      return {
        status: 'Error',
        Error: 'an error has occurred',
      };
    }

    // Check if the URL contains '/read/' path and handle accordingly
    let urlRead = /\/read\//;
    if (urlRead.test(url)) {
      const indexSerie = await page.$('.c_index a');
      let serieUrl = await page.evaluate((el) => el.href, indexSerie);

      console.log('The serie URL:', serieUrl);
      url = serieUrl;
    }

    // If URL contains toc path at the end (e.g., ?toc=11#content1), extract the base URL
    let serieMatch = /(https?:\/\/www.scribblehub.com\/series\/\d+\/(\w|\W)*\/)\?toc=\d/;
    if (serieMatch.test(url)) {
      url = url.match(serieMatch)[1];
    }

    // Call generatePdf with the corrected URL and selected chapters
    const linkToFile = await generatePdf(url, page, selectedChapters);
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



const generatePdf = async (url, page, selectedChapters) => {
  try {
    var doc = new PDFDocument();
    console.log("going to url")
    await page.goto(url);
    progress.serieName = await page.$eval('.fic_title', (el) => el.innerHTML);
    const sanitizedTitle = progress.serieName.replace(/[^a-zA-Z0-9 ]/g, '');
    console.log(selectedChapters[0], sanitizedTitle)

    let partCounter = Math.floor(selectedChapters[0] / 10);

    if (selectedChapters[0] === 1) {
      doc.pipe(fs.createWriteStream(`./downloads/${sanitizedTitle}.pdf`));
    } else {
      doc.pipe(fs.createWriteStream(`./downloads/${sanitizedTitle}_part${partCounter}.pdf`));
    }
    console.log("pipe added")

    // Add synopsis stuff
    if (selectedChapters[0] === 1) {
      doc.font('Times-Bold').fontSize(35).text(progress.serieName, {
        align: 'center',
      });

      doc.moveDown();

      const serieImage = await page.$eval('.fic_image img', (el) => el.src);

      const image = await fetchImage(serieImage);
      let imageWidth = 180;
      doc
        .image(image, doc.page.width / 2 - imageWidth / 2, doc.y, { width: imageWidth })
        .stroke();
      doc.moveDown(0.5);

      progress.authorName = await page.$eval('.auth_name_fic', (el) => el.textContent);
      addSerieInfoToPdf(doc, 'Author Name : ', progress.authorName);
      doc.moveDown(0.5);

      addSerieInfoToPdf(doc, 'Serie Link : ', url, 16, 'blue');
      doc.moveDown(0.5);

      progress.lastUpdate = await page.$eval('.toc_ol:first-child .fic_date_pub', (el) => el.textContent);
      addSerieInfoToPdf(doc, 'Last Update : ', progress.lastUpdate);
      doc.moveDown(0.5);

      progress.numberOfChapter = selectedChapters.length;
      addSerieInfoToPdf(doc, 'number of chapters : ', `${progress.numberOfChapter} chapters`);
      doc.moveDown(0.5);

      doc.addPage();
      addSerieInfoToPdf(
        doc,
        'SYNOPSIS : ',
        convert(await page.evaluate((el) => el.innerHTML, await page.$('.wi_fic_desc')), {
          wordwrap: 130,
        })
      );
      console.log("header content added")
    }

    // Process only the selected chapters
    let lastTocUrl = url;
    let allChapterLinks = [];  
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });

    while (
      (await page.$("a[class='page-link next']")) &&
      /\?toc/.test(await page.$eval("a[class='page-link next']", (el) => el.href))
    ) {
      const tocLinks = await page.$$eval("li[order] a", els =>
        els.map(el => ({
          href: el.href,
          order: parseInt(el.closest('li').getAttribute('order'))
        }))
      );
      allChapterLinks.push(...tocLinks);

      await page.goto(await page.$eval("a[class='page-link next']", el => el.href), {
        waitUntil: 'domcontentloaded',
        timeout: 0,
      });

      lastTocUrl = await page.$eval("a[class='current']", el => el.href);
    }

    const lastPageLinks = await page.$$eval("li[order] a", els =>
      els.map(el => ({
        href: el.href,
        order: parseInt(el.closest('li').getAttribute('order'))
      }))
    );
    allChapterLinks.push(...lastPageLinks);

    const filteredChapterLinks = allChapterLinks
      .filter(link => selectedChapters.includes(link.order))
      .sort((a, b) => a.order - b.order); // optional: ensure in order

    if (!filteredChapterLinks.length) {
      throw new Error("No matching chapters found in TOC");
    }

    // Retry logic for batch processing
    const processBatch = async (startIdx) => {
      const batchLinks = filteredChapterLinks.slice(startIdx, startIdx + 10);
      for (let i = 0; i < batchLinks.length; i++) {
        const chapterLink = batchLinks[i];
        progress.currentProgress = startIdx + i + 1;
        console.log(`Navigating to chapter ${chapterLink.order} : ${chapterLink.href}`);
      
        let retryCount = 0;
        let success = false;
      
        while (retryCount < 10 && !success) {
          try {
            await page.goto(chapterLink.href, {
              waitUntil: 'domcontentloaded',
              timeout: 0,
            });
      
            await addChapterTitle(doc, page);
            await addChapterContent(doc, page);
      
            success = true; // If everything works, set success to true to exit the loop
          } catch (err) {
            console.error(`Error at chapter ${chapterLink.order}:`, err);
            retryCount++;
      
            if (retryCount === 10) {
              const partialPath = path.join(__dirname, 'output', `partial_${Date.now()}.pdf`);
              doc.end();
              await new Promise(resolve => doc.on('end', resolve));
              throw new Error(`Error at chapter ${chapterLink.order}. Partial PDF saved at: ${partialPath}`);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log(`Retrying chapter ${chapterLink.order}... Attempt #${retryCount}`);
          }
        }
      
        if (!success) {
          console.log(`Failed to process chapter ${chapterLink.order} after 5 attempts.`);
        }
      }
  };

    for (let i = 0; i < filteredChapterLinks.length; i += 10) {
      await processBatch(i);

      // If we completed a batch of 10, prepare for the next batch
      if ((i + 10) < filteredChapterLinks.length) {
        doc.end();
        console.log("timeout")
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 60 seconds before the next batch
        partCounter = partCounter+1
        console.log("new partCounter")
        const nextFileName = `${sanitizedTitle}_part${partCounter}.pdf`;

        doc = new PDFDocument();
        console.log("new document created")
        doc.pipe(fs.createWriteStream(`./downloads/${nextFileName}`));
        doc.addPage();
      }
    }

    doc.end();

    return {
      status: 'Success',
      link: `/download/${sanitizedTitle}.pdf`,
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
