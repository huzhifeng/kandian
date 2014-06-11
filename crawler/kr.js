var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var jsdom = require("jsdom").jsdom;
var News = require('../models/news');
var utils = require('../lib/utils')
var genLazyLoadHtml = utils.genLazyLoadHtml;
var genFindCmd = utils.genFindCmd;
var encodeDocID = utils.encodeDocID;
var data2Json = utils.data2Json;
var genDigest = utils.genDigest;
var findTagName = utils.findTagName;
var crawlFlag = require('config').Config.crawlFlag;
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';

var site = "36kr";
var headers = {
  'Host': 'apis.36kr.com',
  'Connection': 'Keep-Alive',
  'User-Agent':'android-async-http/1.4.1 (http://loopj.com/android-async-http)',
};
var krSubscribes = [
  {
    tname:'首页',
    tid:'topics',
    tags:[
      '8点1氪',
      '创业说',
      '氪周刊',
      '氪月报',
      '36氪开放日',
    ]
  },
  //{tname:'国外创业公司', tid:'topics/category/us-startups', tags:[]},
  //{tname:'国内创业公司', tid:'topics/category/cn-startups', tags:[]},
  //{tname:'国外资讯', tid:'topics/category/breaking', tags:[]},
  //{tname:'国内资讯', tid:'topics/category/cn-news', tags:[]},
  //{tname:'生活方式', tid:'topics/category/digest', tags:[]},
  //{tname:'专栏文章', tid:'topics/category/column', tags:[]}, //该栏目没有body_html属性,可以通过util.format("http://apis.36kr.com/api/v1/topics/%s.json?token=734dca654f1689f727cc:32710", newsEntry.id)得到
];

var startGetDetail = new EventEmitter();
startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

function genBodyHtmlAndImg(obj) {
  var body = "";
  var img = [];
  var text = "";
  var j = 0;
  var reg = new RegExp("<img.+?src=[\'\"]http(?!http).+?[\'\"].+?\\/>","g");
  var regrn = new RegExp("\r\n","g");

  if((!obj) || (!obj.body_html)) {
    console.log("hzfdbg file[" + __filename + "]" + " genBodyHtmlAndImg():null");
    return "";
  }

  if(obj.body_html.length) {
    text = obj.body_html;
    text = text.replace(reg, function(url){
      var document = jsdom(url);
      var e = document.getElementsByTagName('img');
      url = e[0].getAttribute("src");
      img[j] = url;
      j += 1;
      return genLazyLoadHtml(obj.title, url);
    });
    text = text.replace(regrn,function(match) {
      return "<br/>";
    });
    body += text;
  }

  return {"body":body, "img":img};
}

var getNewsDetail = function(entry) {
  var bodyimg = genBodyHtmlAndImg(entry);

  News.findOne(genFindCmd(site, entry.id), function(err, result) {
    if(err || result) {
      return;
    }
    var obj = entry;
    obj.docid = encodeDocID(site, entry.id);
    obj.site = site;
    obj.body = bodyimg.body;
    obj.img = bodyimg.img;
    obj.link = util.format("http://www.36kr.com/t/%s", entry.id); // http://www.36kr.com/t/204970
    obj.title = entry.title;
    obj.excerpt = entry.excerpt;
    obj.ptime = entry.created_at;
    obj.time = new Date(Date.parse(entry.created_at));
    obj.marked = obj.body;
    obj.created = new Date();
    obj.views = 1;
    obj.tags = entry.tagName;
    obj.digest = genDigest(obj.body);
    obj.cover = entry.feature_img;
    if (!entry.feature_img && obj.img[0]) {
      obj.cover = obj.img[0];
    }

    console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():["+obj.tags+"]"+obj.title+",docid="+obj.docid);
    News.insert(obj, function (err, result) {
      if(err) {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
      }
    }); // News.insert
  }); // News.findOne
};

var crawlerSubscribe = function (entry) {
  //http://apis.36kr.com/api/v1/topics.json?token=734dca654f1689f727cc:32710&page=1&per_page=10
  //http://apis.36kr.com/api/v1/topics/category/column.json?token=734dca654f1689f727cc:32710&page=1&per_page=10
  var url = util.format("http://apis.36kr.com/api/v1/%s.json?token=734dca654f1689f727cc:32710&page=%d&per_page=%d", entry.tid, entry.page, entry.pageSize);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():JSON.parse() error");
      return;
    }
    var newsList = json;
    if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():newsList empty in url " + url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if(!newsEntry.title || !newsEntry.id || !newsEntry.body_html) {
        return;
      }
      newsEntry.tagName = findTagName(newsEntry.title, entry);
      if(!newsEntry.tagName) {
        return;
      }
      News.findOne(genFindCmd(site,newsEntry.id), function(err, result) {
        if(err || result) {
          return;
        }
        startGetDetail.emit('startGetNewsDetail', newsEntry);
      }); // News.findOne
    });//forEach
    if(entry.crawlFlag) {
      if(newsList.length >= entry.pageSize) {
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

var crawlerKrSubscribes = function () {
  krSubscribes.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    entry.page = 1;
    entry.pageSize = 10;
    crawlerSubscribe(entry);
  });
}

var krCrawler = function() {
  console.log('Start krCrawler() at ' + new Date());
  crawlerKrSubscribes();
  setTimeout(krCrawler, 4000 * 60 * 60);
}

var crawlerInit = function() {
  if(process.argv[2] == 1) {
    crawlFlag = 1;
  }
  krSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
}

exports.krCrawler = krCrawler;
crawlerInit();
krCrawler();
