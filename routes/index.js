const express = require("express");
const fs = require("fs");
const router = express.Router();

router.get("/", (req, res) => {
  res.render("index");
  // Check if downloads folder exists
  if (!fs.existsSync("downloads"))
    fs.mkdir("downloads", (err) => {
      if (err) {
        return console.error(err);
      }
    });
});

module.exports = router;
