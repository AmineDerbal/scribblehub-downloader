const urlSubmitButton = document.querySelector(".submit");
const url = document.getElementById("url");
urlSubmitButton.addEventListener("click", async (e) => {
  e.preventDefault();
  if (url.value == "") return;
  if (!testUrl(url.value)) {
    console.log("give a valide url");
  } else {
    console.log("valid url");

    console.log("url", url.value);
    const response = await post(url);
    //  console.log("response", await response.text());
    console.log("create a div");
    const content = document.createElement("div");
    content.classList.add("content");
    body = document.querySelector("body");
    body.appendChild(content);

    const serieName = document.createElement("h1");
    serieName.classList.add("serie-name");
    serieName.textContent = response.serieName;
    content.appendChild(serieName);

    const serieSynopsis = document.createElement("div");
    serieSynopsis.classList.add("serie-synopsis");
    serieSynopsis.textContent = response.description;
    content.appendChild(serieSynopsis);
  }
});

const testUrl = (url) => {
  let urlRegex = /^(https?:\/\/www\.scribblehub\.com\/(read|series)\/(\w|\W))/;
  return urlRegex.test(url);
};
const post = async (url) => {
  // console.log(url.value);
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
    const urlStream = await fetch("/", options);
    console.log("done");
    //console.log(urlStream);
    const urlData = await urlStream.json();
    console.log("fetching data");
    //console.log(urlData);
    return urlData;
  } catch (err) {
    return { Error: err.stack };
  }
};
