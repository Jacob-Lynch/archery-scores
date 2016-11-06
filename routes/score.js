var express = require('express');
var uuid = require('uuid');
var router = express.Router();

var renderScore = function(res, name, shots) {
  console.log('rendering score', name, shots);
  res.render('score', { name: name, shots: shots, url: process.env.FORM_URL });
};

var requireSession = function(req, res, next) {
  if(!req.session) {
    return res.redirect('/');
  }
  next();
};

router.get('/', requireSession, function(req, res, next) {
  renderScore(res, req.session.name, req.session.shots);
});

router.post('/', function(req, res, next) {
  // if no cookie, generate cookie
  var cookie = req.cookies.session;
  var configs = req.db.collection('config');
  if(!cookie || !req.session) {
    // generate a new cookie and save config to DB
    var session = uuid.v1();
    configs.insert({cookie: session, name: req.body.name, shots: parseInt(req.body.shots), start: new Date()}, function(err, result) {
      //console.log('new cookie', result);
      res.cookie('session', session, {maxAge: 1000 * 60 * 60 * 12, httpOnly: true});
      renderScore(res, req.body.name, req.body.shots);
    });
  } else if(!req.body.score) {
    // not submitting a score, so must be updating config
    // already have cookie, we are just updating config in DB
    configs.update({_id: req.session._id}, {$set: {name: req.body.name, shots: req.body.shots}}, function(err, result) {
      //console.log('updated', result);
      renderScore(res, req.body.name, req.body.shots);
    });
  } else if(req.body.score) {
    // keep track of scores for this session so we can show stats
    var stats = req.db.collection('stat');
    stats.insert({cookie: req.session.cookie, name: req.session.name, shots: parseInt(req.session.shots), score: parseInt(req.body.score), time: new Date()}, function(err, result) {
      console.log('new score', result);
      renderScore(res, req.session.name, req.session.shots);
    });
  }
});

router.get('/stats', requireSession, function(req, res, next) {
  var stats = req.db.collection('stat');
  stats.find({cookie: req.session.cookie}).toArray(function(err, allStats) {
    var totalShots = 0, totalScore = 0, totalMs = 0;
    allStats.forEach(function(stat, i) {
      totalShots += stat.shots;
      totalScore += stat.score;
      totalMs += i == 0 ? stat.time - req.session.start : stat.time - allStats[i-1].time;
    })
    console.log('total shots', totalShots);
    console.log('total score', totalScore);
    console.log('total rounds', allStats.length);
    console.log('total time', totalMs);
    console.log('average score', totalScore / allStats.length);
    console.log('average shots', totalShots / allStats.length);
    console.log('average round time', totalMs / allStats.length);
    res.redirect('/score');
  });
});

module.exports = router;
