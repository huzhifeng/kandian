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
var moment = require('moment');
var crawlFlag = require('config').Config.crawlFlag;

var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent':'Apache-HttpClient/UNAVAILABLE (java 1.4)',
  'Content-Type': 'application/x-www-form-urlencoded',
  'ha': '110129126',
  'ham': 'WIFI',
  'hc': '800',
  'hi': '151',
  'hmd': 'MI+2',
  'hsv': '4.1.1',
  'hsz': '%7B720%7D*%7B1280%7D',
  'hu': '1c4787be-ad82-4d4b-a2f0-63847c48e76a',
  'hv': '1.3.1',
  'Connection': 'Keep-Alive',
  'Host': 'mobservices3.yoka.com',
};
var site = "yoka";
var yokaTags = [
  '笑到抽筋',
  '明星皆为微博狂',
  '看图说事',
  '常识懂不懂',
  '家里造',
  '娱乐串烧',
  '男人出街指南',
  '测一测',
  '排行榜',
  '盘点',
  '星妆容红黑榜',
  '星大片',
  '星扒客',
  '星私录',
  '达人极品晒',
  '谁八卦啊你八卦',
  '穿衣奇葩货',
  '十万个护肤冷知识',
  '周六蹲点儿看街拍',
  '麻辣男题',
  '每日时髦不NG',
  '一周穿衣红榜',
  '1日1话题',
];

var yokaSubscribes = [
  {tname:'精华', tid:'12', tags:yokaTags},
  //{tname:'时装', tid:'2', tags:yokaTags},
  //{tname:'美容', tid:'1', tags:yokaTags},
  //{tname:'明星', tid:'6', tags:yokaTags},
  //{tname:'男人', tid:'13', tags:yokaTags},
  //{tname:'生活', tid:'3', tags:yokaTags},
  //{tname:'奢品', tid:'9', tags:yokaTags},
];

var startGetDetail = new EventEmitter();
startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

function genBodyHtmlAndImg(obj) {
  var body = "";
  var img = [];
  var text = "";
  var i = 0, j = 0;
  var reg = new RegExp("\\[img\\]http(?!http).+?\\[\\/img\\]","g");//[img]http://p1.yokacdn.com/pic/2011/U278P1T1D519022F9DT20110818091750.jpg[/img]
  var regrn = new RegExp("\r\n","g");

  if((!obj) || (!obj.Data)) {
    console.log("hzfdbg file[" + __filename + "]" + " genBodyHtmlAndImg():null");
    return "";
  }

  body = obj.Title + "<br/>";
  var list = obj.Data;

  for(i=0; i<list.length; i++) {
    if(list[i].Content.length) {
      text = list[i].Content;
      text = text.replace(reg, function(url){
        url = url.replace("[img]","");
        url = url.replace("[/img]","");
        img[j] = url;
        j += 1;
        return genLazyLoadHtml(obj.Shorttitle, url);
      });
      text = text.replace(regrn,function(match) {
        return "<br/>";
      });
      body += text;
    }else {
      console.log("hzfdbg file[" + __filename + "]" + " genBodyHtmlAndImg():text null");
      continue;
    }
  }

  return {"body":body, "img":img};
}

var getNewsDetail = function(entry) {
  var docid = util.format("%s",entry.ID);
  var url = 'http://mobservices3.yoka.com/service.ashx';
  headers.hi = '152';
  var req = {uri: url, method: "POST", headers: headers, form: {'aid':docid}};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json || !json.State || (json.State.Code && json.State.Code != 0) || !json.Contents || !json.Contents.Data) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():[" + entry.tagName + "] json null");
      return;
    }
    var jObj = json.Contents;
    var obj = entry;
    News.findOne(genFindCmd(site, docid), function(err, result) {
      if(err || result) {
        return;
      }
      var obj = jObj;
      var bodyimg = genBodyHtmlAndImg(jObj);
      obj.docid = encodeDocID(site, entry.ID);
      obj.site = site;
      obj.body = bodyimg.body;
      obj.img = bodyimg.img;
      if(jObj.ShareUrl) {
        obj.link = jObj.ShareUrl; // http://3g.yoka.com/m/id301255
      }else {
        obj.link = util.format("http://3g.yoka.com/m/id%s", entry.ID); // http://3g.yoka.com/m/id301255
      }
      obj.title = entry.Title;
      obj.time = Date.parse(entry.ArticleTime); // 2014-02-09 16:21:47.000 -> 1391934107000
      obj.ptime = moment(obj.time).format('YYYY-MM-DD HH:mm:ss'); // 2014-02-09 16:21:47
      obj.marked = obj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.digest = genDigest(obj.body);
      obj.cover = entry.Image;
      if (!entry.Image && obj.img && obj.img.length) {
        obj.cover = obj.img[0];
      }

      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():["+obj.tags+"]"+obj.title+",docid="+obj.docid);
      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
        }
      }); // News.insert
    }); // News.findOne
  });//request
};

var crawlerSubscribe = function (entry) {
  var url = 'http://mobservices3.yoka.com/service.ashx';
  var pd = {'cateid':entry.tid, 'pagesize':entry.pagesize, 'arttime':entry.arttime, 'previd':entry.previd};
  headers.hi = '151';
  var req = {uri: url, method: "POST", headers: headers, form: pd};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json || !json.State || (json.State.Code && json.State.Code != 0) || !json.Contents || !json.Contents.Data) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():JSON.parse() error");
      return;
    }
    var newsList = json.Contents.Data;
    if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():newsList empty in url " + url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if(!newsEntry.Title || !newsEntry.ID) {
        return;
      }
      newsEntry.tagName = findTagName(newsEntry.Title, entry) || findTagName(newsEntry.Summary, entry);
      if(!newsEntry.tagName) {
        return;
      }
      News.findOne(genFindCmd(site, newsEntry.ID), function(err, result) {
        if(err || result) {
          return;
        }
        startGetDetail.emit('startGetNewsDetail', newsEntry);
      }); // News.findOne
    });//forEach
    if(entry.crawlFlag) {
      if(newsList.length === entry.pagesize) {
        entry.page += 1;
        entry.arttime = newsList[newsList.length - 1].ArticleTime;
        entry.previd = newsList[newsList.length - 1].ID;
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

var crawlerYokaSubscribes = function() {
  yokaSubscribes.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    entry.page = 1;
    entry.pagesize = 10;
    entry.arttime = '0';
    entry.previd = '0';
    crawlerSubscribe(entry);
  });//forEach
}

var yokaCrawler = function() {
  console.log('Start yokaCrawler() at ' + new Date());
  crawlerYokaSubscribes();
  setTimeout(yokaCrawler, 4000 * 60 * 60);
}

var crawlerInit = function() {
  if(process.argv[2] == 1) {
    crawlFlag = 1;
  }
  yokaSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
}

exports.yokaCrawler = yokaCrawler;
exports.yokaTags = yokaSubscribes;
crawlerInit();
yokaCrawler();
