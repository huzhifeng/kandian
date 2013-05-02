#!/usr/bin/env node

process.env.TZ = require('config').Config.timezone;
var http = require('http');
var interval = require('config').Config.interval;
var app = require('./app');
var crawlerNetEase = require('./netease').crawlerAll;
var crawlerSoHu = require('./sohu').crawlerAll;
var crawlerSina = require('./sina').crawlerAll;
var async = require('async');

http.createServer(app).listen(app.get('port'), function(){
  async.parallel({
    neteaseInit: crawlerNetEase,
    sohuInit: crawlerSoHu,
    sinaInit: crawlerSina
  },function(){
    console.log("Crawler Init Success!");
  });
  setInterval(crawlerNetEase, interval*2);
  setInterval(crawlerSoHu, interval);
  setInterval(crawlerSina, interval);
  console.log("Express Start server.js at http://127.0.0.1:" + app.get('port'));
});