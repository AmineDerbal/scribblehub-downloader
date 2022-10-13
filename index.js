import fs from "fs";
import path from "path";
import express from "express";
import puppeteer from "puppeteer";
import cors from "cors";
import PDFDocument from "pdfkit";
import { convert } from "html-to-text";
import axios from "axios";

const app = express();
const port = 3000;

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(cors());
app.use(express.json());
//app.use(newUrl);

app.get("/", (req, res) => {
  res.render("index");
});

app.post("/", async (req, res) => {
  const url = req.body.url;

  try {
    const downloadLink = await getSerieDownloadLink(url);
    res.json(downloadLink);
  } catch (err) {
    res.send(`Une erreur s'est produite: ${err}`);
  }
});
app.listen(port, () => {
  console.log(`this server is in port ${port}`);
});

const getSerieDownloadLink = async (url) => {
  return new Promise(async (resolve, reject) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const response = await page.goto(url);
    if (response.status() != 200) {
      reject(response.status());
      return;
    }

    // if the url of given has read as a path
    let urlRead = /\/read\//;
    if (urlRead.test(url)) {
      const indexSerie = await page.$(".c_index a");
      let serieUrl = await page.evaluate((el) => el.href, indexSerie);
      console.log("the serie url", serieUrl);
      url = serieUrl;
    }
    // if url has toc path in the end eg : ?toc=11#content1
    let serieMatch =
      /(https?:\/\/www.scribblehub.com\/series\/\d+\/(\w|\W)*\/)\?toc=\d/;
    if (serieMatch.test(url)) {
      url = url.match(serieMatch)[1];
    }
    const linkToFile = await generatePdf(url, page);
    // console.log("~ linkToFile", linkToFile);
    browser.close();
    if (!linkToFile) reject("Une erreur s'est produite: Pas de chapitre.");
    resolve(linkToFile);
  });
};

const generatePdf = async (url, page) => {
  try {
    // Create a document PDF
    const doc = new PDFDocument();

    // Check if downloads folder exists
    if (!fs.existsSync("downloads"))
      fs.mkdir("downloads", (err) => {
        if (err) {
          return console.error(err);
        }
      });
    await page.goto(url);
    let serieName = await page.evaluate(
      (el) => el.innerHTML,
      await page.$(".fic_title")
    );
    console.log("the serie name", serieName);

    // Pipe its output somewhere, like to a file or HTTP response
    // See below for browser usage
    doc.pipe(
      fs.createWriteStream(
        `./downloads/${serieName.replace(/[^a-zA-Z0-9 ]/g, "")}.pdf`
      )
    );

    // write the book infos in the PDF Document
    doc.font("Times-Bold").fontSize(35).text(serieName, {
      align: "center",
    });

    doc.moveDown();

    const serieImage = await page.evaluate(
      (el) => el.src,
      await page.$(".fic_image img")
    );

    console.log("image", serieImage);
    const image = await fetchImage(serieImage);
    let imageWidth = 180;
    doc
      .image(image, doc.page.width / 2 - imageWidth / 2, doc.y, {
        width: imageWidth,
      })
      .stroke();
    doc.moveDown(0.5);
    addSerieInfoToPdf(
      doc,
      "Author Name : ",
      await page.evaluate(
        (el) => el.textContent,
        await page.$(".auth_name_fic")
      )
    );
    doc.moveDown(0.5);
    addSerieInfoToPdf(doc, "Serie Link : ", url, 16, "blue");
    doc.moveDown(0.5);
    addSerieInfoToPdf(
      doc,
      "Author Link : ",
      await page.evaluate(
        (el) => el.href,
        await page.$("span[property='name'] a")
      ),
      16,
      "blue"
    );
    doc.moveDown(0.5);
    addSerieInfoToPdf(
      doc,
      "Last Update : ",
      await page.evaluate(
        (el) => el.textContent,
        await page.$(".toc_ol:first-child .fic_date_pub")
      )
    );
    doc.moveDown(0.5);
    addSerieInfoToPdf(
      doc,
      "number of chapters : ",
      `${await page.evaluate(
        (el) => el.getAttribute("order"),
        await page.$(".toc_ol :first-child ")
      )} chapters`
    );
    doc.moveDown(0.5);

    doc.addPage();
    addSerieInfoToPdf(
      doc,
      "SYNOPSIS : ",
      convert(
        await page.evaluate((el) => el.innerHTML, await page.$(".wi_fic_desc")),
        {
          wordwrap: 130,
        }
      )
    );

    // get the url of last table of content
    let lastTocUrl = url;
    while ((await page.$("a[class='page-link next']")) !== null) {
      await page.goto(
        await page.evaluate(
          (el) => el.href,
          await page.$("a[class='page-link next']")
        )
      );
      lastTocUrl = await page.evaluate(
        (el) => el.href,
        await page.$("a[class='current']")
      );
    }
    // get the url of the first chapter in the book
    let firstChapterLink = await page.$("li[order='1'] a");
    let firstChapterHref = await page.evaluate(
      (el) => el.href,
      firstChapterLink
    );
    console.log("href of first Chapter", firstChapterHref);

    await page.goto(firstChapterHref);
    await addChapterContentToPdf(doc, page);
    let index = 2;
    while (await page.$("a[class='btn-wi btn-next']")) {
      let nextHref = await page.evaluate(
        (el) => el.href,
        await page.$("a[class='btn-wi btn-next']")
      );
      await page.goto(nextHref);
      await addChapterContentToPdf(doc, page);
      console.log(`href of index ${index} : ${nextHref}`);
      index++;
    }

    console.log("end of pdf");
    doc.end();

    return (respnse = {
      status: "Success",
      link: path.resolve(`./downloads/${serieName}.pdf`),
    });
  } catch (err) {
    return (response = {
      status: "Error",
      Error: err,
    });
  }
};

const fetchImage = async (src) => {
  const image = await axios.get(src, {
    responseType: "arraybuffer",
  });
  return image.data;
};

const addSerieInfoToPdf = async (
  doc,
  boldText,
  defaultText,
  defaultFontSize = 16,
  color = "black",
  defaultFontStyle = "Times-Roman",
  boldFontStyle = "Times-Bold"
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
    .fillColor("black");
};

const addChapterContentToPdf = async (doc, page) => {
  let title = await getChapterTitle(page);
  let content = await getChapterContent(page);
  doc.addPage();
  doc.font("Times-Bold").fontSize(18).text(title, {
    align: "center",
  });
  doc.moveDown();
  doc
    .font("Times-Roman")
    .fontSize(14)
    .text(
      convert(content, {
        wordwrap: 130,
      })
    );
};

const getChapterTitle = async (page) => {
  return await page.evaluate(
    (el) => el.innerHTML,
    await page.$(".chapter-title")
  );
};

const getChapterContent = async (page) => {
  return await page.evaluate((el) => el.innerHTML, await page.$("#chp_raw"));
};
