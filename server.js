#!/usr/bin/env node
process.env.TZ = require('./config').timezone;
var http = require('http');
var app = require('./app');
var neteaseCrawler = require('./crawler/netease').main;
var sohuCrawler = require('./crawler/sohu').main;
var sinaCrawler = require('./crawler/sina').main;
var qqCrawler = require('./crawler/qq').main;
var ifengCrawler = require('./crawler/ifeng').main;
var yokaCrawler = require('./crawler/yoka').main;
var krCrawler = require('./crawler/kr').main;
var huxiuCrawler = require('./crawler/huxiu').main;
var businessvalueCrawler = require('./crawler/businessvalue').main;
var wumiiCrawler = require('./crawler/wumii').main;
var diaobaoCrawler = require('./crawler/diaobao').main;

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express Start server.js at http://127.0.0.1:" + app.get('port') + "  " + new Date());
});
