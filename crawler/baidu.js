var util = require('util');
var request = require('request');
var _ = require('underscore');
var moment = require('moment');
var config = require('../config');
var News = require('../models/news');
var utils = require('../lib/utils');
var logger = require('../logger');
var crawlFlag = config.crawlFlag;
var updateFlag = config.updateFlag;
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var site = 'baidu';
var baiduSubscribes = [
  {tname: '推送消息', tid: 'http://api.baiyue.baidu.com/sn/api/getpushlist?rn=%d&time=%s&wf=1', tags: ['星闻速递', '早报', '毒舌秀']},
  //{tname: '头条', tid: 'http://api.baiyue.baidu.com/sn/api/focusnews?rn=%d&time=%s&wf=1', tags: ['要闻速递', '囧哥说事', '科技大事件']},
];

var crawlerSubscribe = function (entry) {
  var url = util.format(entry.tid, entry.pageSize, entry.page);
  var headers = {
    'User-Agent': 'bdnews_android_phone',
    'Host': 'api.baiyue.baidu.com',
    'Connection': 'Keep-Alive'
  };
  var req = {
    uri: url,
    method: 'GET',
    headers: headers
  };
  if (proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = utils.parseJSON(err, res, body);
    if (!json || !utils.hasKeys(json, ['data', 'errno']) || (json.errno != 0) || !utils.hasKeys(json.data, ['news', 'hasmore', 'st'])) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json.data.news;
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['title', 'nid', 'abs', 'content'])) {
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.title, entry) || utils.findTagName(newsEntry.abs, entry);
      if (!newsEntry.tagName) {
        return;
      }
      News.findOne(utils.genFindCmd(site,newsEntry.nid), function(err, result) {
        if (err) {
          return;
        }
        newsEntry.updateFlag = 0;
        if (result) {
          if (updateFlag) {
            newsEntry.updateFlag = 1;
          } else {
            return;
          }
        }
        var obj = {};
        obj.docid = utils.encodeDocID(site, newsEntry.nid);
        obj.site = site;
        obj.link = newsEntry.url || url;
        obj.title = newsEntry.title;
        var t1 = moment(parseInt(newsEntry.ts, 10));
        var t2 = moment(parseInt(newsEntry.sourcets, 10));
        var ptime = t1.isValid() ? t1 : t2;
        if (!ptime.isValid()) {
          logger.warn('Invalid time in %s', url);
          return;
        }
        obj.time = ptime.toDate();
        obj.created = new Date();
        obj.views = newsEntry.updateFlag ? result.views : 1;
        obj.tags = newsEntry.tagName;
        obj.digest = newsEntry.abs;
        obj.cover = '';
        obj.marked = '';
        if (_.isArray(newsEntry.content) && !_.isEmpty(newsEntry.content)) {
          _.each(newsEntry.content, function(content, i, contents) {
            if (!utils.hasKeys(content, ['data', 'type'])) {
              logger.info('Invalid content %j', content);
              return;
            }
            if ('image' == content.type) {
              if (!utils.hasKeys(content.data, ['big', 'small', 'original'])) {
                logger.info('Invalid content data %j', content.data);
                return;
              }
              // http://t12.baidu.com/it/u=http://y3.ifengimg.com/cmpp/2014/08/13/14/3d5ebf32-b4bd-4e3e-a130-7c345690f620.jpg&fm=37
              var pattern = /^http:\/\/t\d+\.baidu\.com\/it\/u=(http:[^&]+)&fm=\d+/i;
              var match = content.data.original.url.match(pattern);
              obj.marked += utils.genLazyLoadHtml('', match ? match[1] : content.data.original.url);
              if (!obj.cover) {
                match = content.data.small.url.match(pattern);
                obj.cover = match ? match[1] : content.data.small.url;
              }
            }else if ('text' == content.type) {
              obj.marked += content.data;
            }else {
              logger.info('Invalid type %s', content.type);
              return;
            }
            obj.marked += '<br>'
          });
        }

        logger.log('[%s]%s, docid=[%s]->[%s],updateFlag=%d', obj.tags, obj.title, newsEntry.nid, obj.docid, newsEntry.updateFlag);
        if (newsEntry.updateFlag) {
          News.update({docid: obj.docid}, obj, function (err, result) {
            if (err || !result) {
              logger.warn('update error: %j', err);
            }
          });
        } else {
          News.insert(obj, function (err, result) {
            if (err) {
              logger.warn('insert error: %j', err);
            }
          });
        }
      });
    });
    if (entry.crawlFlag) {
      if (newsList.length === entry.pageSize) {
        entry.page = json.data.st;
        logger.info('[%s] next page: %d', entry.tname, entry.page);
        setTimeout(crawlerSubscribe, 3000, entry);
      }else {
        logger.info('[%s] last page: %d', entry.tname, entry.page);
        entry.crawlFlag = 0;
      }
    }
  });
};

var crawlerSubscribes = function() {
  baiduSubscribes.forEach(function(entry) {
    if (!crawlFlag && entry.stopped) {
      return;
    }
    entry.page = 0;
    entry.pageSize = 20;
    crawlerSubscribe(entry);
  });
}

var main = function() {
  logger.log('Start');
  crawlerSubscribes();
  setTimeout(main, config.crawlInterval);
}

var init = function() {
  if (process.argv[2] == 1) {
    crawlFlag = 1;
  }
  baiduSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
}

exports.main = main;
exports.baiduTags = baiduSubscribes;
init();
main();
