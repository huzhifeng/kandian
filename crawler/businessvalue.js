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
var site = 'businessvalue';
var headers = {
  'User-Agent':'android-async-http/1.4.4 (http://loopj.com/android-async-http)',
  'APP_KEY': '38e232e936c33ac8a378fb1820c66a04',
  'Host': 'api.businessvalue.com.cn',
  'Connection': 'Keep-Alive',
};
var subscriptions = [
  {tname: '首页', tid: 0, tags: ['今日看点', '周末荐书']},
];

var crawlerEvent = new EventEmitter();
crawlerEvent.on('onDetail', function (entry) {
  fetchDetail(entry);
});

var fetchDetail = function(entry) {
  var url = util.format('http://api.businessvalue.com.cn/rest/v2/archives/%s?encode=GB18030&is_cached=false&user_guid=0&session_id=&device=androidApp&paragraph_image_width=%5B%22720%22%2C%22original%22%5D&banner=%5B%22720%22%2C%22original%22%5D&market_id=xiaomi&agent=android+MI+2+4.1.1&entity_guid=%s', entry.entity_guid, entry.entity_guid);
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
    if (!json || !utils.hasKeys(json, ['headline', 'entity_guid', 'paragraphs', 'summaries'])) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    if (!_.isArray(json.paragraphs) || _.isEmpty(json.paragraphs)) {
      logger.warn('Invalid body in %s', url);
      return;
    }
    if (!_.isArray(json.summaries) || _.isEmpty(json.summaries)) {
      logger.warn('Invalid digest in %s', url);
      return;
    }

    News.findOne(utils.genFindCmd(site, entry.entity_guid), function(err, result) {
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
      var jObj = json;
      var obj = {};
      obj.docid = utils.encodeDocID(site, entry.entity_guid);
      obj.site = site;
      obj.link = jObj.external_link || util.format('http://content.businessvalue.com.cn/post/%s.html', entry.entity_guid);
      obj.title = entry.headline;
      var t1 = moment(parseInt(jObj.time_created, 10) * 1000);
      var t2 = moment(parseInt(entry.time_created, 10) * 1000);
      var t3 = moment(parseInt(entry.edit_date, 10) * 1000);
      var ptime = t1.isValid() ? t1 : (t2.isValid() ? t2 : t3);
      if (!ptime.isValid()) {
        logger.warn('Invalid time in %s', url);
        return;
      }
      obj.time = ptime.toDate();
      obj.created = new Date();
      obj.views = entry.updateFlag ? result.views : 1;
      obj.tags = entry.tagName;
      obj.digest = jObj.summaries.join();
      if (_.has(jObj, 'banner') && _.has(jObj.banner, 'original')) {
        obj.marked = utils.genLazyLoadHtml('', jObj.banner.original.url);
        obj.cover = _.has(jObj.banner, '720') ? jObj.banner['720'].url : jObj.banner.original.url;
      }
      obj.marked += '<h2>浓缩观点</h2>';
      _.each(jObj.summaries, function(summary, i, summaries) {
        obj.marked += summary + '<hr>';
      });
      _.each(jObj.paragraphs, function(paragraph, i, paragraphs) {
        if (!utils.hasKeys(paragraph, ['paragraph_header', 'paragraph_body']) || (!paragraph.paragraph_header && !paragraph.paragraph_body)) {
          return;
        }
        obj.marked += '<br /><h3>' + paragraph.paragraph_header + '</h3>';
        if (utils.hasKeys(paragraph.paragraph_image, ['original', '720'])) {
          obj.marked += utils.genLazyLoadHtml(paragraph.paragraph_header, paragraph.paragraph_image.original.url);
          if (!obj.cover) {
            obj.cover = paragraph.paragraph_image['720'].url;
          }
        }
        obj.marked += paragraph.paragraph_body
      });
      obj.marked = obj.marked.replace(/\r\n/g, '<br />').replace(/\r/g, '<br />').replace(/\n/g, '<br />');

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
  var url = 'http://api.businessvalue.com.cn/rest/v2/archives/?' +
            'encode=GB18030&orderby=recent&sort=DESC&user_guid=0&session_id=' +
            '&device=androidApp&subtypes=%5B%22article%22%5D' +
            util.format('&offset=%d&market_id=xiaomi&agent=android+MI+2+4.1.1&limit=%d',
                        entry.page * entry.pageSize, entry.pageSize);
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
    if (!json || !utils.hasKeys(json, ['item_total_rows', 'items'])) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json.items;
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['headline', 'entity_guid'])) {
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.headline, entry);
      if (!newsEntry.tagName) {
        return;
      }
      News.findOne(utils.genFindCmd(site, newsEntry.entity_guid), function(err, result) {
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
    entry.page = 0;
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
