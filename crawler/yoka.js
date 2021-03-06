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
var headers = {
  'User-Agent':'Apache-HttpClient/UNAVAILABLE (java 1.4)',
  'Content-Type': 'application/x-www-form-urlencoded',
  'ha': '110129113',
  'ham': 'WIFI',
  'hc': '800',
  'hi': '151',
  'hmd': 'MI+2',
  'hsv': '4.1.1',
  'hsz': '%7B720%7D*%7B1280%7D',
  'hu': '1c4787be-ad82-4d4b-a2f0-63847c48e76a',
  'hv': '1.4.0',
  'Connection': 'Keep-Alive',
  'Host': 'mobservices3.yoka.com',
};
var site = 'yoka';
var yokaTags = [
  '笑到抽筋',
  '明星皆为微博狂',
  '看图说事',
  '家里造',
  '排行榜',
  '盘点',
  '星扒客',
  '星私录',
  '达人晒',
];
var subscriptions = [
  {tname: '精华', tid: 12, tags: yokaTags},
  //{tname: '时装', tid: 2, tags: yokaTags},
  //{tname: '美容', tid: 1, tags: yokaTags},
  //{tname: '明星', tid: 6, tags: yokaTags},
  //{tname: '男人', tid: 13, tags: yokaTags},
  //{tname: '生活', tid: 3, tags: yokaTags},
  //{tname: '奢品', tid: 9, tags: yokaTags},
];

var crawlerEvent = new EventEmitter();
crawlerEvent.on('onDetail', function (entry) {
  fetchDetail(entry);
});

var fetchDetail = function(entry) {
  var url = 'http://mobservices3.yoka.com/service.ashx';
  headers.hi = '152';
  var req = {
    uri: url,
    method: 'POST',
    headers: headers,
    form: {aid: entry.ID}//util.format('aid=%s',entry.ID)
  };
  if (config.proxyEnable) {
    req.proxy = config.proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = utils.parseJSON(err, res, body);
    if (!json || !utils.hasKeys(json, ['Contents', 'State']) || !utils.hasKeys(json.Contents, ['Title', 'Data'])) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    if (!_.isArray(json.Contents.Data) || _.isEmpty(json.Contents.Data)) {
      logger.warn('Invalid body in %s', url);
      return;
    }
    News.findOne(utils.genFindCmd(site, entry.ID), function(err, result) {
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
      var jObj = json.Contents;
      var obj = {};
      obj.docid = utils.encodeDocID(site, entry.ID);
      obj.site = site;
      obj.link = jObj.ShareUrl || util.format('http://3g.yoka.com/m/id%s', entry.ID);
      obj.title = entry.Title;
      var t1 = moment(jObj.ShowTime);
      var t2 = moment(jObj.ArticleTime);
      var t3 = moment(jObj.CreationTime);
      var ptime = t1.isValid() ? t1 : (t2.isValid() ? t2 : t3);
      if (!ptime.isValid()) {
        logger.warn('Invalid time in %s', url);
        return;
      }
      obj.time = ptime.toDate();
      obj.created = new Date();
      obj.views = entry.updateFlag ? result.views : 1;
      obj.tags = entry.tagName;
      obj.cover = entry.Image;
      obj.marked = entry.Summary;
      _.each(jObj.Data, function(data, i, datas) {
        if (!_.isString(data.Content) || _.isEmpty(data.Content)) {
          return;
        }
        // Content=[img]http://modp2.yokacdn.com/pic/2014/08/14/edb38680e63f441f8c9de746b26c2a70.jpg[/img]
        var pattern = /\[img\](http:[^\[]+)\[\/img\]/i;
        obj.marked += data.Content.replace(pattern, function(match, src) {
          if (!obj.cover) {
            obj.cover = src;
          }
          return utils.genLazyLoadHtml('', src);
        });
      });
      obj.marked = obj.marked.replace(/\r\n/g, '<br />').replace(/\r/g, '<br />').replace(/\n/g, '<br />');
      obj.digest = utils.genDigest(obj.marked);

      logger.log('[%s]%s, docid=[%s]->[%s]', obj.tags, obj.title, entry.ID, obj.docid);
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
  var url = 'http://mobservices3.yoka.com/service.ashx';
  var formData = {
    count: entry.pageSize,
    cateid: entry.tid,
    previd: entry.page
  };
  headers.hi = '151';
  var req = {
    uri: url,
    method: 'POST',
    headers: headers,
    form: formData//util.format('count=%d&cateid=%d&arttime=0&previd=%s', entry.pageSize, entry.tid, entry.page)
  };
  if (config.proxyEnable) {
    req.proxy = config.proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = utils.parseJSON(err, res, body);
    if (!json || !utils.hasKeys(json, ['Contents', 'State']) || !utils.hasKeys(json.Contents, ['Data', 'TotalCount'])) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json.Contents.Data;
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['Title', 'ID', 'Summary'])) {
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.Title, entry) || utils.findTagName(newsEntry.Summary, entry);
      if (!newsEntry.tagName) {
        return;
      }
      News.findOne(utils.genFindCmd(site, newsEntry.ID), function(err, result) {
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
      if (newsList.length === entry.pageSize) {
        entry.page = _.last(newsList).ID;
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
