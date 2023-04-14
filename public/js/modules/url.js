import getProgress from './progress.js';

export const testUrl = (url) => {
  let urlRegex = /^(https?:\/\/www\.scribblehub\.com\/(read|series)\/(\w|\W))/;
  return urlRegex.test(url);
};

export const postNovelUrl = async (url, current) => {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: url.value,
    }),
  };
  try {
    console.log('sending data');
    let interval = setInterval(async () => {
      await getProgress(current);
    }, 500);

    const urlStream = await fetch('/download', options);
    const urlData = await urlStream.json();
    console.log('fetching data');
    clearInterval(interval);
    return urlData;
  } catch (err) {
    return { Error: err, status: 'Error' };
  }
};

export default { testUrl, postNovelUrl };
