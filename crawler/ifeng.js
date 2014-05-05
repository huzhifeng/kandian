var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var News = require('../models/news');
var utils = require('../lib/utils')
var genLazyLoadHtml = utils.genLazyLoadHtml;
var genJwPlayerEmbedCode = utils.genJwPlayerEmbedCode;
var genFindCmd = utils.genFindCmd;
var encodeDocID = utils.encodeDocID;
var data2Json = utils.data2Json;
var genDigest = utils.genDigest;
var findTagName = utils.findTagName;
var crawlFlag = require('config').Config.crawlFlag;

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
      '洞见', // 2014-02-02 停止更新
      //'深度',
      '独家评',
      '轻新闻', // 2013-11-19 停止更新
      '影像志', // 2013-09-26 停止更新
      '真相80', // 2014-01-14 停止更新
      '独家图表',
      '百部穿影', // 2013-12-05 停止更新 //http://ent.ifeng.com/movie/special/baibuchuanying/
      '凤凰网评', // 2013-11-12 停止更新
      '每日热词', // 2013-09-03 停止更新
      '教科书之外', // 2013-09-06 停止更新
      '科技能见度', // 2014-01-31 停止更新
      //'凤凰调查局', // TODO
      '历史上的今天',
    ]
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
  {tname:'健康365', tid:'21701', tags:[]},
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
  {tname:'情感夜话', tid:'21702', tags:[]},
  {tname:'专家谈', tid:'19350', tags:[], stopped:1}, // 2013-12-09 停止更新
  {tname:'热追踪', tid:'19349', tags:[], stopped:1}, // 2013-12-16 停止更新
  {tname:'精英范', tid:'19348', tags:[], stopped:1}, // 2013-11-11 停止更新
  {tname:'年代访', tid:'19354', tags:[]},
  {tname:'观世变', tid:'19353', tags:[]},
  {tname:'自由谈', tid:'19346', tags:[]},
  {tname:'大学问', tid:'19347', tags:[]},
  {tname:'非常道', tid:'19356', tags:[]},
  // 非新闻
  // http://api.3g.ifeng.com/iosNews?id=YC10&page=1&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  // http://api.3g.ifeng.com/iosNews?id=YC10&page=2&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  {
    tname:'非新闻',
    tid:'YC10',
    tags:[
      '刺点',
      '洋跟帖',
      '独家图解',
    ]
  },
  // 自媒体
  // http://api.3g.ifeng.com/iosNews?id=ZMT10&page=1&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  // http://api.3g.ifeng.com/iosNews?id=ZMT10&page=2&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
];

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

var getNewsDetail = function(entry) {
  // http://api.3g.ifeng.com/ipadtestdoc?imgwidth=100&aid=imcp_80779130&channel=push&chid=push&android=1&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  // http://api.3g.ifeng.com/ipadtestdoc?aid=74868287&channel=%E6%96%B0%E9%97%BB
  // http://api.3g.ifeng.com/ipadtestdoc?aid=74868287
  // http://api.3g.ifeng.com/ipadtestdoc?aid=imcp_74868287
  var docid = util.format("%s",entry.documentId);
  var url = entry.id;
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json || !json.body || !json.body.text) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():[" + entry.tagName + "] json null");
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
      obj.body = '';
      if(jObj.videos) {
        for(var i=0; i<jObj.videos.length; i++) {
          obj.body += genJwPlayerEmbedCode(util.format("vid_%s", jObj.videos[i].guid), jObj.videos[i].video.HD.src || jObj.videos[i].video.Normal.src, jObj.videos[i].thumbnail, i===0);
        }
      }
      obj.body += jObj.text.replace(/width=["']140["']/g, '');
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

      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():["+obj.tags+"]"+obj.title+",docid="+obj.docid);
      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
        }
      }); // News.insert
    }); // News.findOne
  });// request
};

var crawlerSubscribe = function (entry) {
  var url = util.format('http://api.3g.ifeng.com/android2GList?id=aid=ORIGIN%s&type=list&pagesize=20&pageindex=%d', entry.tid, entry.page);
  if(entry.tid === '1') { // 头条
    url = util.format('http://api.3g.ifeng.com/iosNews?id=SYLB10,SYDT10&page=%d&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005', entry.page);
  }else if(entry.tid === 'YC10') { // 非新闻
    url = util.format('http://api.3g.ifeng.com/iosNews?id=YC10&page=%d&gv=4.1.5&av=4.1.5&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005', entry.page);
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
      if(!newsEntry.title || !newsEntry.documentId) {
        return;
      }
      newsEntry.tagName = findTagName(newsEntry.title, entry);
      if(!newsEntry.tagName) {
        return;
      }
      News.findOne(genFindCmd(site, newsEntry.documentId), function(err, result) {
        if(err || result) {
          return;
        }
        startGetDetail.emit('startGetNewsDetail', newsEntry);
      }); // News.findOne
    });//forEach
    if(entry.crawlFlag) {
      if(newsList.length === 20) {
        entry.page += 1;
        console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():["+entry.tname+"] next page="+entry.page);
        setTimeout(function() {
          crawlerSubscribe(entry);
        }, 3000); // crawl next page after 3 seconds
      }else {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():["+entry.tname+"] last page");
        entry.crawlFlag = 0;
      }
    }
  });//request
};

var crawlerIfengSubscribes = function() {
  ifengSubscribes.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    entry.page = 1;
    crawlerSubscribe(entry);
  });//forEach
}

var ifengCrawler = function() {
  console.log('Start ifengCrawler() at ' + new Date());
  crawlerIfengSubscribes();
  setTimeout(ifengCrawler, 2000 * 60 * 60);
}

var crawlerInit = function() {
  if(process.argv[2] == 1) {
    crawlFlag = 1;
  }
  ifengSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
}

exports.ifengCrawler = ifengCrawler;
exports.ifengTags = ifengSubscribes;
crawlerInit();
ifengCrawler();
