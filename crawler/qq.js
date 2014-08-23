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
  'User-Agent': '%E8%85%BE%E8%AE%AF%E6%96%B0%E9%97%BB342(android)',
  'Host': 'r.inews.qq.com',
  'Connection': 'Keep-Alive',
};
var site = 'qq';
var newsSubscriptions = [
  //腾讯原创栏目
  {tname: '新闻晚8点', tid: '94', tags: []},
  {tname: '新闻哥', tid: '1033', tags: []},
  {tname: '短史记', tid: '1783', tags: []},
  {tname: '今日话题', tid: '41', tags: []},
  {tname: '新闻百科', tid: '39', tags: []},
  {tname: '讲武堂', tid: '47', tags: []},
  {tname: '活着', tid: '35', tags: []},
  {tname: '科技不怕问', tid: '1597', tags: []},
  {tname: 'TMT解码', tid: '1780', tags: []},
  {tname: '启示录', tid: '1779', tags: [], stopped: 1},
  {tname: '所谓娱乐', tid: '1451', tags: []},
  {tname: '凡人观时尚', tid: '1804', tags: []},
  {tname: '图话', tid: '55', tags: []},
  {tname: '存照', tid: '49', tags: []},
  {tname: '中国人的一天', tid: '37', tags: []},
  {tname: '天天看', tid: '44', tags: [], stopped: 1}, // Video
  {tname: '文化观察', tid: '1258', tags: []},
  {tname: '腾讯大家', tid: '45', tags: []},
  {tname: '腾讯道学', tid: '1839', tags: []},
  {tname: '腾讯佛学', tid: '1420', tags: []},
  {tname: '腾讯儒学', tid: '1840', tags: []},
  {tname: '腾讯思享会', tid: '1243', tags: []},
  {tname: '腾讯精品课', tid: '1432', tags: []}, // Video
  {tname: '腾讯育儿宝典', tid: '1328', tags: []},
];
var otherSubscriptions = [
  {tname: '贵圈', tid: '32', tags: []},
  {tname: '封面人物', tid: '33', tags: []},
  {tname: '财经眼', tid: '54', tags: []}, // Video
  {tname: '金错刀', tid: '1032', tags: ['每日一干', '独家干']},
  {tname: '趣你的', tid: '1354', tags: []},
  {tname: '骂人宝典', tid: '1338', tags: []},
  {tname: '冷知识', tid: '1478', tags: []}, // Video
  {tname: '捧腹网', tid: '1796', tags: []},
  {tname: '网络新闻联播', tid: '1681', tags: []},
  {tname: '生活家', tid: '1386', tags: []}, // Video
  {tname: '家有萌宝', tid: '1268', tags: []}, // Video
  {tname: '百思不得姐', tid: '1838', tags: []},
];
var photoSubscriptions = [
  {tname: '精选', tid: 'news_photo', tags: ['一周', '脸谱', '去年今日', '影像记忆', '春运', '图刊', '年度', '盘点', '图片故事']},
  {tname: '娱乐', tid: 'news_photo_yl', tags: ['底片', '趣图', '娱图', '一周', ]},
  //{tname: '美女', tid: 'news_photo_mn', tags: []},
  //{tname: '奇趣', tid: 'news_photo_qiqu', tags: ['盘点']},
  //{tname: '摄影', tid: 'news_photo_sy', tags: []},
];

var crawlerEvent = new EventEmitter();

crawlerEvent.on('onDetail', function (entry) {
  fetchDetail(entry);
});

var genVideoPlayerHtml = function(vid) {
  // swf播放器地址
  // http://static.video.qq.com/TPout.swf?auto=1&vid=y0013oow0k2
  // html代码
  // <embed src="http://static.video.qq.com/TPout.swf?auto=1&vid=y0013oow0k2" quality="high" width="460" height="372" align="middle" allowScriptAccess="sameDomain" allowFullscreen="true" type="application/x-shockwave-flash"></embed>
  // 页面地址
  // http://v.qq.com/page/y/k/2/y0013oow0k2.html
  var html = util.format('<p><embed src="http://static.video.qq.com/TPout.swf?auto=1&vid=%s" quality="high" width="460" height="372" align="middle" allowScriptAccess="sameDomain" allowFullscreen="true" type="application/x-shockwave-flash"></embed></p>', vid);
  html += util.format('</br><a href="http://v.qq.com/page/y/k/2/%s.html" target="_blank">传送门</a></br>', vid);
  return html;
}

var fetchDetail = function(entry) {
  // http://r.inews.qq.com/getSubNewsContent?id=20131129A000H600&qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&appver=16_android_3.2.1
  var subscribeNewsDetailLink = 'http://r.inews.qq.com/getSubNewsContent?id=%s&qqnetwork=wifi&qn-rid=515897579&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&qn-sig=6839f4724164cda53c18d93f882ca729&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&imsi=460001112558692&apptype=android&appver=16_android_3.3.0';
  var docid = util.format('%s',entry.id);
  var url = util.format(subscribeNewsDetailLink, docid);
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
    if (!json || (json.ret != 0) ||
        !utils.hasKeys(json, ['id', 'content', 'attribute'])) {
      logger.warn('Invalid json data %j in %s', json, url);
      return;
    }
    var jObj = json;
    var obj = {};

    News.findOne(utils.genFindCmd(site, entry.id), function(err, result) {
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
      obj.link = entry.url || jObj.url || jObj.surl || util.format('http://view.inews.qq.com/a/%s', entry.id);
      obj.title = entry.title;
      var t1 = moment(entry.time);
      var t2 = moment(parseInt(entry.timestamp, 10) * 1000);
      var ptime = t1.isValid() ? t1 : t2;
      if (!ptime.isValid()) {
        logger.warn('Invalid time in %s', url);
        return;
      }
      obj.time = ptime.toDate();
      obj.created = new Date();
      obj.views = entry.updateFlag ? result.views : 1;
      obj.tags = entry.tagName;
      obj.cover = '';
      if (_.isArray(entry.thumbnails) && !_.isEmpty(entry.thumbnails)) {
        obj.cover = entry.thumbnails[0];
      } else if (_.isArray(entry.thumbnails_big) && !_.isEmpty(entry.thumbnails_big)) {
        obj.cover = entry.thumbnails_big[0];
      } else if (_.isArray(entry.thumbnails_qqnews) && !_.isEmpty(entry.thumbnails_qqnews)) {
        obj.cover = entry.thumbnails_qqnews[0];
      } else if (_.isArray(entry.thumbnails_qqnews_photo) && !_.isEmpty(entry.thumbnails_qqnews_photo)) {
        obj.cover = entry.thumbnails_qqnews_photo[0];
      } else if (_.has(entry, 'chlsicon')) {
        obj.cover = entry.chlsicon;
      } else if (_.has(entry, 'chlicon')) {
        obj.cover = entry.chlicon;
      } else if (_.has(jObj, 'card') && _.has(jObj.card, 'icon')) {
        obj.cover = jObj.card.icon;
      }
      obj.marked = jObj.content.text.replace(/<!--H2-->/g, '<H4>').replace(/<!--\/H2-->/g, '</H4>');
      for (key in jObj.attribute) {
        var url = jObj.attribute[key].url || jObj.attribute[key].img;
        var html = '';
        if (key.indexOf('VIDEO') !== -1) {
          if (jObj.attribute[key].vid) {
            html = genVideoPlayerHtml(jObj.attribute[key].vid);
            if (!obj.hasVideo) {
              obj.hasVideo = 1;
            }
          }
        } else if (key.indexOf('IMG') !== -1) {
          html = utils.genLazyLoadHtml(entry.title, url);
        } else {
          continue;
        }
        if (jObj.attribute[key].desc) {
          html = html + jObj.attribute[key].desc + '<br/>';
        }
        if (!obj.cover) {
          obj.cover = url;
        }
        obj.marked = obj.marked.replace(util.format('<!--%s-->', key), html);
      }
      obj.digest = utils.genDigest(jObj.content.text) || utils.genDigest(obj.marked);

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

var fetchSubscription = function(entry) {
  var subscribeNewsIdsLink = 'http://r.inews.qq.com/getSubNewsIndex?qqnetwork=wifi&qn-rid=252257119&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&qn-sig=92be51a75e268df43aef4e7e1655a9f9&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&imsi=460001112558692&format=json&apptype=android&chlid=%s&appver=16_android_3.3.0';
  var subscribeNewsListLink = 'http://r.inews.qq.com/getSubNewsListItems?uid=22c4d53a-7d52-4f50-9185-90a77c7b80b0&qqnetwork=wifi&qn-rid=1085800932&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=%s&qn-sig=bc391588cf2d4aa75e2042e90822ba84&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&imsi=460001112558692&apptype=android&appver=16_android_3.3.0';
  var headlineLink = 'http://r.inews.qq.com/getQQNewsIndexAndItems?qqnetwork=wifi&qn-rid=209000533&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&qn-sig=4b3cfbeb1d30f935de9630698c586cd5&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&imsi=460001112558692&apptype=android&chlid=%s&appver=16_android_3.3.0';
  var headLineListLink = 'http://r.inews.qq.com/getQQNewsListItems?qn-rid=264249064&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=%s&qn-sig=2a14884f2a0e3cc02625c26931d8db9c&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&chlid=news_news_top&appver=16_android_3.3.0&qqnetwork=wifi&imsi=460001112558692&apptype=android';
  var photoLink = 'http://r.inews.qq.com/getQQNewsIndexAndItems?qqnetwork=wifi&qn-rid=359104299&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&qn-sig=92f5abdb0bf6ec98be397408639c3276&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&imsi=460001112558692&apptype=android&chlid=%s&appver=16_android_3.3.0';
  var photoListLink = 'http://r.inews.qq.com/getQQNewsListItems?qn-rid=125777722&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=%s&qn-sig=2fe55dd0f7d003bb1b8104dc0372130a&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&chlid=news_photo&appver=16_android_3.3.0&qqnetwork=wifi&imsi=460001112558692&apptype=android';

  var url = '';
  if (entry.ids && entry.ids.length) {
    var num = 20 < entry.ids.length ? 20 : entry.ids.length;
    var ids = '';
    var i = 0;
    for (i=0; i<num; i++) {
      if (i > 0) {
        ids = ids + ','
      }
      ids = ids + entry.ids[i].id;
    }
    if (entry.tid.indexOf('news_news') !== -1) {
      url = util.format(headLineListLink, ids);
    } else if (entry.tid.indexOf('news_photo') !== -1) {
      url = util.format(photoListLink, ids);
    } else {
      url = util.format(subscribeNewsListLink, ids);
    }
  } else {
    if (entry.tid.indexOf('news_news') !== -1) {
      url = util.format(headlineLink, entry.tid);
    } else if (entry.tid.indexOf('news_photo') !== -1) {
      url = util.format(photoLink, entry.tid);
    } else {
      url = util.format(subscribeNewsIdsLink, entry.tid);
    }
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
    if (!json || (json.ret != 0)) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json.newslist || json.idlist[0].newslist;
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', url);
      return;
    }

    if (entry.ids && entry.ids.length) {
      var num = 20 < entry.ids.length ? 20 : entry.ids.length;
      entry.ids = entry.ids.slice(num);
      if (entry.ids.length) {
        setTimeout(fetchSubscription, 100, entry);
      }
    } else if (entry.crawlFlag) {
      entry.crawlFlag = 0;
      if (json.ids && json.ids.length) {
        entry.ids = json.ids;
      } else if (json.idlist && json.idlist.length && json.idlist[0].ids && json.idlist[0].ids.length) {
        entry.ids = json.idlist[0].ids;
      } else {
        return;
      }
      setTimeout(fetchSubscription, 100, entry);
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
        crawlerEvent.emit('onDetail', newsEntry);
      });
    });
  });
}

var fetchSubscriptions = function () {
  var subscriptions = newsSubscriptions.concat(otherSubscriptions, photoSubscriptions);
  subscriptions.forEach(function(entry) {
    if (entry.stopped && !entry.crawlFlag) {
      return;
    }
    fetchSubscription(entry);
  });
}

var main = function() {
  logger.log('Start');
  newsSubscriptions.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
  otherSubscriptions.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
  photoSubscriptions.forEach(function(entry) {
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
exports.subscriptions = newsSubscriptions.concat(otherSubscriptions, photoSubscriptions);
