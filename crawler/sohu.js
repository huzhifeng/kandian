var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require('underscore');
var moment = require('moment');
var xml2json = require('xml2json');
var config = require('../config');
var News = require('../models/news');
var utils = require('../lib/utils');
var logger = require('../logger');
var crawlFlag = config.crawlFlag;
var updateFlag = config.updateFlag;
var headers = {
  'Content-Encoding': 'UTF-8',
  'Content-Type': 'text/plain',
  'User-Agent': 'Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.1 (KHTML, like Gecko) Chrome/21.0.1180.89 Safari/537.1',
  'Host': 'api.k.sohu.com',
  'Connection': 'Keep-Alive',
};
var site = 'sohu';
var newsSubscriptions = [
  // 要闻
  // 文章列表
  // http://api.k.sohu.com/api/channel/news.go?channelId=1&num=20&page=1&supportTV=1&supportLive=1&supportPaper=1&supportSpecial=1&showPic=1&picScale=2&rt=json&pull=0&more=0&net=wifi&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D&gid=02ffff11061111d51802815cbc373a983f89cbb0065ff1&pid=-1
  // http://api.k.sohu.com/api/channel/news.go?channelId=1&num=20&page=2&supportTV=1&supportLive=1&supportPaper=1&supportSpecial=1&showPic=1&picScale=2&rt=json&pull=0&more=1&net=wifi&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D&gid=02ffff11061111d51802815cbc373a983f89cbb0065ff1&pid=-1
  // 文章详情
  // http://api.k.sohu.com/api/news/article.go?newsId=15278351&channelId=1&imgTag=1&recommendNum=2&net=wifi&updateTime=1388802120000&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D&gid=02ffff11061111d51802815cbc373a983f89cbb0065ff1&pid=-1
  {tname:'要闻', tid:'1', tags:['狐揭秘', '涨姿势', '开心一刻', '数说IT', '红人红事榜', '快评']},
  // 原创
  {tname:'先知道', tid:'681', tags:[], stopped:1}, // 2014-03-27 停止更新
  {tname:'神吐槽', tid:'682', tags:[]},
  {tname:'热辣评', tid:'683', tags:[], stopped:1}, // 2014-04-18 停止更新
  {tname:'我来说两句', tid:'915', tags:[], stopped:1}, // 2014-01-09 停止更新
];
var videoSubscriptions = [
  // 视频频道
  // http://api.k.sohu.com/api/video/channelList.go?p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D&gid=02ffff11061111d51802815cbc373a983f89cbb0065ff1&pid=-1
  // 文章列表
  // http://api.k.sohu.com/api/video/multipleMessageList.go?type=0&channelId=16&cursor=0&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D&gid=02ffff11061111d51802815cbc373a983f89cbb0065ff1&pid=-1
  // http://api.k.sohu.com/api/video/multipleMessageList.go?type=0&channelId=16&cursor=1396578656584&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D&gid=02ffff11061111d51802815cbc373a983f89cbb0065ff1&pid=-1
  // 文章详情
  // http://api.k.sohu.com/api/video/message.go?id=28561495&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D&gid=02ffff11061111d51802815cbc373a983f89cbb0065ff1&pid=-1
  // 关联文章
  // http://api.k.sohu.com/api/video/relationMessageList.go?mid=28561495&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D&gid=02ffff11061111d51802815cbc373a983f89cbb0065ff1&pid=-1
  //{tname:'热播', tid:'1', tags:[]},
  //{tname:'美女', tid:'14', tags:[]},
  //{tname:'搞笑', tid:'13', tags:[]},
  //{tname:'娱乐', tid:'23', tags:[]},
  //{tname:'体育', tid:'15', tags:[]},
  //{tname:'电影', tid:'22', tags:[]},
  //{tname:'剧集', tid:'20', tags:[]},
  //{tname:'游戏', tid:'19', tags:[], stopped:1},
  //{tname:'专辑', tid:'24', tags:[]},
  {
    tname:'搜狐原创视频',
    tid:'16',
    tags:[
      '每日一囧',
      'Big笑工坊',
      '老陕说穿帮',
      '飞碟一分钟',
      '发热盘点',
      '十万个冷幽默',
      '大姨来了吗',
      '胥渡吧',
      '胡狼出品',
      '畅所欲言',
      '雷人囧事'
    ]
  },
];
var otherSubscriptions = [
  //{tname:'知乎每日精选', tid:'416', tags:[]},
  //{tname:'趣图集', tid:'500', tags:[], stopped:1}, // 2013-10-09 停止更新
  //{tname:'捧腹网', tid:'501', tags:[]},
  //{tname:'来福岛', tid:'502', tags:[]},
  //{tname:'搞笑哦', tid:'528', tags:[]},
  //{tname:'萝卜网', tid:'530', tags:[]},
  //{tname:'对路网', tid:'532', tags:[], stopped:1}, // 2013-09-26 停止更新
  //{tname:'挖段子•冷笑话', tid:'533', tags:[]},
  //{tname:'无聊哦', tid:'580', tags:[]},
  //{tname:'妹子图', tid:'581', tags:[]}, // Refer to wumii.js
  //{tname:'挖段子•趣图', tid:'610', tags:[]},
  //{tname:'留几手', tid:'671', tags:[]},
  //{tname:'黑眼睛看世界', tid:'672', tags:[]},
  //{tname:'微天下', tid:'673', tags:[]},
  //{tname:'祖德狐说', tid:'674', tags:[]},
  //{tname:'CAOTV观点保真', tid:'675', tags:[]},
  //{tname:'司马白话', tid:'676', tags:[]},
  //{tname:'爱美男', tid:'2141', tags:[]},
  {tname:'蝶女郎', tid:'3446', tags:[], stopped:1}, // 2013-11-28 停止更新
];
var photoSubscriptions = [
  {tname:'搜狐美女', tid:'53', tags:[]},
  {tname:'图粹', tid:'455', tags:[]},
  {tname:'图片故事', tid:'456', tags:[]},
  {tname:'明星旧照', tid:'457', tags:[], stopped:1}, // 2013-12-25 停止更新
  {tname:'明星情史', tid:'458', tags:[], stopped:1}, // 2013-01-06 停止更新
  {tname:'趣图', tid:'459', tags:[], stopped:1}, // 2013-01-17 停止更新
  {tname:'清纯美女', tid:'460', tags:[], stopped:1}, // 2013-12-10 停止更新
  {tname:'爱新奇', tid:'465', tags:[], stopped:1}, // 2013-02-22 停止更新
];

var crawlerEvent = new EventEmitter();
crawlerEvent.on('onNewsDetail', function (entry) {
  fetchNewsDetail(entry);
});
crawlerEvent.on('onPhotoDetail', function (entry) {
  fetchPhotoDetail(entry);
});

var fetchNewsDetail = function(entry) {
  var detailLink = 'http://api.k.sohu.com/api/news/article.go?newsId=%s';
  var docid = util.format('%s',entry.newsId);
  var url = util.format(detailLink, docid);
  var req = {
    uri: url,
    method: 'GET',
    headers: headers
  };
  if (config.proxyEnable) {
    req.proxy = config.proxyUrl;
  }
  request(req, function (err, res, body) {
    if (err || (res.statusCode != 200) || (!body)) {
        logger.warn('request failed: %j', {
          'err': err,
          'statusCode': res ? res.statusCode : 'null res',
          'url': url
        });
        return;
    }
    var json = xml2json.toJson(body, {object: true, sanitize: false});
    if (!json || !_.has(json, 'root') || !utils.hasKeys(json.root, ['newsId', 'title', 'content'])) {
      logger.warn('Invalid json data %j in %s', json, url);
      return;
    }
    var jObj = json.root;
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
      obj.link = jObj.link || util.format('http://3g.k.sohu.com/t/n%s', docid);
      obj.title = entry.title || jObj.title;
      var t1 = moment(jObj.time);
      var t2 = moment(parseInt(jObj.updateTime, 10));
      var t3 = moment(parseInt(entry.updateTime, 10));
      var ptime = t1.isValid() ? t1 : (t2.isValid() ? t2 : t3);
      if (!ptime.isValid()) {
        logger.warn('Invalid time in %s', url);
        return;
      }
      obj.time = ptime.toDate();
      // TODO lazyloading
      obj.marked = jObj.content.replace(/90_90/gi,'602_1000').replace(/120_120/gi, '602_1000');//小图片替换为大图片
      obj.created = new Date();
      obj.views = entry.updateFlag ? result.views : 1;
      obj.tags = entry.tagName;
      obj.digest = utils.genDigest(obj.marked);
      obj.cover = entry.listpic || entry.bigPic;

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
  // http://api.k.sohu.com/api/photos/gallery.go?gid=78233&from=tag&fromId=455&supportTV=1&refer=null&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D
  // http://api.k.sohu.com/api/photos/gallery.go?gid=78233
  var docid = util.format('%s',entry.gid);
  var url = util.format('http://api.k.sohu.com/api/photos/gallery.go?gid=%s&from=tag&fromId=%s&supportTV=1&refer=null&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D', docid, entry.tagId);
  var req = {
    uri: url,
    method: 'GET',
    headers: headers
  };
  if (config.proxyEnable) {
    req.proxy = config.proxyUrl;
  }
  request(req, function (err, res, body) {
    if (err || (res.statusCode != 200) || (!body)) {
        logger.warn('request failed: %j', {
          'err': err,
          'statusCode': res ? res.statusCode : 'null res',
          'url': url
        });
        return;
    }
    var json = xml2json.toJson(body,{object:true, sanitize:false});
    if (!json || !_.has(json, 'root') || !utils.hasKeys(json.root, ['newsId', 'title', 'gid', 'gallery'])) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    if (!_.isArray(json.root.gallery.photo) || _.isEmpty(json.root.gallery.photo)) {
      logger.warn('Invalid gallery photo %j in %s', json.root.gallery, url);
      return;
    }
    var jObj = json.root;
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
      obj.link = jObj.shareLink || util.format('http://3g.k.sohu.com/t/p%s', docid);
      obj.title = entry.title || jObj.title;
      var t1 = moment(jObj.time);
      var t2 = moment(parseInt(entry.time, 10));
      var ptime = t1.isValid() ? t1 : t2;
      if (!ptime.isValid()) {
        logger.warn('Invalid time in %s', url);
        return;
      }
      obj.time = ptime.toDate();
      obj.cover = entry.images[0];
      obj.marked = '';
      _.each(jObj.gallery.photo, function(img, i, imgs) {
        if (!_.has(img, 'pic')) {
          logger.info('Invalid img data %j', img);
          return;
        }
        if (!obj.cover) {
          obj.cover = img.pic;
        }
        obj.marked += utils.genLazyLoadHtml(img.abstract || img.ptitle, img.pic);
      });
      obj.created = new Date();
      obj.views = entry.updateFlag ? result.views : 1;
      obj.tags = entry.tagName;
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

var genVideoPlayerHtml = function(vid, id) {
  var html = '';
  html = util.format('</br><object width="640" height="515">' +
    '<param name="movie" value="http://share.vrs.sohu.com/my/v.swf&autoplay=true&id=%s&skinNum=1&topBar=1&xuid="></param>' +
    '<param name="allowFullScreen" value="true"></param><param name="allowscriptaccess" value="always"></param>' +
    '<embed width="640" height="515"  allowfullscreen="true" allowscriptaccess="always" quality="high" ' +
    'src="http://share.vrs.sohu.com/my/v.swf&autoplay=true&id=%s&skinNum=1&topBar=1&xuid=" type="application/x-shockwave-flash"/>' +
    '</embed></object></br>', vid, vid);
  html += util.format('</br><a href="http://3g.k.sohu.com/v/t%s" target="_blank">传送门</a></br>', id);

  return html;
}

var fetchVideoSubscription = function (entry) {
  var pageSize = 20;
  var url = util.format('http://api.k.sohu.com/api/video/multipleMessageList.go?type=0&channelId=%s&cursor=%d&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D&gid=02ffff11061111d51802815cbc373a983f89cbb0065ff1&pid=-1', entry.tid, entry.cursor);
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
    if (!json || !_.has(json, 'data')) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json.data;
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['id', 'title', 'playurl', 'pubDateName', 'siteInfo'])) {
        logger.warn('Invalid newsEntry in %s', url);
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
        var obj = {};
        obj.docid = utils.encodeDocID(site, util.format('%s',newsEntry.id));
        obj.site = site;
        obj.link = newsEntry.url || util.format('http://3g.k.sohu.com/v/t%s', newsEntry.id);
        obj.title = newsEntry.title;
        var t1 = moment(newsEntry.pubDateName);
        var t2 = moment(parseInt(newsEntry.pubDate, 10));
        var t3 = moment(parseInt(newsEntry.utime, 10));
        var ptime = t1.isValid() ? t1 : (t2.isValid() ? t2 : t3);
        if (!ptime.isValid()) {
          logger.warn('Invalid time in %s', url);
          return;
        }
        obj.time = ptime.toDate();
        obj.marked = newsEntry.content || newsEntry.title;
        obj.created = new Date();
        obj.views = newsEntry.updateFlag ? result.views : 1;
        obj.tags = newsEntry.tagName;
        obj.digest = utils.genDigest(obj.marked);
        obj.cover = newsEntry.pic || newsEntry.smallPic || newsEntry.pic_4_3;
        //var video_url = newsEntry.playurl.highMp4 || newsEntry.playurl.mp4;
        //obj.marked += utils.genJwPlayerEmbedCode(util.format('vid_%s', newsEntry.id), video_url, obj.cover, 1);
        if (newsEntry.siteInfo && newsEntry.siteInfo.siteId) {
          obj.marked += genVideoPlayerHtml(newsEntry.siteInfo.siteId, newsEntry.id)
          if (!obj.hasVideo) {
            obj.hasVideo = 1;
          }
        }

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
      if ((newsList.length === pageSize) && json.hasnext && json.nextCursor) {
        entry.cursor = json.nextCursor;
        logger.info('[%s] next page: %d', entry.tname, entry.cursor);
        setTimeout(fetchVideoSubscription, 3000, entry);
      }else {
        logger.info('[%s] last page: %d', entry.tname, entry.cursor);
        entry.crawlFlag = 0;
      }
    }
  });
};

var fetchPhotoSubscription = function (entry) {
  var pageSize = 10;
  var url = util.format('http://api.k.sohu.com/api/photos/list.go?&tagId=%s&rt=json&pageNo=%d&pageSize=10&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D', entry.tid, entry.page);
  if (1 === entry.page) {
    url = util.format('http://api.k.sohu.com/api/photos/list.go?&tagId=%s&rt=json&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D', entry.tid);
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
    if (!json || !_.has(json, 'news')) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json.news;
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['gid', 'title', 'images'])) {
        logger.warn('Invalid newsEntry in %s', url);
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.title, entry);
      if (!newsEntry.tagName) {
        return;
      }
      newsEntry.tagId = entry.tid;
      News.findOne(utils.genFindCmd(site, newsEntry.gid), function(err, result) {
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
      if (newsList.length === pageSize) {
        entry.page += 1;
        logger.info('[%s] next page: %d', entry.tname, entry.page);
        setTimeout(fetchPhotoSubscription, 3000, entry);
      }else {
        logger.info('[%s] last page: %d', entry.tname, entry.page);
        entry.crawlFlag = 0;
      }
    }
  });
};

var fetchNewsSubscription = function (entry) {
  var pageSize = 15;
  var url = util.format('http://api.k.sohu.com/api/flow/newslist.go?subId=%s&pubId=0&sid=18&rt=json&pageNum=%d', entry.tid, entry.page);
  if (entry.tid === '1') { // 头条
    url = util.format('http://api.k.sohu.com/api/channel/news.go?channelId=1&num=20&page=%d&rt=json', entry.page);
    pageSize = 20;
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
    if (!json || !(_.has(json, 'newsList') || _.has(json, 'articles'))) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json.newsList;
    if (entry.tid === '1') {
      newsList = json.articles;
    }
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['newsId', 'title'])) {
        logger.warn('Invalid newsEntry in %s', url);
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.title, entry);
      if (!newsEntry.tagName) {
        return;
      }
      News.findOne(utils.genFindCmd(site, newsEntry.newsId), function(err, result) {
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
        crawlerEvent.emit('onNewsDetail', newsEntry);
      });
    });
    if (entry.crawlFlag) {
      if (newsList.length === pageSize) {
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

var fetchVideoSubscriptions = function () {
  videoSubscriptions.forEach(function(entry) {
    if (entry.stopped && !entry.crawlFlag) {
      return;
    }
    entry.cursor = 0;
    fetchVideoSubscription(entry);
  });
}

var fetchPhotoSubscriptions = function () {
  photoSubscriptions.forEach(function(entry) {
    if (entry.stopped && !entry.crawlFlag) {
      return;
    }
    entry.page = 1;
    fetchPhotoSubscription(entry);
  });
}

var fetchNewsSubscriptions = function () {
  var subscriptions = newsSubscriptions.concat(otherSubscriptions);
  subscriptions.forEach(function(entry) {
    if (entry.stopped && !entry.crawlFlag) {
      return;
    }
    entry.page = 1;
    fetchNewsSubscription(entry);
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
  videoSubscriptions.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
  crawlFlag = 0;
  fetchNewsSubscriptions();
  fetchPhotoSubscriptions();
  fetchVideoSubscriptions();
  setTimeout(main, config.crawlInterval);
}

if (require.main === module) {
  main();
}

exports.main = main;
exports.subscriptions = newsSubscriptions.concat(otherSubscriptions, photoSubscriptions, videoSubscriptions);
