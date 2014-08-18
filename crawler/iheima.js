var util = require('util');
var request = require('request');
var _ = require('underscore');
var moment = require('moment');
var config = require('../config');
var News = require('../models/news');
var utils = require('../lib/utils')
var logger = require('../logger');
var crawlFlag = config.crawlFlag;
var updateFlag = config.updateFlag;
var site = 'iheima';
var tags = [
  '每日一黑马',
  '案例',
  '每日黑马',
  '挖黑马',
  '侃产品',
  '头条汇',
  '小败局',
  '独家分析',
  '创业说',
  '找灵感',
  '产品家',
  '挖黑马',
  '商业模式',
  'i黑马榜',
  '融资趋势',
  '大买家',
  '黑马YY',
];
var subscriptions = [
  {tname: '抄本质', tid: '100238521', tags: tags},
  {tname: '找灵感', tid: '100238528', tags: tags},
  {tname: '挖黑马', tid: '100238575', tags: tags},
  //{tname: '项目诊断', tid: '100238675', tags: tags},
  //{tname: '评热点', tid: '100185712', tags: tags},
  //{tname: '国外精选', tid: '100238826', tags: tags},
];

var fetchSubscription = function (entry) {
  var url = util.format('http://zhiyue.cutt.com/api/clip/items?clipId=%s&full=1&offset=%s&note=1', entry.tid, entry.page);
  var headers = {
    'app': '43',
    'device': 'aries',
    'Host': 'zhiyue.cutt.com',
    'Connection': 'Keep-Alive',
    'User-Agent': 'app43 2.0 (Xiaomi,MI 2; Android 4.1.1)'
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
    if (!json || !utils.hasKeys(json, ['articles', 'next'])) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json.articles;
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['title', 'id', 'content', 'articleTime', 'timestamp'])) {
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
        obj.link = newsEntry.url || newsEntry.cuttURL;
        obj.title = newsEntry.title;
        var t1 = moment(parseInt(newsEntry.articleTime, 10) * 1000);
        var t2 = moment(parseInt(newsEntry.timestamp, 10) * 1000);
        var ptime = t1.isValid() ? t1 : t2;
        if (!ptime.isValid()) {
          logger.warn('Invalid time in %s', url);
          return;
        }
        obj.time = ptime.toDate();
        obj.created = new Date();
        obj.views = newsEntry.updateFlag ? result.views : 1;
        obj.tags = newsEntry.tagName;
        if (newsEntry.imageId) {
          obj.cover = util.format('http://img1.cutt.com/img/%s', newsEntry.imageId);
        }
        obj.marked = '';
        if (newsEntry.note) {
          obj.marked += '<h2>浓缩观点</h2>'+newsEntry.note + '<br />';
        }
        obj.marked += newsEntry.content;
        obj.marked = obj.marked.replace(/\r\n/g, '<br />').replace(/\r/g, '<br />').replace(/\n/g, '<br />');
        if (_.isArray(newsEntry.imageIds) && !_.isEmpty(newsEntry.imageIds)) {
          _.each(newsEntry.imageIds, function(imageId, i, imageIds) {
            var imageTag = util.format('##zhiyueImageTag##%s##zhiyueImageTag##', imageId);
            var src = util.format('http://img1.cutt.com/img/%s', imageId);
            obj.marked = obj.marked.replace(imageTag, utils.genLazyLoadHtml('', src));
            if (!obj.cover) {
              obj.cover = src;
            }
          });
        }
        obj.digest = utils.genDigest(obj.marked);

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
      if (newsList.length === entry.pageSize && json.next != -1) {
        entry.page = json.next;
        logger.info('[%s] next page: %d', entry.tname, entry.page);
        setTimeout(fetchSubscription, 3000, entry);
      }else {
        logger.info('[%s] last page: %d', entry.tname, entry.page);
        entry.crawlFlag = 0;
      }
    }
  });
};

var fetchSubscriptions = function() {
  subscriptions.forEach(function(entry) {
    if (entry.stopped && !entry.crawlFlag) {
      return;
    }
    entry.page = 0;
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
