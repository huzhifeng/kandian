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
  'User-Agent': 'MI_2__sinanews__4.0.1__android__os4.1.1',
  'Host': 'api.sina.cn',
  'Connection': 'Keep-Alive',
};
var site = 'sina';
var subscriptions = [
  {
    tname:'头条',
    tid:'news_toutiao',
    tags:[
      '新观察',
      '万花筒', // 2013-08-15 停止更新
      '新历史', // 2014-01-18 停止更新
      '今日网言', // 2013-12-13 停止更新
      '海外观察', // 2014-01-31 停止更新
      '军情茶馆', // 2013-06-21 停止更新
      '每日深度', // 2013-12-19 停止更新
      '一周八卦', // 2014-01-12 停止更新
      '茶娱饭后',
      '新闻早点',
      '图解天下',
    ]
  },
  // 新浪订阅管理 // 2014-02-21 停止更新
  {
    tname:'搞笑',
    tid:'news_funny',
    tags:[
      '神最右',
      '囧哥说事',
      '囧哥囧事', // 2013-12-27 停止更新
      '图哥乐呵',
      '一日一囧',
      '奇趣壹周', // 2014-02-07 停止更新
      '逗妹吐槽',
      '段子PK秀',
      '搞笑精选',
      '新闻乐轻松', // 2014-03-07 停止更新
      '毒舌美少女',
      '一周搞笑精选',
    ]
  },
  //{tname:'数码', tid:'news_digital', tags:[]},
  //{tname:'时尚', tid:'news_fashion', tags:[]},
  //{tname:'星座', tid:'news_ast', tags:[]},
  //{tname:'历史', tid:'news_history', tags:[]},
  //{tname:'女性', tid:'news_eladies', tags:[]},
  //{tname:'科技', tid:'news_tech', tags:[]},
  //{tname:'体育', tid:'news_sports', tags:[]},
  //{tname:'财经', tid:'news_finance', tags:[]},
  //{tname:'娱乐', tid:'news_ent', tags:[]},
  //{tname:'军事', tid:'news_mil', tags:[]},
  //{tname:'专栏', tid:'zhuanlan_recommend', tags:[]},
  // 新浪图片
  {tname:'图片.精选', tid:'hdpic_toutiao', tags:[]},
  {tname:'图片.趣图', tid:'hdpic_funny', tags:[]},
  {tname:'图片.美图', tid:'hdpic_pretty', tags:[]},
  {tname:'图片.故事', tid:'hdpic_story', tags:[]},
  // 新浪视频
  //{tname:'视频.精选', tid:'video_video', tags:[]},
  //{tname:'视频.搞笑', tid:'video_funny', tags:[]}, // TODO 自2014-02-10起, 视频地址跳转多次导致JwPlayer无法播放
  //{tname:'视频.现场', tid:'video_scene', tags:[]},
  //{tname:'视频.花絮', tid:'video_highlight', tags:[]},
];

var crawlerEvent = new EventEmitter();

crawlerEvent.on('onDetail', function (entry) {
  fetchDetail(entry);
});

var fetchDetail = function(entry) {
  var docid = util.format('%s',entry.id);
  var url = util.format('http://api.sina.cn/sinago/article.json?id=%s', docid);
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
    if (!json ||
        (json.status == -1) ||
        !_.has(json, 'data') ||
        !utils.hasKeys(json.data, ['id', 'title', 'content'])) {
      logger.warn('Invalid json data %j in %s', json, url);
      return;
    }
    var jObj = json.data;
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
      obj.link = jObj.link || entry.link || '';
      obj.title = entry.title || jObj.title || jObj.long_title || entry.long_title;
      var t1 = moment(parseInt(entry.pubDate, 10) * 1000);
      var t2 = moment(parseInt(jObj.pubDate, 10) * 1000);
      var ptime = t1.isValid() ? t1 : t2;
      if (!ptime.isValid()) {
        logger.warn('Invalid time in %s', url);
        return;
      }
      obj.time = ptime.toDate();
      obj.marked = jObj.content;
      obj.cover = entry.pic;
      if (_.isArray(jObj.pics) && !_.isEmpty(jObj.pics)) {
        _.each(jObj.pics, function(img, i, imgs) {
          if (!_.has(img, 'pic')) {
            logger.info('Invalid img data %j', img);
            return;
          }
          if (!obj.cover) {
            obj.cover = img.pic;
          }
          img.pic = img.pic.replace(/auto\.jpg/, 'original.jpg');
          var html = utils.genLazyLoadHtml(img.alt, img.pic) + img.alt + '<br/>';
          obj.marked = obj.marked.replace(util.format('<!--{IMG_%d}-->', i + 1), html);
        });
      }
      if (_.isArray(jObj.videos) && !_.isEmpty(jObj.videos)) {
        _.each(jObj.videos, function(v, i, videos) {
          if (!utils.hasKeys(v, ['video_id', 'pic', 'url'])) {
            logger.info('Invalid video data %j', v);
            return;
          }
          if (!obj.cover) {
            obj.cover = v.pic;
          }
          if (!obj.hasVideo) {
            obj.hasVideo = 1;
          }
          var html = util.format('<a href="%s" target="_blank">%s</a><br/>', v.url, jObj.long_title || jObj.title);
          if (utils.isAudioVideoExt(v.url)) {
            v.pic = v.pic.replace(/auto\.jpg/, 'original.jpg');
            html += utils.genJwPlayerEmbedCode(util.format('vid_%s', v.video_id), v.url, v.pic, i === 0);
          }
          obj.marked = obj.marked.replace(util.format('<!--{VIDEO_%d}-->', i + 1), html);
        });
      }
      obj.created = new Date();
      obj.views = entry.updateFlag ? result.views : 1;
      obj.tags = entry.tagName;
      obj.digest = utils.genDigest(jObj.content);

      logger.log('[%s]%s, docid=[%s]->[%s]', obj.tags, obj.title, docid, obj.docid);
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
  var url = util.format('http://api.sina.cn/sinago/list.json?channel=%s&p=%d', entry.tid, entry.page);
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
    if (!json || !_.has(json, 'data') || !_.has(json.data, 'list')) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json.data.list;
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['id', 'title'])) {
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.title, entry) ||
                          utils.findTagName(newsEntry.long_title, entry);
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
        crawlerEvent.emit('onDetail', newsEntry);
      });
    });
    if (entry.crawlFlag) {
      if (newsList.length >= 10) {
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
