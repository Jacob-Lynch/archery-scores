var express = require('express');
var uuid = require('uuid');
var _ = require('lodash');
var request = require('request');
var router = express.Router();

var renderScore = function(res, name, shots) {
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


router.get('/reset', function(req, res, next) {
  res.clearCookie('session');
  res.redirect('/');
});

router.get('/reconfig', function(req, res, next) {
  res.redirect('/');
});

var submitScore = function(score, shots, name) {
  return function() {
    request.get(process.env.FORM_URL + '?Score=' + score + '&Shots=' + shots + '&Name=' + name);
  }
};

router.post('/', function(req, res, next) {
  // if no cookie, generate cookie
  var cookie = req.cookies.session;
  var configs = req.db.collection('config');
  if(!cookie || !req.session) {
    if(!req.body.name || !req.body.shots) {
      return res.redirect('/');
    }
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
    stats.insert({cookie: req.session.cookie, name: req.session.name, shots: parseInt(req.session.shots), score: parseInt(req.body.score), time: new Date()}, function(err, results) {
      //console.log('new score', results);
      var result = results[0];
      _.defer(submitScore(result.score, result.shots, result.name));
      renderScore(res, req.session.name, req.session.shots);
    });
  }
});

var formatDecimal = function(num) {
  return isNaN(num) ? '--' : num.toFixed(2);
};

var formatTime = function(sec) {
  if(isNaN(sec) || sec == 0) return '--';
  var sec_num = parseInt(sec, 10); // don't forget the second param
  var hours   = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
  var seconds = sec_num - (hours * 3600) - (minutes * 60);

  if (hours   < 10) {hours   = "0"+hours;}
  if (minutes < 10) {minutes = "0"+minutes;}
  if (seconds < 10) {seconds = "0"+seconds;}
  return hours+':'+minutes+':'+seconds;
};

router.get('/stats', requireSession, function(req, res, next) {
  var stats = req.db.collection('stat');
  stats.find({cookie: req.session.cookie}).toArray(function(err, allStats) {
    var totalShots = 0, totalScore = 0, totalMs = 0;
    allStats.forEach(function(stat, i) {
      totalShots += stat.shots;
      totalScore += stat.score;
      totalMs += i == 0 ? stat.time - req.session.start : stat.time - allStats[i-1].time;
    });
    res.render('stats', {
      totalShots: totalShots,
      avgScore: formatDecimal(totalScore / allStats.length),
      avgRoundTime: formatTime(totalMs / allStats.length / 1000),
      totalRounds: allStats.length,
      totalTime: formatTime(totalMs / 1000),
      totalScore: totalScore,
      avgShots: formatDecimal(totalShots / allStats.length)
    });
  });
});

module.exports = router;
