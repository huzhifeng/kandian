var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var genFindCmd = require('./lib/utils').genFindCmd;
var encodeDocID = require('./lib/utils').encodeDocID;
var data2Json = require('./lib/utils').data2Json;
var genDigest = require('./lib/utils').genDigest;

var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.1.1; MI 2 MIUI/JLB5.0)',
  'Host': 'api.3g.ifeng.com',
  'Connection': 'Keep-Alive',
};
var site = 'ifeng';
var ifengTags = [
  '史说新语',
  '百部穿影', // http://ent.ifeng.com/movie/special/baibuchuanying/
  '影像志',
  '凤凰热追踪',
  '深度',
  '真相80',
  '凤凰网评',
  '轻新闻',
  '每日热词',
  '教科书之外',
  '独家评',
  '科技能见度',
  '凤凰八卦阵',
  '洞见',
  '独家图表',
  '历史上的今天',
  '情感夜话',
];

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

var getNewsDetail = function(entry) {
  // http://api.3g.ifeng.com/ipadtestdoc?imgwidth=100&aid=imcp_74868287&channel=push&chid=push&android=1&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  // http://api.3g.ifeng.com/ipadtestdoc?aid=74868287&channel=%E6%96%B0%E9%97%BB
  // http://api.3g.ifeng.com/ipadtestdoc?aid=74868287
  // http://api.3g.ifeng.com/ipadtestdoc?aid=imcp_74868287
  var docid = util.format("%s",entry.documentId);
  var url = entry.id;// http://api.3g.ifeng.com/ipadtestdoc?aid=74868287&channel=%E6%96%B0%E9%97%BB
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json || !json.body || !json.body.text) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():json null");
      return;
    }
    var jObj = json.body;
    var obj = entry;
    News.findOne(genFindCmd(site, docid), function(err, result) {
      if(err || result) {
        return;
      }
      obj.docid = encodeDocID(site, docid);
      obj.site = site;
      obj.body = jObj.text.replace(/width=["']140["']/g, '');
      obj.img = jObj.img;
      if(jObj.wapurl) {
        obj.link = jObj.wapurl; // http://i.ifeng.com/news?aid=74868287
      }else if(jObj.wwwurl) {
        obj.link = jObj.wwwurl; // http://wap.ifeng.com/news.jsp?aid=74868287
      }else if(jObj.shareurl) {
        obj.link = jObj.shareurl; // http://i.ifeng.com/news/sharenews.f?aid=74868287
      }else {
        obj.link = util.format("http://i.ifeng.com/news?aid=%s", docid); // http://i.ifeng.com/news?aid=74868287
      }
      obj.title = entry.title;
      obj.ptime = jObj.editTime;
      obj.time = new Date(obj.ptime);
      obj.marked = obj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.digest = genDigest(obj.body);
      if(entry.thumbnail) {
        obj.cover = entry.thumbnail;
      } else if(jObj.thumbnail) {
        obj.cover = jObj.thumbnail;
      } else if(obj.img[0]) {
        obj.cover = obj.img[0].url;
      }else {
        obj.cover = '';
        console.log("hzfdbg file[" + __filename + "] could not fine a cover");
      }

      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
        }
      }); // News.insert
    }); // News.findOne
  });// request
};

var crawlerHeadLine = function () {
  // http://api.3g.ifeng.com/iosNews?id=aid=SYLB10,SYDT10&imgwidth=480,100&type=list,list&pagesize=20,20&page=1&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  // http://api.3g.ifeng.com/iosNews?id=aid=SYLB10,SYDT10&imgwidth=480,100&type=list,list&pagesize=20,20&page=56&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  var headlineLink = 'http://api.3g.ifeng.com/iosNews?id=aid=SYLB10,SYDT10&imgwidth=480,100&type=list,list&pagesize=20,20&page=%d&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005';
  var MAX_PAGE_NUM = 5;
  var page = 1;

  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    var url = util.format(headlineLink, page);
    var req = {uri: url, method: "GET", headers: headers};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
    request(req, function (err, res, body) {
      var json = data2Json(err, res, body);
      if(!json || !json[0] || !json[0].body || !json[0].body.item) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():JSON.parse() error");
        return;
      }
      var newsList = json[0].body.item;
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():newsList empty in url " + url);
        return;
      }
      newsList.forEach(function(newsEntry) {
        if(!newsEntry.title || !newsEntry.documentId) {
          return;
        }
        for(var i = 0; i < ifengTags.length; i++) {
          if(newsEntry.title.indexOf(ifengTags[i]) !== -1) {
            newsEntry.tagName = ifengTags[i];
            News.findOne(genFindCmd(site, newsEntry.documentId), function(err, result) {
              if(err || result) {
                return;
              }
              console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.documentId);
              startGetDetail.emit('startGetNewsDetail', newsEntry);
            }); // News.findOne
            break;
          }
        }//for
      });//forEach
    });//request
    })(page);
  }//for
};

// 凤凰独家栏目列表,目前共21个,分3页返回,为减少请求,可以指定pagesize为30一次返回
// http://api.3g.ifeng.com/channel_list_android?channel=origin&pagesize=10&pageindex=1&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
var channelListUrl = 'http://api.3g.ifeng.com/channel_list_android?channel=origin&pagesize=30&pageindex=1&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005';
// 某一栏目文章列表,默认每次返回20条记录,可以指定pageindex(如&pageindex=2)和pagesize(如&pagesize=40)自定义返回
// http://api.3g.ifeng.com/origin_doc_list?id=16908&pageindex=1&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
var docListUrl = '%s&pageindex=%d&pagesize=%d&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005';
// 某篇文章内容
// http://api.3g.ifeng.com/ipadtestdoc?imgwidth=100&aid=imcp_74837186&channel=push&chid=push&android=1&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
var docDetailUrl = 'http://api.3g.ifeng.com/ipadtestdoc?imgwidth=100&aid=imcp_74837186&channel=push&chid=push&android=1&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005';

var crawlerChannel = function (channelEntry) {
  var url = util.format(docListUrl, channelEntry.id, channelEntry.pageindex, channelEntry.pagesize);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  channelEntry.pageindex = channelEntry.pageindex + 1;
  if(channelEntry.pageindex <= channelEntry.maxpage) {
    setTimeout(function() {
      crawlerChannel(channelEntry);
    }, 100);
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json || !json[0] || !json[0].body || !json[0].body.item) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerChannel():JSON.parse() error");
      return;
    }
    var newsList = json[0].body.item;
    if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerChannel():newsList empty in url " + url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      newsEntry.tagName = channelEntry.title;
      News.findOne(genFindCmd(site, newsEntry.documentId), function(err, result) {
        if(err || result) {
          return;
        }
        console.log("hzfdbg file[" + __filename + "]" + " crawlerChannel():["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.documentId);
        startGetDetail.emit('startGetNewsDetail', newsEntry);
      }); // News.findOne
    });//forEach
  });//request
};

var initChannelList = function() {
  var url = channelListUrl;
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json || !json.body || !json.body.item) {
      console.log("hzfdbg file[" + __filename + "]" + " initChannelList():JSON.parse() error");
      return;
    }
    var channelList = json.body.item;
    if((!channelList) || (!channelList.length) || (channelList.length <= 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " initChannelList():channelList empty in url " + url);
      return;
    }
    channelList.forEach(function(channelEntry) {
      channelEntry.pageindex = 1;
      channelEntry.pagesize = 20;
      channelEntry.maxpage = 1;
      crawlerChannel(channelEntry);
    });//forEach
  });//request
}
var ifengCrawler = function() {
  crawlerHeadLine();
  initChannelList();
  setTimeout(ifengCrawler, 1000 * 60 * 60);
}

exports.ifengCrawler = ifengCrawler;
ifengCrawler();