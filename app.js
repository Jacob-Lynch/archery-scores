var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compression = require('compression')
var Db = require('tingodb')({memStore: true}).Db;

var index = require('./routes/index');
var score = require('./routes/score');

var app = express();

app.use(compression());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// setup db, make available to requests
var db = new Db('/some/local/path', {});
app.use(function(req, res, next) {
  req.db = db;
  next();
});

// set session info, if available
app.use(function(req, res, next) {
  if(req.cookies.session) {
    req.db.collection('config').findOne({cookie: req.cookies.session}, function(err, session) {
      if(!err && session) {
        console.log('found session', session);
        req.session = session;
      }
      next();
    });
  } else {
    next();
  }
});

app.use('/', index);
app.use('/score', score);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
