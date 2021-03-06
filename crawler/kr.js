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
var site = '36kr';
var subscriptions = [
  {tname: '首页', tid: 'topics', tags: ['8点1氪', '创业说', '氪周刊', '氪月报', '36氪开放日']},
];

var fetchSubscription = function (entry) {
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
  if (config.proxyEnable) {
    req.proxy = config.proxyUrl;
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
          logger.warn('Invalid time in %s', url);
          return;
        }
        obj.time = ptime.toDate();
        obj.created = new Date();
        obj.views = newsEntry.updateFlag ? result.views : 1;
        obj.tags = newsEntry.tagName;
        obj.marked = newsEntry.body_html;
        obj.digest = utils.genDigest(newsEntry.excerpt + obj.marked);
        obj.cover = newsEntry.feature_img || '';

        logger.log('[%s]%s, docid=[%s]->[%s]', obj.tags, obj.title, newsEntry.id, obj.docid);
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
        entry.page += 1;
        logger.info('[%s] next page: %d', entry.tname, entry.page);
        setTimeout(fetchSubscription, 3000, entry);
      }else {
        logger.info('[%s] last page: %d', entry.tname, entry.page);
        entry.crawlFlag = 0;
      }
    }
  });
};

var fetchSubscriptions = function () {
  subscriptions.forEach(function(entry) {
    if (entry.stopped && !entry.crawlFlag) {
      return;
    }
    entry.page = 1;
    entry.pageSize = 10;
    fetchSubscription(entry);
  });
}

var main = function() {
  logger.log('Start');
  subscriptions.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
  crawlFlag = 0;
  fetchSubscriptions();
  setTimeout(main, config.crawlInterval);
}

if (require.main === module) {
  main();
}

exports.main = main;
exports.subscriptions = subscriptions;
