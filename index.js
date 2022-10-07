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

const getAllLinks = async (url, page) => {
  await page.goto(url);
  const tocLinks = [];
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
  const list = await getListOfChapters(tocLinks);
  console.log(`number of chapters in this serie is : ${list.length}`);
  console.log("the List", list);
  // get Url of chapter in the toc page
  /* const text = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".toc_a"), (element) => element.href)
  );*/
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
    getAllLinks(url, page);
    // const chapter = await page.$("#chp_raw");
    //const value = await page.evaluate((el) => el.textContent, chapter);
    //if (!value) reject("Une erreur s'est produite: Pas de chapitre.");
    //resolve(value);
  });
};

// get the list of all chapters in a serie;
const getListOfChapters = async (links) => {
  let chapterLists = [];
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  for (let i = 0; i < links.length; i++) {
    await page.goto(links[i]);
    const list = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".toc_a"), (element) => element.href)
    );
    chapterLists.push(...list);
  }
  return chapterLists;
};
