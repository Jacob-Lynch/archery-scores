var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  console.log(process.env.FORM_URL);
  res.render('score', { name: req.query.name, shots: req.query.shots, url: process.env.FORM_URL });
});

module.exports = router;
