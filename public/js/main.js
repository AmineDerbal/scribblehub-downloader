const urlSubmitButton = document.querySelector(".submit");
const url = document.getElementById("url");
const ficInformations = document.getElementById("fic-informations");
let current = "";

urlSubmitButton.addEventListener("click", async (e) => {
  e.preventDefault();
  current = 0;
  if (url.value == "") return;
  if (!testUrl(url.value)) {
    console.log("give a valide url");
  } else {
    console.log("valid url");

    console.log("url", url.value);
    if (ficInformations.childNodes.length != 0) {
      ficInformations.innerHTML = "";
    }
    buildFicInformationLayout();

    const response = await post(url);
    //console.log(response);

    if (response.status == "Error") {
      console.log("Error : ", response.Error);
      return;
    }
    const progressBar = document.getElementById("progress-bar");
    const small = document.getElementById("small");
    progressBar.setAttribute("aria-valuenow", "100");
    progressBar.style.width = `100%`;
    if (small.style.color == "black") {
      small.style.color = "#fff";
    }
    small.textContent = "100% - Finished";

    const pdfLink = document.createElement("div");
    pdfLink.id = "pdf-link";
    ficInformations.appendChild(pdfLink);
    const pdfspan = document.createElement("span");
    pdfspan.textContent = "pdf Link : ";
    const pdfImage = document.createElement("img");
    pdfImage.src =
      "../images/15399621-pdf-file-download-icon-vector-illustration.webp";
    const link = document.createElement("a");
    link.href = response.link;
    link.setAttribute("download", "");
    link.appendChild(pdfImage);
    pdfLink.appendChild(pdfspan);
    pdfLink.appendChild(link);

    console.log(response);
  }
});

const testUrl = (url) => {
  let urlRegex = /^(https?:\/\/www\.scribblehub\.com\/(read|series)\/(\w|\W))/;
  return urlRegex.test(url);
};
const post = async (url) => {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: url.value,
    }),
  };
  try {
    console.log("sending data");
    console.log(JSON.parse(options.body).url);
    let interval = setInterval(async () => {
      await getProgress();
    }, 500);
    console.log("option", options);
    const urlStream = await fetch("/download", options);
    console.log("done");
    //console.log(urlStream);

    const urlData = await urlStream.json();
    console.log("fetching data");
    //console.log(urlData);
    clearInterval(interval);
    return urlData;
  } catch (err) {
    return { Error: err, status: "Error" };
  }
};

const getProgress = async () => {
  const dataStream = await fetch("./download");
  const data = await dataStream.json();

  if (document.getElementById("name").textContent != data.serieName) {
    document.getElementById("name").textContent = data.serieName;
  }
  if (document.getElementById("author").textContent != data.authorName) {
    document.getElementById("author").textContent = data.authorName;
  }
  if (document.getElementById("update").textContent != data.lastUpdate) {
    document.getElementById("update").textContent = data.lastUpdate;
  }

  let numberOfChapter = document.getElementById("number-of-chapter");
  if (numberOfChapter.textContent != data.numberOfChapter) {
    numberOfChapter.textContent = data.numberOfChapter;
  }
  if (current != data.currentProgress) {
    console.log("current", current);
    console.log("data current", data.currentProgress);
    const progressBar = document.getElementById("progress-bar");
    current = data.currentProgress;
    let progressBarValue = parseInt((current * 99) / data.numberOfChapter);
    console.log("progress value", progressBarValue);
    progressBar.setAttribute("aria-valuenow", progressBarValue);
    progressBar.style.width = `${progressBarValue}%`;
    if (progressBarValue > 50) {
      document.getElementById("small").style.color = "#fff";
    }
    document.getElementById(
      "small"
    ).textContent = `${progressBarValue}% - Downloading chapter ${current}`;
  }
};

const buildFicInformationLayout = () => {
  const ficName = document.createElement("div");
  ficName.id = "fic-name";
  ficName.textContent = "Fiction Name : ";
  ficInformations.appendChild(ficName);
  const name = document.createElement("span");
  name.id = "name";
  name.textContent = "";
  ficName.appendChild(name);

  const ficAuthor = document.createElement("div");
  ficAuthor.id = "fic-author";
  ficAuthor.textContent = "Fiction Author : ";
  ficInformations.appendChild(ficAuthor);
  const author = document.createElement("span");
  author.id = "author";
  author.textContent = "";
  ficAuthor.appendChild(author);

  const ficUpdate = document.createElement("div");
  ficUpdate.id = "fic-update";
  ficUpdate.textContent = "Last Updated : ";
  ficInformations.appendChild(ficUpdate);
  const update = document.createElement("span");
  update.id = "update";
  update.textContent = "";
  ficUpdate.appendChild(update);

  const ficNumberOfChapter = document.createElement("div");
  ficNumberOfChapter.id = "fic-number-of-chapter";
  ficNumberOfChapter.textContent = "Number of Chapter : ";
  ficInformations.appendChild(ficNumberOfChapter);
  const numberOfChapter = document.createElement("span");
  numberOfChapter.id = "number-of-chapter";
  numberOfChapter.textContent = 0;
  ficNumberOfChapter.appendChild(numberOfChapter);

  const progress = document.createElement("div");
  progress.className = "progress";
  ficInformations.appendChild(progress);
  const progressBar = document.createElement("div");
  progressBar.className = "progress-bar";
  progressBar.id = "progress-bar";
  progressBar.setAttribute("role", "progressbar");
  progressBar.setAttribute("aria-valuemin", "0");
  progressBar.setAttribute("aria-valuemax", "100");
  progressBar.setAttribute("aria-valuenow", "0");
  progressBar.style.width = "0%";
  progress.appendChild(progressBar);

  const small = document.createElement("small");
  small.className = "justify-content-center d-flex position-absolute w-100";
  small.id = "small";
  small.style.color = "black";
  small.textContent = "0%";
  progressBar.appendChild(small);
};
