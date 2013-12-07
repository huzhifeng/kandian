var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var jsdom = require("jsdom").jsdom;
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var genFindCmd = require('./lib/utils').genFindCmd;
var encodeDocID = require('./lib/utils').encodeDocID;
var data2Json = require('./lib/utils').data2Json;
var genDigest = require('./lib/utils').genDigest;
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';

var site = "36kr";
var headers = {
  'Host': 'apis.36kr.com',
  'Connection': 'Keep-Alive',
  'User-Agent':'android-async-http/1.4.1 (http://loopj.com/android-async-http)',
};
var krTags = [
  '8点1氪',
  '创业说',
  '氪周刊',
  '氪月报',
  '超人计划',
  '36氪+',
  '36氪开放日',
];
var categorys = [
  {cateid:1, first:0, label:"首页", name:"topics", pagesize:10, maxpage:1719},
  //{cateid:2, first:0, label:"国外创业公司", name:"topics/category/us-startups", pagesize:10, maxpage:114},
  //{cateid:3, first:0, label:"国内创业公司", name:"topics/category/cn-startups", pagesize:10, maxpage:56},
  //{cateid:4, first:0, label:"国外资讯", name:"topics/category/breaking", pagesize:10, maxpage:706},
  //{cateid:5, first:0, label:"国内资讯", name:"topics/category/cn-news", pagesize:10, maxpage:64},
  //{cateid:6, first:0, label:"生活方式", name:"topics/category/digest", pagesize:10, maxpage:82},
  //{cateid:7, first:0, label:"专栏文章", name:"topics/category/column", pagesize:10, maxpage:160},//该栏目没有body_html属性,可以通过util.format("http://apis.36kr.com/api/v1/topics/%s.json?token=734dca654f1689f727cc:32710", newsEntry.id)得到
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

    News.insert(obj, function (err, result) {
      if(err) {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
      }
    }); // News.insert
  }); // News.findOne
};

var crawlerCategory = function (entry) {
  var MAX_PAGE_NUM = 5;
  var page = 1;

  if(entry.first == 1) {
    entry.first = 0;
    MAX_PAGE_NUM = entry.maxpage;
  }

  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    //http://apis.36kr.com/api/v1/topics.json?token=734dca654f1689f727cc:32710&page=1&per_page=10
    //http://apis.36kr.com/api/v1/topics/category/column.json?token=734dca654f1689f727cc:32710&page=1&per_page=10
    var url = util.format("http://apis.36kr.com/api/v1/%s.json?token=734dca654f1689f727cc:32710&page=%d&per_page=%d", entry.name, page, entry.pagesize);
    var req = {uri: url, method: "GET", headers: headers};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
    request(req, function (err, res, body) {
      var json = data2Json(err, res, body);
      if(!json) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():JSON.parse() error");
        return;
      }
      var newsList = json;
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():newsList empty in url " + url);
        return;
      }
      newsList.forEach(function(newsEntry) {
        if(!newsEntry.title || !newsEntry.id || !newsEntry.body_html) {
          return;
        }
        for(var i=0; i<krTags.length; i++) {
          if (newsEntry.title.indexOf(krTags[i]) !== -1) {
            newsEntry.tagName = krTags[i];
            newsEntry.cateid = entry.cateid;
            newsEntry.pageindex = page;

            News.findOne(genFindCmd(site,newsEntry.id), function(err, result) {
              if(err || result) {
                return;
              }
              console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.id);
              startGetDetail.emit('startGetNewsDetail', newsEntry);
            }); // News.findOne
            break;
          } // if
        }//for
      });//forEach
    });//request
    })(page);
  }//for
};

var krCrawler = function() {
  categorys.forEach(function(entry) {
    crawlerCategory(entry);
  });

  setTimeout(krCrawler, 4000 * 60 * 60);
}

exports.krCrawler = krCrawler;
krCrawler();