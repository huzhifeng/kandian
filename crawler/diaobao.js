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
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': 'Apache-HttpClient/UNAVAILABLE (java 1.4)',
  'Host': 'api.diaobao.in',
  'Connection': 'Keep-Alive',
};
var site = 'diaobao';
var diaobaoSubscribes = [
  {tname:'人性实验', tid:'78207', tags:[]},
  {tname:'每日囧图', tid:'16', tags:[]},
  {tname:'碉民早爆', tid:'5', tags:[]},
  {tname:'每日一撸', tid:'8', tags:[]},
  {tname:'十万个冷知识', tid:'9', tags:[]},
  {tname:'帅哥暖床图', tid:'139', tags:[]},
  {tname:'美女醒床图', tid:'47', tags:['美女醒床图']},
  {tname:'碉堡微小说', tid:'140', tags:[]},
  {tname:'波涛汹涌', tid:'23', tags:[], stopped: 1},
  {tname:'浑圆臀地', tid:'24', tags:[], stopped: 1},
];

var startGetDetail = new EventEmitter();
startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

var getNewsDetail = function(entry) {
  var docid = util.format('%s',entry.id);
  var url = util.format('http://api.diaobao.in/index.php/post/view/%s?uid=0&scroll-src=1', docid);
  var req = {
    uri: url,
    method: 'GET',
    headers: headers
  };
  if (proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    if (!_.isString(body) || _.isEmpty(body)) {
      logger.warn('Invalid body in %s', url);
      return;
    }
    var json = utils.parseJSON(err, res, body.slice(1));  // 正文前三个字节 EF BB BF 应该是干扰码, slice(1) 忽略即可
    if (!json ||
        !utils.hasKeys(json, ['data', 'status']) ||
        (json.status != 0) ||
        !_.has(json.data, 'detail') ||
        !utils.hasKeys(json.data.detail, ['id', 'title', 'des', 'content'])) {
      logger.warn('Invalid json data %j in %s', url);
      return;
    }
    var jObj = json.data.detail;
    var obj = {};

    News.findOne(utils.genFindCmd(site, docid), function(err, result) {
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
      obj.docid = utils.encodeDocID(site, docid);
      obj.site = site;
      obj.link = jObj.articleUrl || entry.shareUrl || util.format('http://api.diaobao.in/index.php/post/v/%s', docid);
      obj.title = entry.title || jObj.title;
      var t1 = moment(parseInt(entry.publish_time, 10) * 1000);
      var t2 = moment(parseInt(jObj.publish_time, 10) * 1000);
      var ptime = t1.isValid() ? t1 : t2;
      if (!ptime.isValid()) {
        logger.warn('Invalid time in %s', url);
        return;
      }
      obj.time = ptime.toDate();
      obj.created = new Date();
      obj.views = entry.updateFlag ? result.views : 1;
      obj.tags = entry.tagName;
      obj.marked = jObj.content.replace(/scroll-src/g, 'src'); // TODO LazyLoad
      obj.digest = jObj.des.slice(0,300) || utils.genDigest(jObj.content);
      obj.cover = '';
      if (_.isArray(entry.images) && !_.isEmpty(entry.images) && _.has(entry.images[0], 'imgUrl')) {
        obj.cover = entry.images[0].imgUrl;
      }
      else if (_.isArray(jObj.images) && !_.isEmpty(jObj.images)  && _.has(jObj.images[0], 'imgUrl')) {
        obj.cover = jObj.images[0].imgUrl;
      }

      if (!obj.marked && !obj.digest) {
        logger.warn('Invalid detail %j in %s', jObj, url);
        return;
      }

      logger.log('[%s]%s, docid=[%s]->[%s],updateFlag=%d', obj.tags, obj.title, docid, obj.docid, entry.updateFlag);
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

var crawlerSubscribe = function (entry) {
  var url = util.format('http://api.diaobao.in/index.php/topic/articles?topic_id=%s&begin=%d&size=%d&access_token=f9f4f05d1fb4d556ba8b6d75fa1b721f', entry.tid, entry.page * entry.pageSize, entry.pageSize);
  var req = {
    uri: url,
    method: 'GET',
    headers: headers
  };
  if (proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    if (!_.isString(body) || _.isEmpty(body)) {
      logger.warn('Invalid body in %s', url);
      return;
    }
    var json = utils.parseJSON(err, res, body.slice(1)); // 正文前三个字节 EF BB BF 应该是干扰码, slice(1) 忽略即可
    if (!json || !utils.hasKeys(json, ['data', 'status']) || (json.status != 0)) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json.data;
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', res ? res.request.href : url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['title', 'id'])) {
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.title, entry);
      if (!newsEntry.tagName) {
        return;
      }
      News.findOne(utils.genFindCmd(site, newsEntry.id), function(err, result) {
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
        startGetDetail.emit('startGetNewsDetail', newsEntry);
      });
    });
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
  });
};

var crawlerDiaobaoSubscribes = function () {
  diaobaoSubscribes.forEach(function(entry) {
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
  crawlerDiaobaoSubscribes();
  setTimeout(main, config.crawlInterval);
}

var init = function() {
  if (process.argv[2] == 1) {
    crawlFlag = 1;
  }
  diaobaoSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
}

exports.main = main;
exports.diaobaoTags = diaobaoSubscribes;
init();
main();
