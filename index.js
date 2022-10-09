import fs from "fs";
import path from "path";
import express from "express";
import puppeteer from "puppeteer";
import cors from "cors";
import PDFDocument from "pdfkit";
import { convert } from "html-to-text";

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
  // const allLinks = await getAllLinks(url);
  try {
    const downloadLink = await getPage(url);
    // console.log("chapterData", chaptersData);
    //console.log("the json");
    //const chaptersJson = await chaptersData.json();
    //console.log("chapter JSON", chaptersJson);
    res.json(downloadLink);
  } catch (err) {
    res.send(`Une erreur s'est produite: ${err}`);
  }
  /* getPage(url)
    .then((chapter).json => res.send(chapter))
    .catch((err) => {
      res.send(`Une erreur s'est produite: ${err}`);
    });*/
});
app.listen(port, () => {
  console.log(`this server is in port ${port}`);
});

const getPage = async (url) => {
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
    let urlToc =
      /https?:\/\/www.scribblehub.com\/series\/\d{2,6}\/[\w|\W]+\/?toc=/;
    if (urlToc.test(url)) {
      url = url.match(urlToc)[0] + "1";
    }
    const linkToFile = await getAllLinks(url, page);
    console.log("~ linkToFile", linkToFile);
    if (!linkToFile) reject("Une erreur s'est produite: Pas de chapitre.");
    // console.log("file", file);
    resolve(linkToFile);
  });
};

const generatePDF = (file) => {
  // Create a document
  const doc = new PDFDocument();

  // Check if downloads file exists
  if (!fs.existsSync("downloads"))
    fs.mkdir("downloads", (err) => {
      if (err) {
        return console.error(err);
      }
    });

  // Pipe its output somewhere, like to a file or HTTP response
  // See below for browser usage
  doc.pipe(fs.createWriteStream(`./downloads/${file.serieName}.pdf`));

  // Embed a font, set the font size, and render some text
  // doc
  //   .font("fonts/PalatinoBold.ttf")
  //   .fontSize(25)
  //   .text("Some text with an embedded font!", 100, 100);

  // Add another page
  // doc.addPage().fontSize(25).text("Here is some vector graphics...", 100, 100);

  doc
    .text(file.serieName, 15, 15)
    .underline(100, 100, 160, 27, { color: "#0000FF" });
  doc.text("SYNOPSIS: ", 15, 40);
  doc.text(
    convert(file.description, {
      wordwrap: 130,
    }),
    15,
    75
  );

  for (let index = 0; index < file.content.length; index++) {
    doc.addPage();
    doc.text(file.content[index].chapterTitle);
    doc.moveDown();
    doc.moveDown();

    const richText = convert(file.content[index].chapterContent, {
      wordwrap: 130,
    });

    doc.text(richText, {
      continued: true,
    });
  }

  // Finalize PDF file
  doc.end();
  return path.resolve(`./downloads/${file.serieName}.pdf`);
};

const getAllLinks = async (url, page) => {
  await page.goto(url);
  let file = {};
  const tocLinks = [];
  const serieName = await page.$(".fic_title");
  file.serieName = await page.evaluate((el) => el.innerHTML, serieName);
  const description = await page.$(".wi_fic_desc");
  file.description = await page.evaluate((el) => el.innerHTML, description);
  console.log(file.description);

  tocLinks.push(
    await page.evaluate((el) => el.href, await page.$("a[class='current']"))
  );
  while ((await page.$("a[class='page-link next'")) !== null) {
    await page.goto(
      await page.evaluate(
        (el) => el.href,
        await page.$("a[class='page-link next'")
      )
    );
    tocLinks.push(
      await page.evaluate((el) => el.href, await page.$("a[class='current']"))
    );
  }
  console.log("toclinks", tocLinks);
  const chaptersList = await getListOfChapters(tocLinks);
  const allChaptersContent = await getAllChaptersContent(chaptersList);
  file.content = allChaptersContent;
  const linkToFile = generatePDF(file);
  console.log("~ linkToFile", linkToFile);

  return linkToFile;
};

// get the list of all chapters in the serie;
const getListOfChapters = async (links) => {
  let chapterLists = [];
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  for (let i = 0; i < links.length; i++) {
    // get Url of chapter in the toc page
    await page.goto(links[i]);
    const list = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".toc_a"), (element) => element.href)
    );
    chapterLists.push(...list);
  }
  await browser.close();
  return chapterLists;
};

const getAllChaptersContent = async (chapterLists) => {
  const allChaptersContent = [];
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  for (let i = 0; i < chapterLists.length; i++) {
    await page.goto(chapterLists[i]);
    const chapterTitle = await page.$(".chapter-title");
    const chapterContent = await page.$("#chp_raw");
    const chapter = {
      chapterTitle: await page.evaluate((el) => el.innerHTML, chapterTitle),
      chapterContent: await page.evaluate((el) => el.innerHTML, chapterContent),
    };
    allChaptersContent.unshift(chapter);
  }
  await browser.close();
  return allChaptersContent;
};
