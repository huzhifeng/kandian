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
  'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.1.1; MI 2 MIUI/JLB5.0)',
  'Host': 'api.3g.ifeng.com',
  'Connection': 'Keep-Alive',
};
var site = 'ifeng';
var subscriptions = [
  {
    tname: '头条',
    tid: '1',
    tags: [
      '洞见',
      '独家评',
      '轻新闻',
      '真相80',
      '独家图表',
      '百部穿影',
      '科技能见度',
      '历史上的今天',
    ],
    stopped: 1
  },
  // 凤凰独家栏目列表,目前共20个,可以指定pagesize为50一次返回
  // http://api.3g.ifeng.com/channel_list_android?channel=origin&pageindex=1&pagesize=50
  // http://api.3g.ifeng.com/channel_list_android?channel=origin&pagesize=10&pageindex=1&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  // 某一栏目文章列表,默认每次返回20条记录,可以指定pageindex(如&pageindex=2)和pagesize(如&pagesize=40)自定义返回
  // http://api.3g.ifeng.com/origin_doc_list?id=16908&pageindex=1&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  // 某一栏目文章列表新版接口
  // http://api.3g.ifeng.com/android2GList?id=aid=ORIGIN16908&type=list&pagesize=20
  // http://api.3g.ifeng.com/android2GList?id=aid=ORIGIN16908&type=list&pagesize=20&pageindex=1
  // 某篇文章内容
  // http://api.3g.ifeng.com/ipadtestdoc?imgwidth=100&aid=imcp_80779130&channel=push&chid=push&android=1&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  {tname: 'FUN来了', tid: '16917', tags: []},
  {tname: '凤凰知道', tid: '17594', tags: []},
  {tname: '今日最大声', tid: '17593', tags: []},
  {tname: '军魂100分', tid: '18316', tags: []},
  {tname: '史林拍案', tid: '18505', tags: []},
  {tname: '一周人物', tid: '18026', tags: []},
  {tname: '热追踪', tid: '19349', tags: []},
  {tname: '财知道', tid: '19355', tags: [], stopped: 1},
  {tname: '防务短评', tid: '19593', tags: []},
  {tname: '独家体育评论', tid: '19352', tags: []},
  {tname: '情感夜话', tid: '21702', tags: [], stopped: 1},
  {tname: '大学问', tid: '19347', tags: [], stopped: 1},
  {tname: '话说', tid: '18017', tags: [], stopped: 1},
  {tname: '专家谈', tid: '19350', tags: [], stopped: 1},
  {tname: '精英范', tid: '19348', tags: [], stopped: 1},
  {tname: '年代访', tid: '19354', tags: [], stopped: 1},
  {tname: '观世变', tid: '19353', tags: [], stopped: 1},
  {tname: '自由谈', tid: '19346', tags: [], stopped: 1},
  {tname: '非常道', tid: '19356', tags: [], stopped: 1},
  {tname: '健康365', tid: '21701', tags: [], stopped: 1},
  {tname: '有报天天读', tid: '16908', tags: [], stopped: 1},
  {tname: '锵锵三人行', tid: '19357', tags: [], stopped: 1},
  // 非新闻
  // http://api.3g.ifeng.com/iosNews?id=YC10&page=1&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  // http://api.3g.ifeng.com/iosNews?id=YC10&page=2&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  {tname: '非新闻', tid: 'YC10', tags: ['洋跟帖']},
  // 自媒体
  // http://api.3g.ifeng.com/iosNews?id=ZMT10&page=1&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  // http://api.3g.ifeng.com/iosNews?id=ZMT10&page=2&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
];

var crawlerEvent = new EventEmitter();

crawlerEvent.on('onDetail', function (entry) {
  fetchDetail(entry);
});

var fetchDetail = function(entry) {
  // http://api.3g.ifeng.com/ipadtestdoc?imgwidth=100&aid=imcp_80779130&channel=push&chid=push&android=1&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  // http://api.3g.ifeng.com/ipadtestdoc?aid=74868287&channel=%E6%96%B0%E9%97%BB
  // http://api.3g.ifeng.com/ipadtestdoc?aid=74868287
  // http://api.3g.ifeng.com/ipadtestdoc?aid=imcp_74868287
  var docid = util.format('%s',entry.documentId);
  var url = entry.id;
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
    if (!json || !_.has(json, 'body') || !_.has(json.body, 'text')) {
      logger.warn('Invalid json data %j in %s', json, url);
      return;
    }
    var jObj = json.body;
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
      obj.link = jObj.wapurl || jObj.wwwurl || jObj.shareurl || util.format('http://i.ifeng.com/news?aid=%s', docid);
      obj.title = entry.title || jObj.title;
      var t1 = moment(entry.updateTime);
      var t2 = moment(jObj.editTime);
      var t3 = moment(entry.editTime);
      var ptime = t1.isValid() ? t1 : (t2.isValid() ? t2 : t3);
      if (!ptime.isValid()) {
        logger.warn('Invalid time in %s', url);
        return;
      }
      obj.time = ptime.toDate();
      obj.cover = entry.thumbnail || jObj.thumbnail || '';
      obj.marked = '';
      if (_.isArray(jObj.videos) && !_.isEmpty(jObj.videos)) {
        _.each(jObj.videos, function(v, i, videos) {
          if (!utils.hasKeys(v, ['guid', 'thumbnail', 'video'])) {
            logger.info('Invalid video data %j', v);
            return;
          }
          if (!obj.cover) {
            obj.cover = v.thumbnail;
          }
          obj.marked += utils.genJwPlayerEmbedCode(util.format('vid_%s', v.guid),
            v.video.HD.src || v.video.Normal.src, v.thumbnail, i === 0);
          if (!obj.hasVideo) {
            obj.hasVideo = 1;
          }
        });
      }
      if (_.has(jObj, 'audio') && _.has(jObj.audio, 'url') && !_.isEmpty(jObj.audio.url) && utils.isAudioVideoExt(jObj.audio.url)) {
        obj.marked += utils.genJwPlayerEmbedCode(docid, jObj.audio.url, obj.cover, 1);
      }
      obj.marked += jObj.text.replace(/width=["']140["']/g, '');
      obj.created = new Date();
      obj.views = entry.updateFlag ? result.views : 1;
      obj.tags = entry.tagName;
      obj.digest = utils.genDigest(jObj.text);

      logger.log('[%s]%s, docid=[%s]->[%s]', obj.tags, obj.title, docid, obj.docid);
      if (entry.updateFlag) {
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
        });
      }
    });
  });
};

var fetchSubscription = function (entry) {
  var url = util.format('http://api.3g.ifeng.com/android2GList?id=aid=ORIGIN%s&type=list&pagesize=20&pageindex=%d', entry.tid, entry.page);
  if (entry.tid === '1') { // 头条
    url = util.format('http://api.3g.ifeng.com/iosNews?id=SYLB10,SYDT10&page=%d&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005', entry.page);
  }else if (entry.tid === 'YC10') { // 非新闻
    url = util.format('http://api.3g.ifeng.com/iosNews?id=YC10&page=%d&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005', entry.page);
  }
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
    if (!_.isArray(json) ||
        _.isEmpty(json) ||
        !_.has(json[0], 'body') ||
        !_.has(json[0].body, 'item')) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json[0].body.item;
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['documentId', 'title'])) {
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.title, entry);
      if (!newsEntry.tagName) {
        return;
      }
      News.findOne(utils.genFindCmd(site, newsEntry.documentId), function(err, result) {
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
      if (newsList.length === 20) {
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

var fetchSubscriptions = function() {
  subscriptions.forEach(function(entry) {
    if (entry.stopped && !entry.crawlFlag) {
      return;
    }
    entry.page = 1;
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
