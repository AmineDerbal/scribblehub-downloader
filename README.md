# Scribblehub-Downloader

This project is a scrapper web that reads all chapters of a fiction series from [Scribble Hub](https://www.scribblehub.com/) and convert them into a pdf file that can be download from the server.

The pdf link last for 1 hour before being deleted from the server.

The server delete all pdf files that have update dates older than an hour.

### To Start This Project 

### `npm i`

Install all the packages you need by running the command in your terminal.

### `npm run dev`
To start the server, after that access the index web page by this [Address](http://localhost:3000/) 


### Notes
- Ive coded it to output a pdf for every 10 chapters. Because scribblehub throttles after the 12th or 13th chapter..

- Because of the throttling from scribblehub, bypassing it with more calls will add 10s(every10chapters) + 3s delay(if chapter pull is rejected) will still complete download of all chapters.

- Only generates synposis + novel header when generating from chapter 1. in the form input.



