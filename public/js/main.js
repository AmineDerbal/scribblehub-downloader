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
    //console.log(response);
    if (response.status == "Error") {
      console.log("Error : ", response.Error);
      return;
    }
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
    const urlStream = await fetch("/", options);
    console.log("done");
    //console.log(urlStream);
    const urlData = await urlStream.json();
    console.log("fetching data");
    //console.log(urlData);
    return urlData;
  } catch (err) {
    return { Error: err, status: "Error" };
  }
};
