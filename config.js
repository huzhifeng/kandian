var utils = require('./lib/utils');
var flag = process.argv[2] || process.env.flag || 0;
module.exports = {
  siteName: '看点网',
  port: process.env.expressPort || 80,
  timezone: 'Asia/Shanghai',
  cookieSecret: '#$%ZHU@1314',
  staticMaxAge: 3600000 * 24 * 1,
  crawlInterval: 4000 * 60 * 60,
  limit: 15,
  maxRssItems: 20,
  crawlFlag: utils.getBit(flag, 0),
  updateFlag: utils.getBit(flag, 1),
  proxyEnable: utils.getBit(flag, 2),
  proxyUrl: 'http://127.0.0.1:7788'
};
