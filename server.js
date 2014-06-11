#!/usr/bin/env node
process.env.TZ = require('config').Config.timezone;
var http = require('http');
var app = require('./app');
var neteaseCrawler = require('./crawler/netease').neteaseCrawler;
var sohuCrawler = require('./crawler/sohu').sohuCrawler;
var sinaCrawler = require('./crawler/sina').sinaCrawler;
var qqCrawler = require('./crawler/qq').qqCrawler;
var ifengCrawler = require('./crawler/ifeng').ifengCrawler;
var yokaCrawler = require('./crawler/yoka').yokaCrawler;
var krCrawler = require('./crawler/kr').krCrawler;
var huxiuCrawler = require('./crawler/huxiu').huxiuCrawler;
var businessvalueCrawler = require('./crawler/businessvalue').businessvalueCrawler;
var wumiiCrawler = require('./crawler/wumii').wumiiCrawler;

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express Start server.js at http://127.0.0.1:" + app.get('port') + "  " + new Date());
});
