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
var crawlFlag = require('config').Config.crawlFlag; // 0: only one or few pages; 1: all pages

var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.1.1; MI 2 MIUI/JLB5.0)',
  'Host': 'api.3g.ifeng.com',
  'Connection': 'Keep-Alive',
};
var site = 'ifeng';
var ifengSubscribes = [
  {
    tname:'头条',
    tid:'1',
    tags:[
      //'史说新语', // Refer to 史林拍案
      '百部穿影', // 2013-12-05 停止更新 //http://ent.ifeng.com/movie/special/baibuchuanying/
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
      '健康365',
    ]
  },
  // 凤凰独家栏目列表,目前共20个,可以指定pagesize为50一次返回
  // http://api.3g.ifeng.com/channel_list_android?channel=origin&pageindex=1&pagesize=50
  // http://api.3g.ifeng.com/channel_list_android?channel=origin&pagesize=10&pageindex=1&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  // 某一栏目文章列表,默认每次返回20条记录,可以指定pageindex(如&pageindex=2)和pagesize(如&pagesize=40)自定义返回
  // http://api.3g.ifeng.com/origin_doc_list?id=16908&pageindex=1&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  // 某篇文章内容
  // http://api.3g.ifeng.com/ipadtestdoc?imgwidth=100&aid=imcp_74837186&channel=push&chid=push&android=1&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  {tname:'有报天天读', tid:'16908', tags:[]},
  {tname:'FUN来了', tid:'16917', tags:[]},
  {tname:'凤凰知道', tid:'17594', tags:[]},
  {tname:'今日最大声', tid:'17593', tags:[]},
  {tname:'军魂100分', tid:'18316', tags:[]},
  {tname:'史林拍案', tid:'18505', tags:[]},
  {tname:'一周人物', tid:'18026', tags:[]},
  {tname:'话说', tid:'18017', tags:[]},
  {tname:'财知道', tid:'19355', tags:[]},
  {tname:'锵锵三人行', tid:'19357', tags:[]},
  {tname:'防务短评', tid:'19593', tags:[]},
  {tname:'独家体育评论', tid:'19352', tags:[]},
  {tname:'专家谈', tid:'19350', tags:[], stopped:1}, // 2013-12-09 停止更新
  {tname:'热追踪', tid:'19349', tags:[], stopped:1}, // 2013-12-16 停止更新
  {tname:'精英范', tid:'19348', tags:[], stopped:1}, // 2013-11-11 停止更新
  {tname:'年代访', tid:'19354', tags:[]},
  {tname:'观世变', tid:'19353', tags:[]},
  {tname:'自由谈', tid:'19346', tags:[]},
  {tname:'大学问', tid:'19347', tags:[]},
  {tname:'非常道', tid:'19356', tags:[]},
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
      obj.ptime = jObj.editTime; // 2014-01-12 13:30:00
      obj.time = Date.parse(obj.ptime); // 1389504600000
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

var crawlerSubscribe = function (entry) {
  var headlineLink = 'http://api.3g.ifeng.com/iosNews?id=aid=SYLB10,SYDT10&imgwidth=480,100&type=list,list&pagesize=20,20&page=%d&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005';
  var docListUrl = 'http://api.3g.ifeng.com/origin_doc_list?id=%s&pageindex=%d&pagesize=20&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005';
  var MAX_PAGE_NUM = 1;
  var page = 1;

  if(entry.tid === '1') { // 头条
    MAX_PAGE_NUM = 5;
  }
  if(entry.crawlFlag) {
    MAX_PAGE_NUM = 10;
    entry.crawlFlag = 0;
  }
  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    var url = util.format(docListUrl, entry.tid, page);
    if(entry.tid === '1') { // 头条
      url = util.format(headlineLink, page);
    }
    var req = {uri: url, method: "GET", headers: headers};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
    request(req, function (err, res, body) {
      var json = data2Json(err, res, body);
      if(!json || !json[0] || !json[0].body || !json[0].body.item) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():JSON.parse() error");
        return;
      }
      var newsList = json[0].body.item;
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():newsList empty in url " + url);
        return;
      }
      newsList.forEach(function(newsEntry) {
        newsEntry.tagName = findTagName(newsEntry.title, entry)
        if(!newsEntry.tagName) {
          return;
        }
        News.findOne(genFindCmd(site, newsEntry.documentId), function(err, result) {
          if(err || result) {
            return;
          }
          console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.documentId);
          startGetDetail.emit('startGetNewsDetail', newsEntry);
        }); // News.findOne
      });//forEach
    });//request
    })(page);
  }//for
};

var crawlerIfengSubscribes = function() {
  ifengSubscribes.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    crawlerSubscribe(entry);
  });//forEach
}

var ifengCrawler = function() {
  console.log('Start ifengCrawler() at ' + new Date());
  crawlerIfengSubscribes()
  setTimeout(ifengCrawler, 2000 * 60 * 60);
}

var crawlerInit = function() {
  ifengSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
}

exports.ifengCrawler = ifengCrawler;
exports.ifengTags = ifengSubscribes;
crawlerInit();
ifengCrawler();