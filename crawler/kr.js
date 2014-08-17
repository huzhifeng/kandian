var util = require('util');
var request = require('request');
var _ = require('underscore');
var moment = require('moment');
var jsdom = require('jsdom').jsdom;
var config = require('../config');
var News = require('../models/news');
var utils = require('../lib/utils');
var logger = require('../logger');
var crawlFlag = config.crawlFlag;
var updateFlag = config.updateFlag;
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var site = '36kr';
var krSubscribes = [
  {
    tname:'首页',
    tid:'topics',
    tags:[
      '8点1氪',
      '创业说',
      '氪周刊',
      '氪月报',
      '36氪开放日',
    ]
  },
  //{tname:'国外创业公司', tid:'topics/category/us-startups', tags:[]},
  //{tname:'国内创业公司', tid:'topics/category/cn-startups', tags:[]},
  //{tname:'国外资讯', tid:'topics/category/breaking', tags:[]},
  //{tname:'国内资讯', tid:'topics/category/cn-news', tags:[]},
  //{tname:'生活方式', tid:'topics/category/digest', tags:[]},
  //{tname:'专栏文章', tid:'topics/category/column', tags:[]}, //该栏目没有body_html属性,可以通过util.format('http://apis.36kr.com/api/v1/topics/%s.json?token=734dca654f1689f727cc:32710', newsEntry.id)得到
];

var crawlerSubscribe = function (entry) {
  // http://apis.36kr.com/api/v1/topics.json?token=734dca654f1689f727cc:32710&page=1&per_page=10
  // http://apis.36kr.com/api/v1/topics/category/column.json?token=734dca654f1689f727cc:32710&page=1&per_page=10
  var url = util.format('http://apis.36kr.com/api/v1/%s.json?token=734dca654f1689f727cc:32710&page=%d&per_page=%d', entry.tid, entry.page, entry.pageSize);
  var headers = {
    'Host': 'apis.36kr.com',
    'Connection': 'Keep-Alive',
    'User-Agent':'android-async-http/1.4.1 (http://loopj.com/android-async-http)',
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
    if (!json || !_.isArray(json) || _.isEmpty(json)) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json;
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['id', 'title', 'body_html'])) {
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.title, entry);
      if (!newsEntry.tagName) {
        return;
      }
      News.findOne(utils.genFindCmd(site,newsEntry.id), function(err, result) {
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
        obj.docid = utils.encodeDocID(site, newsEntry.id);
        obj.site = site;
        obj.link = util.format('http://www.36kr.com/t/%s', newsEntry.id);
        obj.title = newsEntry.title;
        var t1 = moment(newsEntry.created_at);
        var t2 = moment(newsEntry.updated_at);
        var t3 = moment(newsEntry.replied_at);
        var ptime = t1.isValid() ? t1 : (t2.isValid() ? t2 : t3);
        if (!ptime.isValid()) {
          logger.warn('Invalid time in %s', res ? res.request.href : url);
          return;
        }
        obj.time = ptime.toDate();
        obj.created = new Date();
        obj.views = newsEntry.updateFlag ? result.views : 1;
        obj.tags = newsEntry.tagName;
        obj.marked = newsEntry.body_html;
        obj.digest = utils.genDigest(newsEntry.excerpt + obj.marked);
        obj.cover = newsEntry.feature_img || '';

        logger.log('[%s]%s, docid=[%s]->[%s],updateFlag=%d', obj.tags, obj.title, newsEntry.id, obj.docid, newsEntry.updateFlag);
        if (newsEntry.updateFlag) {
          News.update({docid: obj.docid}, obj, function (err, result) {
            if (err || !result) {
              logger.warn('update error: %j', err);
            }
          }); // News.update
        } else {
          News.insert(obj, function (err, result) {
            if (err) {
              logger.warn('insert error: %j', err);
            }
          }); // News.insert
        }
      }); // News.findOne
    });//forEach
    if (entry.crawlFlag) {
      if (newsList.length === entry.pageSize) {
        entry.page += 1;
        logger.info('[%s] next page: %d', entry.tname, entry.page);
        setTimeout(crawlerSubscribe, 3000, entry);
      }else {
        logger.info('[%s] last page: %d', entry.tname, entry.page);
        entry.crawlFlag = 0;
      }
    }
  });//request
};

var crawlerKrSubscribes = function () {
  krSubscribes.forEach(function(entry) {
    if (!crawlFlag && entry.stopped) {
      return;
    }
    entry.page = 1;
    entry.pageSize = 10;
    crawlerSubscribe(entry);
  });
}

var main = function() {
  logger.log('Start');
  crawlerKrSubscribes();
  setTimeout(main, config.crawlInterval);
}

var init = function() {
  if (process.argv[2] == 1) {
    crawlFlag = 1;
  }
  krSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
}

exports.main = main;
init();
main();
