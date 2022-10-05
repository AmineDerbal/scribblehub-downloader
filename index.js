import express from "express";
import puppeteer from "puppeteer";
import cors from "cors";

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

  getPage(url)
    .then((chapter) => res.send(chapter))
    .catch((err) => {
      res.send(`Une erreur s'est produite: ${err}`);
    });
});
app.listen(port, () => {
  console.log(`this server is in port ${port}`);
});

const getAllLinks = async (url) => {
  let isIndex = /\/series\//;
  const links = [];
  if (isIndex.test(url)) {
    console.log("url", url);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const response = await page.goto(url);

    const bodyHandle = await page.$("body");
    /*  const html = await page.evaluate((body) => {
      const mappedLinks = body.getElementsByClassName("toc_a");
      console.log("mappedLinks", mappedLinks);
      return mappedLinks;
    }, bodyHandle);
    console.log(html);*/

    // const mappedLinks = await page.$(".toc_a");
    // console.log("mappedLinks", mappedLinks);
  }
};

const getPage = async (url) => {
  return new Promise(async (resolve, reject) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const response = await page.goto(url);
    if (response.status() != 200) {
      reject(response.status());
      return;
    }
    let indexUrl = /\/read\//;
    if (indexUrl.test(url)) {
      console.log("true");
      const indexSerie = await page.$(".c_index a");
      let serieUrl = await page.evaluate((el) => el.href, indexSerie);
      console.log("the serie url", serieUrl);
      url = serieUrl;
    }
    getAllLinks(url);
    // const chapter = await page.$("#chp_raw");
    //const value = await page.evaluate((el) => el.textContent, chapter);
    //if (!value) reject("Une erreur s'est produite: Pas de chapitre.");
    //resolve(value);
  });
};
