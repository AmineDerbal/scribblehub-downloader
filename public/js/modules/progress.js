const getProgress = async (current) => {
  const dataStream = await fetch('./download');
  const data = await dataStream.json();

  if (document.getElementById('name').textContent != data.serieName) {
    document.getElementById('name').textContent = data.serieName;
  }
  if (document.getElementById('author').textContent != data.authorName) {
    document.getElementById('author').textContent = data.authorName;
  }
  if (document.getElementById('update').textContent != data.lastUpdate) {
    document.getElementById('update').textContent = data.lastUpdate;
  }

  let numberOfChapter = document.getElementById('number-of-chapter');
  if (numberOfChapter.textContent != data.numberOfChapter) {
    numberOfChapter.textContent = data.numberOfChapter;
  }
  if (current != data.currentProgress) {
    const progressBar = document.getElementById('progress-bar');
    current = data.currentProgress;
    let progressBarValue = parseInt((current * 99) / data.numberOfChapter);
    progressBar.setAttribute('aria-valuenow', progressBarValue);
    progressBar.style.width = `${progressBarValue}%`;
    if (progressBarValue > 50) {
      document.getElementById('small').style.color = '#fff';
    }
    document.getElementById(
      'small',
    ).textContent = `${progressBarValue}% - Downloading chapter ${current}`;
  }
};

export default getProgress;
