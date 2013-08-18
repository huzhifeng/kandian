#!/usr/bin/env node

process.env.TZ = require('config').Config.timezone;
var http = require('http');
var app = require('./app');
var neteaseCrawler = require('./netease').neteaseCrawler;
var sohuCrawler = require('./sohu').sohuCrawler;
var sinaCrawler = require('./sina').sinaCrawler;
var qqCrawler = require('./qq').qqCrawler;
var ifengCrawler = require('./ifeng').ifengCrawler;
var baiduCrawler = require('./baidu').baiduCrawler;
var yokaCrawler = require('./yoka').yokaCrawler;
var krCrawler = require('./kr').krCrawler;
var huxiuCrawler = require('./huxiu').huxiuCrawler;
var iheimaCrawler = require('./iheima').iheimaCrawler;
var businessvalueCrawler = require('./businessvalue').businessvalueCrawler;

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express Start server.js at http://127.0.0.1:" + app.get('port') + "  " + new Date());
});