#!/usr/bin/env node

process.env.TZ = require('config').Config.timezone;
var http = require('http');
var interval = require('config').Config.interval;
var app = require('./app');
var crawlerNetEase = require('./netease').crawlerAll;
var crawlerSoHu = require('./sohu').crawlerAll;
var crawlerSina = require('./sina').crawlerAll;
var crawlerQQ = require('./qq').crawlerAll;
var crawlerIfeng = require('./ifeng').crawlerAll;
var async = require('async');

http.createServer(app).listen(app.get('port'), function(){
  async.parallel({
    neteaseInit: crawlerNetEase,
    sohuInit: crawlerSoHu,
    sinaInit: crawlerSina,
    qqInit: crawlerQQ,
    ifengInit: crawlerIfeng,
  },function(){
    console.log("Crawler Init Success!");
  });
  setInterval(crawlerNetEase, interval*2);
  setInterval(crawlerSoHu, interval);
  setInterval(crawlerSina, interval);
  setInterval(crawlerQQ, interval);
  setInterval(crawlerIfeng, interval);
  console.log("Express Start server.js at http://127.0.0.1:" + app.get('port'));
});