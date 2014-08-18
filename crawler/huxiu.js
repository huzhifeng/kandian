var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require('underscore');
var moment = require('moment');
var config = require('../config');
var News = require('../models/news');
var utils = require('../lib/utils');
var logger = require('../logger');
var crawlFlag = config.crawlFlag;
var updateFlag = config.updateFlag;
var site = 'huxiu';
var tags = [
  '早报',
  '今日嗅评',
  '娱见',
  '动见',
  '大话科技',
  '移动观察',
];
var subscriptions = [
  {tname:'看点', tid:'1', tags:tags},
  {tname:'观点', tid:'4', tags:tags},
  {tname:'读点', tid:'6', tags:tags},
];

var crawlerEvent = new EventEmitter();
crawlerEvent.on('onDetail', function (entry) {
  fetchDetail(entry);
});

var fetchDetail = function(entry) {
  var url = util.format('http://m.api.huxiu.com/article/%s?screen_size=720&client_ver=5&platform=Android&mid=', entry.aid);
  var headers = {
    'User-Agent': 'Apache-HttpClient/UNAVAILABLE (java 1.4)',
    'Host': 'm.api.huxiu.com',
    'Connection': 'Keep-Alive'
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
    if (!json || !utils.hasKeys(json, ['content', 'result']) || !utils.hasKeys(json.content, ['content', 'summary'])) {
      logger.warn('Invalid json data in %s', url);
      return;
    }

    News.findOne(utils.genFindCmd(site, entry.aid), function(err, result) {
      if (err) {
        return;
      }
      if (result) {
        if (updateFlag) {
          entry.updateFlag = 1;
        } else {
          return;
        }
      }
      var jObj = json.content;
      var obj = {};
      obj.docid = utils.encodeDocID(site, entry.aid);
      obj.site = site;
      obj.link = jObj.url || util.format('http://www.huxiu.com/article/%s/1.html', entry.aid);
      obj.title = entry.title;
      var t1 = moment(parseInt(jObj.dateline, 10) * 1000);
      var t2 = moment(parseInt(entry.dateline, 10) * 1000);
      var t3 = moment(parseInt(entry.updateline, 10) * 1000);
      var ptime = t1.isValid() ? t1 : (t2.isValid() ? t2 : t3);
      if (!ptime.isValid()) {
        logger.warn('Invalid time in %s', url);
        return;
      }
      obj.time = ptime.toDate();
      obj.created = new Date();
      obj.views = entry.updateFlag ? result.views : 1;
      obj.tags = entry.tagName;
      obj.digest = jObj.summary;
      obj.marked = jObj.content.replace(/\r\n/g, '<br />').replace(/\r/g, '<br />').replace(/\n/g, '<br />');
      obj.cover = entry.img || jObj.img || jObj.pic;

      logger.log('[%s]%s, docid=[%s]->[%s]', obj.tags, obj.title, entry.aid, obj.docid);
      if (entry.updateFlag) {
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
};

var fetchSubscription = function (entry) {
  var url = util.format('http://m.api.huxiu.com/portal/%s/%d?client_ver=5&platform=Android&mid=', entry.tid, entry.page);
  var headers = {
    'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.1.1; MI 2 MIUI/JLB34.0)',
    'Host': 'm.api.huxiu.com',
    'Connection': 'Keep-Alive'
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
    if (!json || !utils.hasKeys(json, ['content', 'result'])) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json.content;
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['title', 'aid'])) {
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.title, entry);
      if (!newsEntry.tagName) {
        return;
      }
      News.findOne(utils.genFindCmd(site, newsEntry.aid), function(err, result) {
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
        crawlerEvent.emit('onDetail', newsEntry);
      });
    });
    if (entry.crawlFlag) {
      if ((entry.page === 1) || (newsList.length === entry.pageSize)) {
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
    entry.pageSize = 20;
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
