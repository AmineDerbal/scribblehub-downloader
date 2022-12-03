const express = require("express");
const app = express();
const fs = require("fs");
const rimraf = require("rimraf");
const nodeCron = require("node-cron");
const cors = require("cors");
const path = require("path");
const port = 3000;
const downloadsDir = __dirname + "/downloads";

let indexRouter = require("./routes/index");
let downloadRouter = require("./routes/download");

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(cors());
app.use(express.json());

app.use("/", indexRouter);
app.use("/download", downloadRouter);

app.listen(port, () => {
  console.log(`this server is in port ${port}`);
  console.log(__dirname);
  nodeCron.schedule("*/5 * * * * ", deleteOldDownloadsFiles);
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
        endTime = new Date(stat.ctime).getTime() + 3600000;
        if (now > endTime) {
          return rimraf(path.join(downloadsDir, file), function (err) {
            if (err) {
              return console.error(err);
            }
            console.log("successfully deleted");
          });
        }
      });
    });
  });
};
