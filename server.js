#!/usr/bin/env node

process.env.TZ = require('config').Config.timezone;
var http = require('http');
var interval = require('config').Config.interval;
var app = require('./app');
var crawlerAll = require('./netease').crawlerAll;

http.createServer(app).listen(app.get('port'), function(){
  crawlerAll();
  setInterval(crawlerAll, interval);
  console.log("setInterval(crawlerAll, " + interval + ")");
  console.log("Express Start server.js at http://127.0.0.1:" + app.get('port'));
});