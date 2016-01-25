#!/usr/bin/env node
var http = require('http');
var _ = require('underscore');
var app = require('./app');
var config = require('./config');
var logger = require('./logger');
process.env.TZ = require('./config').timezone;
var crawlers = [
  require('./crawler/netease').main,
  require('./crawler/sohu').main,
  require('./crawler/ifeng').main,
  require('./crawler/sina').main,
/*
  require('./crawler/qq').main,
  require('./crawler/diaobao').main,
  require('./crawler/kr').main,
  require('./crawler/huxiu').main,
  require('./crawler/businessvalue').main,
  require('./crawler/yoka').main,
  require('./crawler/wumii').main,
*/
];

http.createServer(app).listen(app.get('port'), function(){
  logger.log('Express Start server.js at http://127.0.0.1:%s', app.get('port'));
});

_.each(crawlers, function(crawler, i, crawlers) {
  setTimeout(crawler, i * (config.crawlInterval / crawlers.length));
});
