import express from 'express';
const app = express();
import fs from 'fs';
import rimraf from 'rimraf';
import nodeCron from 'node-cron';
import cors from 'cors';
import path from 'path';
const port = 3000;
import { fileURLToPath } from 'url';
import indexRouter from './routes/index.js';
import downloadRouter from './routes/download.js';
import errorRouter from './routes/error.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const downloadsDir = `${__dirname}/downloads`;
// const downloadsDir = __dirname + '/downloads';

// let indexRouter = require('./routes/index');
// let downloadRouter = require('./routes/download');
// let errorRouter = require('./routes/error');

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(cors());
app.use(express.json());

app.use('/', indexRouter);
app.use('/download', downloadRouter);
app.use('/error', errorRouter);

app.listen(port, () => {
  console.log(`this server is in port ${port}`);
  console.log(__dirname);
  nodeCron.schedule('*/5 * * * * ', deleteOldDownloadsFiles);
});

const deleteOldDownloadsFiles = () => {
  const date = new Date();
  console.log(`Execution of delete function at ${date.toLocaleString()}`);
  fs.readdir(downloadsDir, function (err, files) {
    files.forEach(function (file, index) {
      fs.stat(path.join(downloadsDir, file), function (err, stat) {
        var endTime, now;
        if (err) {
          return console.error(err);
        }
        now = new Date().getTime();
        endTime = new Date(stat.mtime).getTime() + 3600000;
        if (now > endTime) {
          return rimraf(path.join(downloadsDir, file), function (err) {
            if (err) {
              return console.error(err);
            }
            console.log('successfully deleted');
          });
        }
      });
    });
  });
};
