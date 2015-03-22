var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var SysUrl = require('url');
var _ = require('underscore');
var moment = require('moment');
var config = require('../config');
var News = require('../models/news');
var utils = require('../lib/utils');
var logger = require('../logger');
var crawlFlag = config.crawlFlag;
var updateFlag = config.updateFlag;
var headers = {
  'User-Agent': 'NTES Android',
  'Connection': 'Keep-Alive',
  'Host': 'c.m.163.com',
};
var site = 'netease';
// http://c.m.163.com/nc/topicset/android/v3/subscribe.html
var newsSubscriptions = [
  // 头条 // http://c.m.163.com/nc/article/headline/T1348647909107/0-20.html
  {tname: '头条', tid: 'T1348647909107', tags: ['新闻故事', '一周新闻日历', '科学搬主任'], stopped: 1},
  // 原创
  //{tname: '原创', tid: 'T1367050859308', tags: []},
  {tname: '轻松一刻', tid: 'T1350383429665', tags: []},
  //{tname: '轻松一刻语音版', tid: 'T1379040077136', tags: []},
  {tname: '另一面', tid: 'T1348654756909', tags: []},
  {tname: '今日之声', tid: 'T1348654628034', tags: []},
  {tname: '今日环球侃客', tid: 'T1381482353221', tags: []},
  {tname: '易百科', tid: 'T1355887570398', tags: []},
  {tname: '看客', tid: 'T1387970173334', tags: []},
  {tname: '娱乐BigBang', tid: 'T1359605557219', tags: []},
  //{tname: '娱乐BigBang语音版', tid: 'T1394711522757', tags: []},
  {tname: '数读', tid: 'T1348654813857', tags: []},
  {tname: '娱乐连环画', tid: 'T1393399130300', tags: []},
  {tname: '一周车坛囧事', tid: 'T1382946585552', tags: []},
  {tname: '网易UGC实验室', tid: 'T1395385797796', tags: [], stopped: 1},
  {tname: '深夜畅聊', tid: 'T1396928569598', tags: []},
  {tname: '胖编怪谈', tid: 'T1396928667862', tags: []},
  {tname: '真人秀', tid: 'T1396928753073', tags: []},
  {tname: '街头会易', tid: 'T1399258893359', tags: []},
  {tname: '午间饭局', tid: 'T1404373616552', tags: [], stopped: 1},
  {tname: '发现者', tid: 'T1405409473430', tags: [], stopped: 1},
  {tname: '每日易说', tid: 'T1407306259695', tags: []},
  {tname: '每日易乐', tid: 'T1407306418235', tags: []},
  {tname: '易哥新闻', tid: 'T1407306575787', tags: []},
  {tname: '图娱', tid: 'T1408070543854', tags: [], stopped: 1},
  {tname: '老友记', tid: 'T1408071657008', tags: [], stopped: 1},
  {tname: '星态度', tid: 'T1408071830625', tags: [], stopped: 1},
  {tname: '锐势力', tid: 'T1408071935583', tags: [], stopped: 1},
  {tname: '核动力', tid: 'T1408072022410', tags: [], stopped: 1},
  {tname: '观剧报告', tid: 'T1408072129469', tags: []},
  {tname: '独家影评', tid: 'T1408072377895', tags: []},
  {tname: '易奇闻', tid: 'T1417494430169', tags: []},
  {tname: '新闻七点整', tid: 'T1402384628219', tags: []},
  {tname: '热观察', tid: 'T1423798799565', tags: []},
  {tname: '视野', tid: 'T1382946778301', tags: ['视野'], stopped: 1},
  {tname: '微历史', tid: 'T1376554225976', tags: [], stopped: 1},
  {tname: '独家解读', tid: 'T1348654778699', tags: [], stopped: 1},
  {tname: '应用一勺烩', tid: 'T1383187051764', tags: [], stopped: 1},
  {tname: '历史七日谈', tid: 'T1359605505216', tags: [], stopped: 1},
  {tname: '科技万有瘾力', tid: 'T1359605530115', tags: [], stopped: 1},
  {tname: '一周媒体速递', tid: 'T1359605600543', tags: [], stopped: 1},
  {tname: '一周军情观察', tid: 'T1359613635637', tags: [], stopped: 1},
  {tname: '一周人物', tid: 'T1385105962170', tags: [], stopped: 1},
  // 专栏
  {tname: '媒体札记', tid: 'T1374655362262', tags: [], stopped: 1},
  {tname: '读写客', tid: 'T1374655641708', tags: []},
  {tname: '科学现场调查', tid: 'T1374655737387', tags: [], stopped: 1},
  {tname: '罗辑思维', tid: 'T1385106069241', tags: [], stopped: 1}, // Video
  {tname: '爱解析', tid: 'T1383639904180', tags: [], stopped: 1},
  //{tname: '理中客', tid: 'T1387349830515', tags: ['真话讲堂']},
  {tname: '大国小民', tid: 'T1387350092857', tags: []},
  //{tname: '热历史', tid: 'T1387350254612', tags: []},
  //{tname: '真话', tid: 'T1370583240249', tags: []},
  {tname: '新闻漫画', tid: 'T1374655548448', tags: [], stopped: 1},
  {tname: '军事控', tid: 'T1374655601172', tags: [], stopped: 1},
  {tname: '读报', tid: 'T1378876118770', tags: [], stopped: 1},
  {tname: '知乎日报', tid: 'T1383207786512', tags: [], stopped: 1},
  {tname: '每周观察', tid: 'T1383207857966', tags: [], stopped: 1},
  {tname: '隔洋观花', tid: 'T1385106187014', tags: [], stopped: 1},
  {tname: '打铁记', tid: 'T1383639452806', tags: [], stopped: 1},
  // 音频
  //{tname: '有声', tid: 'T1394610975770', tags: []}, // Audio
  //{tname: '清晨时光', tid: 'T1394618026933', tags: []}, // Audio
  //{tname: '历史上的今天', tid: 'T1394626686487', tags: []}, // Audio
  //{tname: '糗事百科音频版', tid: 'T1379039985773', tags: []}, // Audio
  //{tname: '头条新闻', tid: 'T1379039891960', tags: []}, // Audio
  //{tname: '新闻直播间', tid: 'T1378713857672', tags: []}, // Audio
  //{tname: '奇葩一朵朵', tid: 'T1394626394234', tags: []}, // Audio
  //{tname: '大哈讲段子', tid: 'T1394626579176', tags: []}, // Audio
  // 视频
  // http://c.m.163.com/nc/video/list/00850FRB/n/0-10.html
  // http://c.m.163.com/nc/video/detail/V9PJS6H0U.html
  //{tname: '热点', tid: 'V9LG4B3A0', tags: []},
  //{tname: '娱乐', tid: 'V9LG4CHOR', tags: []},
  //{tname: '搞笑', tid: 'V9LG4E6VR', tags: []},
  //{tname: '精品', tid: '00850FRB', tags: ['新闻52秒', 'YouTube天天精选', '腐女办公室', '超级颜论', '数码贱男', '飞碟一分钟', '飞碟说', '娱乐快报']},
  // 其它订阅
  {tname: '爆笑gif图', tid: 'T1395298452550', tags: []},
  //{tname: 'gif怪兽', tid: 'T1385542280953', tags: []}, // TODO
];

var photoSubscriptions = [
  {tname: '独家图集', tid: '54GJ0096', tags: []},
];

var crawlerEvent = new EventEmitter();
crawlerEvent.on('onNewsDetail', function (entry) {
  fetchNewsDetail(entry);
});
crawlerEvent.on('onPhotoDetail', function (entry) {
  fetchPhotoDetail(entry);
});

var fetchNewsDetail = function(entry) {
  var docid = util.format('%s',entry.docid);
  var url = util.format('http://c.m.163.com/nc/article/%s/full.html', docid);
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
    if (!json || !_.has(json, docid) || !utils.hasKeys(json[docid], ['docid', 'title', 'body', 'ptime'])) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var jObj = json[docid];
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
      obj.link = entry.url_3w || entry.url || util.format('http://3g.163.com/touch/article.html?docid=%s', docid);
      obj.title = jObj.title;
      var t1 = moment(jObj.ptime);
      var t2 = moment(entry.ptime);
      var t3 = moment(entry.lmodify);
      var ptime = t1.isValid() ? t1 : (t2.isValid() ? t2 : t3);
      if (!ptime.isValid()) {
        logger.warn('Invalid time in %s', url);
        return;
      }
      obj.time = ptime.toDate();
      obj.marked = jObj.body;
      obj.created = new Date();
      obj.views = entry.updateFlag ? result.views : 1;
      obj.tags = entry.tagName;
      obj.digest = utils.genDigest(jObj.body);
      obj.cover = entry.imgsrc;
      if (_.isArray(jObj.img) && !_.isEmpty(jObj.img)) {
        _.each(jObj.img, function(img, i, imgs) {
          if (!utils.hasKeys(img, ['src', 'ref'])) {
            logger.info('Invalid img data %j', img);
            return;
          }
          if (!obj.cover) {
            obj.cover = img.src;
          }
          var imgHtml = utils.genLazyLoadHtml(img.alt, img.src);
          obj.marked = obj.marked.replace(img.ref, imgHtml);
        });
      }
      if (_.isArray(jObj.video) && !_.isEmpty(jObj.video)) {
        _.each(jObj.video, function(v, i, videos) {
          if (!utils.hasKeys(v, ['url_m3u8', 'url_mp4', 'cover', 'ref'])) {
            logger.info('Invalid video data %j', v);
            return;
          }
          if (!obj.cover) {
            obj.cover = v.cover;
          }
          var link = v.url_m3u8 || v.url_mp4;
          var html = util.format('<br/><a href="%s" target="_blank">%s</a><br/>', link, v.alt);
          link = link.replace(/&amp;/g, '&');
          var query = SysUrl.parse(decodeURIComponent(link), true).query;
          var url = query.url || link;
          if (utils.isAudioVideoExt(url)) {
            html += utils.genJwPlayerEmbedCode(util.format('vid_%s_%d', jObj.docid, i), url, v.cover, i===0);
          }
          obj.marked = obj.marked.replace(v.ref, html);
          if (!obj.hasVideo) {
            obj.hasVideo = 1;
          }
        });
      }

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

var fetchPhotoDetail = function(entry) {
  var docid = util.format('%s',entry.setid);
  var url = util.format('http://c.m.163.com/photo/api/set/0096/%s.json',entry.setid);
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
    if (!json || !utils.hasKeys(json, ['photos', 'createdate'])) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    if (!_.isArray(json['photos']) || _.isEmpty(json['photos'])) {
      logger.warn('Invalid photos in %s', url)
      return;
    }
    var jObj = json;
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
      obj.link = entry.seturl || jObj.url || util.format('http://help.3g.163.com/photoview/%s/%s.html', entry.tid, entry.setid);
      obj.title = entry.setname || jObj.setname || entry.title;
      var t1 = moment(jObj.createdate);
      var t2 = moment(jObj.datatime);
      var t3 = moment(entry.createdate);
      var t4 = moment(entry.datetime);
      var ptime = t1.isValid() ? t1 : (t2.isValid() ? t2 : (t3.isValid() ? t3 : t4));
      if (!ptime.isValid()) {
        logger.warn('Invalid time in %s', url);
        return;
      }
      obj.time = ptime.toDate();
      obj.created = new Date();
      obj.views = entry.updateFlag ? result.views : 1;
      obj.tags = entry.tagName;
      obj.marked = jObj.desc || '';
      obj.cover = jObj.cover || jObj.tcover || jObj.scover ||entry.cover ||  entry.tcover || entry.scover || entry.clientcover || entry.clientcover1;
      _.each(jObj.photos, function (img, i, imgs) {
        if (!_.has(img, 'imgurl')) {
          logger.info('Invalid img data %j', img);
          return;
        }
        if (!obj.cover) {
          obj.cover = img.imgurl;
        }
        obj.marked += img.note ? img.note: img.imgtitle;
        obj.marked += utils.genLazyLoadHtml('', img.imgurl);
      });
      obj.digest = utils.genDigest(obj.marked);

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

var fetchPhotoSubscription = function(entry) {
  var url = entry.url;
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
    if (!json) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json;
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['setid', 'setname'])) {
        logger.warn('Invalid newsEntry in %s', url);
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.setname, entry);
      if (!newsEntry.tagName) {
        return;
      }
      newsEntry.tid = entry.tid;
      News.findOne(utils.genFindCmd(site, newsEntry.setid), function(err, result) {
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
        crawlerEvent.emit('onPhotoDetail', newsEntry);
      });
    });
    if (entry.crawlFlag) {
      if (newsList.length === 10) {
        entry.url = util.format('http://c.m.163.com/photo/api/morelist/0096/%s/%s.json', entry.tid, newsList[9].setid);
        logger.info('[%s] next page: %s', entry.tname, entry.url);
        setTimeout(fetchPhotoSubscription, 3000, entry);
      }else {
        logger.info('[%s] last page: %s', entry.tname, entry.url);
        entry.crawlFlag = 0;
      }
    }
  });
}

var fetchNewsSubscription = function (entry) {
  var url = util.format('http://c.m.163.com/nc/article/list/%s/%d-20.html', entry.tid, entry.page * 20);
  if (entry.tid === 'T1348647909107') { // 头条
    url = util.format('http://c.m.163.com/nc/article/headline/%s/%d-20.html', entry.tid, entry.page * 20);
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
    if (!json || !_.has(json, entry.tid)) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json[entry.tid];
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['docid', 'title'])) {
        logger.warn('Invalid newsEntry in %s', url);
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.title, entry);
      if (!newsEntry.tagName) {
        return;
      }
      News.findOne(utils.genFindCmd(site, newsEntry.docid), function(err, result) {
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
        if ('T1387970173334' == entry.tid) { // 看客
          if (newsEntry.photosetID){
            var l = newsEntry.photosetID.split('|') //photosetID=54GJ0096|33178
            if (l && l.length === 2) {
              newsEntry.setid = l[1]
            }
          }
          if (!newsEntry.setid) {
            return;
          }
          crawlerEvent.emit('onPhotoDetail', newsEntry);
        }else {
          crawlerEvent.emit('onNewsDetail', newsEntry);
        }
      });
    });
    if (entry.crawlFlag) {
      if (newsList.length === 20) {
        entry.page += 1;
        logger.info('[%s] next page: %d', entry.tname, entry.page);
        setTimeout(fetchNewsSubscription, 3000, entry);
      }else {
        logger.info('[%s] last page: %d', entry.tname, entry.page);
        entry.crawlFlag = 0;
      }
    }
  });
};

var fetchPhotoSubscriptions = function() {
  photoSubscriptions.forEach(function(entry) {
    if (entry.stopped && !entry.crawlFlag) {
      return;
    }
    entry.url = util.format('http://c.m.163.com/photo/api/list/0096/%s.json', entry.tid);
    fetchPhotoSubscription(entry);
  });
}

var fetchNewsSubscriptions = function() {
  newsSubscriptions.forEach(function(entry) {
    if (entry.stopped && !entry.crawlFlag) {
      return;
    }
    entry.page = 0;
    fetchNewsSubscription(entry);
  });
}

var main = function() {
  logger.log('Start');
  newsSubscriptions.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
  photoSubscriptions.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
  crawlFlag = 0;
  fetchNewsSubscriptions();
  fetchPhotoSubscriptions();
  setTimeout(main, config.crawlInterval);
}

if (require.main === module) {
  main();
}

exports.main = main;
exports.subscriptions = newsSubscriptions.concat(photoSubscriptions);
