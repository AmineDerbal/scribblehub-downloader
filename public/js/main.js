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
    //console.log("response", await response.text());
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
    return urlStream;
  } catch (err) {
    return { Error: err.stack };
  }
};
