var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var News = require('../models/news');
var utils = require('../lib/utils')
var genLazyLoadHtml = utils.genLazyLoadHtml;
var genFindCmd = utils.genFindCmd;
var encodeDocID = utils.encodeDocID;
var data2Json = utils.data2Json;
var genDigest = utils.genDigest;
var findTagName = utils.findTagName;
var xml2json = require('xml2json');
var jsdom = require("jsdom").jsdom;
var crawlFlag = require('config').Config.crawlFlag; // 0: only one or few pages; 1: all pages

var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'Content-Encoding': 'UTF-8',
  'Content-Type': 'text/plain',
  'User-Agent': 'Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.1 (KHTML, like Gecko) Chrome/21.0.1180.89 Safari/537.1',
  'Host': 'api.k.sohu.com',
  'Connection': 'Keep-Alive',
};
var site = "sohu";
var sohuSubscribes = [
  // 要闻
  // 文章列表
  // http://api.k.sohu.com/api/channel/news.go?channelId=1&num=20&page=1&supportTV=1&supportLive=1&supportPaper=1&supportSpecial=1&showPic=1&picScale=2&rt=json&pull=0&more=0&net=wifi&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D&gid=02ffff11061111d51802815cbc373a983f89cbb0065ff1&pid=-1
  // http://api.k.sohu.com/api/channel/news.go?channelId=1&num=20&page=2&supportTV=1&supportLive=1&supportPaper=1&supportSpecial=1&showPic=1&picScale=2&rt=json&pull=0&more=1&net=wifi&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D&gid=02ffff11061111d51802815cbc373a983f89cbb0065ff1&pid=-1
  // 文章详情
  // http://api.k.sohu.com/api/news/article.go?newsId=15278351&channelId=1&imgTag=1&recommendNum=2&net=wifi&updateTime=1388802120000&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D&gid=02ffff11061111d51802815cbc373a983f89cbb0065ff1&pid=-1
  {tname:'要闻', tid:'1', tags:['狐揭秘', '涨姿势', '搜查科', '开心一刻', '数说IT', '红人红事榜', '快评']},
  // 原创
  {tname:'先知道', tid:'681', tags:[]},
  {tname:'神吐槽', tid:'682', tags:[]},
  {tname:'热辣评', tid:'683', tags:[]},
  {tname:'我来说两句', tid:'915', tags:[]},
  //{tname:'变态辣椒', tid:'677', tags:[], stopped:1}, // 停止更新
  //{tname:'IQ问答', tid:'684', tags:[], stopped:1}, // 2013-09-22 停止更新
];
var otherSubscribes = [
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
var photoTags = [
  {tname:'搜狐美女', tid:'53', tags:[]},
  {tname:'图粹', tid:'455', tags:[]},
  {tname:'图片故事', tid:'456', tags:[]},
  {tname:'明星旧照', tid:'457', tags:[], stopped:1}, // 2013-12-25 停止更新
  {tname:'明星情史', tid:'458', tags:[], stopped:1}, // 2013-01-06 停止更新
  {tname:'趣图', tid:'459', tags:[], stopped:1}, // 2013-01-17 停止更新
  {tname:'清纯美女', tid:'460', tags:[], stopped:1}, // 2013-12-10 停止更新
  {tname:'爱新奇', tid:'465', tags:[], stopped:1}, // 2013-02-22 停止更新
];
function pickImg(html) {
  var document = jsdom(html);
  objs = document.getElementsByTagName('img');
  var img = [];
  if(objs) {
    for(i=0; i<objs.length; i++) {
      img[i] = {};
      img[i].src = objs[i].getAttribute('data-src');
      img[i].alt = objs[i].getAttribute('alt');
      img[i].originsrc = objs[i].getAttribute("src");
    }
  }
  return img;
}

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

startGetDetail.on('startGetPhotoDetail', function (entry) {
  getPhotoDetail(entry);
});

var getNewsDetail = function(entry) {
  // http://api.k.sohu.com/api/news/article.go?newsId=7189277
  var detailLink = 'http://api.k.sohu.com/api/news/article.go?newsId=%s';
  var docid = util.format("%s",entry.newsId);
  var url = util.format(detailLink, docid);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():error");
        console.log(err);console.log(url);console.log(util.inspect(res));console.log(body);
        return;
    }
    var json = xml2json.toJson(body,{object:true, sanitize:false});
    if(!json) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():json null");
      return;
    }
    var jObj = json.root;
    var obj = entry;
    News.findOne(genFindCmd(site, docid), function(err, result) {
      if (err || result) {
        return;
      }
      obj.docid = encodeDocID(site, docid);
      obj.site = site;
      obj.body = jObj.content.replace(/90_90/gi,"602_1000");//小图片替换为大图片
      obj.img = pickImg(obj.body);
      obj.video = [];
      obj.link = "";
      if(jObj.link) {
        obj.link = jObj.link; // http://3g.k.sohu.com/t/n7189277
      }else {
        obj.link = util.format("http://3g.k.sohu.com/t/n%s", docid); // http://3g.k.sohu.com/t/n7189277
      }
      obj.title = entry.title;
      obj.ptime = jObj.time; // 2014-01-03 06:32
      obj.time = Date.parse(obj.ptime); // 1388701920000
      obj.marked = obj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.digest = genDigest(obj.body);
      if(entry.listPic) {
        obj.cover = entry.listPic;
      } else if(entry.bigPic) {
        obj.cover = entry.bigPic;
      } else if(entry.listpic) {
        obj.cover = entry.listpic;
      } else if(obj.img[0]) {
        obj.cover = obj.img[0].src;
      } else if (obj.img[1]) {
        obj.cover = obj.img[1].src;
      }

      // img lazyloading
      for(i=0; i<obj.img.length; i++) {
        var imgHtml = genLazyLoadHtml(obj.img[i].alt, obj.img[i].originsrc);
        //obj.marked = obj.marked.replace(/<img.*?\/>/gi, imgHtml);
        //console.log("hzfdbg file[" + __filename + "]" + " imgHtml="+imgHtml);
      };

      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():["+obj.tags+"]"+obj.title+",docid="+obj.docid);
      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
        }
      }); // News.insert
    }); // News.findOne
  });// request
};

function genBodyHtml(obj) {
  var body = "";
  var text = "";
  var last_text = "";
  var i = 0;

  if((!obj) || (!obj.gallery)) {
    console.log("hzfdbg file[" + __filename + "]" + " genBodyHtml():null");
    return "";
  }

  body = obj.title + "<br>";
  var list = obj.gallery.photo;

  for(i=0; i<list.length; i++) {
    if(list[i].abstract.length) {
      text = list[i].abstract;
    }else if(list[i].ptitle.length){
      text = list[i].ptitle;
    }else {
      text = "";
      console.log("hzfdbg file[" + __filename + "]" + " genBodyHtml():text null");
    }

    if((0 == i) && (obj.title == text)) {
      body += "";
    }else {
      body += (text == last_text)?"":text;
    }

    last_text = text;
    body += genLazyLoadHtml(text, list[i].pic);
  }

  return body;
}

function pickPhotos(obj) {
  var img = [];
  var i = 0;

  if((!obj) || (!obj.gallery)) {
    console.log("hzfdbg file[" + __filename + "]" + " pickPhotos():null");
    return "";
  }

  var list = obj.gallery.photo;;

  for(i=0; i<list.length; i++) {
    img[i] = list[i].pic;
  }

  return img;
}

var getPhotoDetail = function(entry) {
  // http://api.k.sohu.com/api/photos/gallery.go?gid=78233&from=tag&fromId=455&supportTV=1&refer=null&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D
  // http://api.k.sohu.com/api/photos/gallery.go?gid=78233
  var docid = util.format("%s",entry.gid);
  var url = util.format("http://api.k.sohu.com/api/photos/gallery.go?gid=%s&from=tag&fromId=%s&supportTV=1&refer=null&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D", docid, entry.tagId);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    if(err || (res.statusCode != 200) || (!body)) {
      console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail():error");
      console.log(err);console.log(url);console.log(util.inspect(res));console.log(body);
      return;
    }
    var json = xml2json.toJson(body,{object:true, sanitize:false});
    if(!json || !json.root) {
      console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail():json null");
      return;
    }
    var jObj = json.root;
    var obj = entry;
    News.findOne(genFindCmd(site, docid), function(err, result) {
      if (err || result) {
        return;
      }
      obj.docid = encodeDocID(site, docid);
      obj.site = site;
      obj.body = genBodyHtml(jObj);
      obj.img = pickPhotos(jObj);
      obj.video = [];
      obj.link = "";
      if(jObj.shareLink) {
        obj.link = jObj.shareLink; // http://3g.k.sohu.com/t/p78321
      }else {
        obj.link = util.format("http://3g.k.sohu.com/t/p%s", docid); // http://3g.k.sohu.com/t/p78321
      }
      obj.title = entry.title;
      obj.ptime = jObj.time; // 2014-01-04
      obj.time = Date.parse(obj.ptime); // 1388793600000
      obj.marked = obj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.digest = genDigest(obj.body);
      obj.cover = "";
      if(entry.images[0]) {
        obj.cover = entry.images[0];
      } else if(obj.img[0]) {
        obj.cover = obj.img[0];
      }

      console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail():["+obj.tags+"]"+obj.title+",docid="+obj.docid);
      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail(), News.insert():error " + err);
        }
      }); // News.insert
    }); // News.findOne
  });// request
};

var crawlerHeadLine = function (entry) {
  // http://api.k.sohu.com/api/channel/news.go?channelId=1&num=20&page=1&showPic=1&rt=json
  // http://api.k.sohu.com/api/channel/news.go?channelId=1&num=20&page=1650&showPic=1&rt=json
  var headlineLink = 'http://api.k.sohu.com/api/channel/news.go?channelId=1&num=20&page=%d&rt=json';
  var MAX_PAGE_NUM = 5;
  var page = 1;
  if(entry.crawlFlag) {
    MAX_PAGE_NUM = 100;
    entry.crawlFlag = 0;
  }
  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    var url = util.format(headlineLink, page);
    var req = {uri: url, method: "GET", headers: headers};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
    request(req, function (err, res, body) {
      var json = data2Json(err, res, body);
      if(!json || !json.articles) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():JSON.parse() error");
        return;
      }
      var newsList = json.articles;
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        return;
      }
      newsList.forEach(function(newsEntry) {
        if(!newsEntry.title || !newsEntry.newsId) {
          return;
        }
        newsEntry.tagName = findTagName(newsEntry.title, entry);
        if(!newsEntry.tagName) {
          return;
        }
        News.findOne(genFindCmd(site, newsEntry.newsId), function(err, result) {
          if(err || result) {
            return;
          }
          startGetDetail.emit('startGetNewsDetail', newsEntry);
        }); // News.findOne
      });//forEach
    });//request
    })(page);
  }//for
};

var crawlerPhoto = function (entry) {
  var MAX_PAGE_NUM = 1;
  var page = 0;
  if(entry.crawlFlag) {
    MAX_PAGE_NUM = 10;
    entry.crawlFlag = 0;
  }
  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    var url = "";
    if(1 == page) {
      url = util.format("http://api.k.sohu.com/api/photos/list.go?&tagId=%s&rt=json&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D", entry.tid);
    }else {
      url = util.format("http://api.k.sohu.com/api/photos/list.go?&tagId=%s&rt=json&pageNo=%d&pageSize=10&p1=NTcyODc5OTc0MzU5Nzg3NTIyOQ%3D%3D", entry.tid, page);
    }
    var req = {uri: url, method: "GET", headers: headers};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
    request(req, function (err, res, body) {
      var json = data2Json(err, res, body);
      if(!json || !json.news) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():JSON.parse() error");
        return;
      }
      var newsList = json.news;
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        return;
      }
      newsList.forEach(function(newsEntry) {
        if(!newsEntry.gid || !newsEntry.title) {
          return;
        }
        newsEntry.tagName = findTagName(newsEntry.title, entry);
        if(!newsEntry.tagName) {
          return;
        }
        newsEntry.tagId = entry.tid;
        News.findOne(genFindCmd(site, newsEntry.gid), function(err, result) {
          if(err || result) {
            return;
          }
          startGetDetail.emit('startGetPhotoDetail', newsEntry);
        }); // News.findOne
      });//forEach
    });//request
    })(page);
  }//for
};

var crawlerPhotos = function () {
  photoTags.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    crawlerPhoto(entry);
  });
}

var crawlerTag = function (entry) {
  // http://api.k.sohu.com/api/flow/newslist.go?subId=681&pubId=0&sid=18&rt=flowCallback&pageNum=1
  var tagLink = 'http://api.k.sohu.com/api/flow/newslist.go?subId=%s&pubId=0&sid=18&rt=json&pageNum=%d';
  var MAX_PAGE_NUM = 1;
  var page = 1;
  if(entry.crawlFlag) {
    MAX_PAGE_NUM = 10;
    entry.crawlFlag = 0;
  }
  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    var url = util.format(tagLink, entry.tid, page);
    var req = {uri: url, method: "GET", headers: headers};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
    request(req, function (err, res, body) {
      var json = data2Json(err, res, body);
      if(!json || !json.newsList) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerTag():JSON.parse() error");
        return;
      }
      var newsList = json.newsList;
      if((!newsList) || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerTag():newsList empty in url " + url);
        return;
      }
      newsList.forEach(function(newsEntry) {
        if(!newsEntry.newsId || !newsEntry.title) {
          return;
        }
        newsEntry.tagName = findTagName(newsEntry.title, entry);
        if(!newsEntry.tagName) {
          return;
        }
        News.findOne(genFindCmd(site, newsEntry.newsId), function(err, result) {
          if(err || result) {
            return;
          }
          startGetDetail.emit('startGetNewsDetail', newsEntry);
        }); // News.findOne
      });//forEach
    });//request
    })(page);
  }//for
};

var crawlerSohuSubscribes = function () {
  sohuSubscribes.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    if(entry.tid === '1') {
      crawlerHeadLine(entry)
    }else {
      crawlerTag(entry);
    }
  });
}

var crawlerOtherSubscribes = function () {
  otherSubscribes.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    crawlerTag(entry);
  });
}

var sohuCrawler = function() {
  console.log('Start sohuCrawler() at ' + new Date());
  crawlerSohuSubscribes();
  crawlerOtherSubscribes();
  crawlerPhotos();
  setTimeout(sohuCrawler, 2000 * 60 * 60);
}

var crawlerInit = function() {
  sohuSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
  otherSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
  photoTags.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
}

exports.sohuCrawler = sohuCrawler;
exports.sohuTags = sohuSubscribes.concat(otherSubscribes, photoTags);
crawlerInit();
sohuCrawler();