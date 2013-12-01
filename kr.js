var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var jsdom = require("jsdom").jsdom;
var krTags = require('config').Config.krTags;
var tags = _.keys(krTags);
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var genFindCmd = require('./lib/utils').genFindCmd;
var encodeDocID = require('./lib/utils').encodeDocID;
var data2Json = require('./lib/utils').data2Json;
var genDigest = require('./lib/utils').genDigest;
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';

var headers = {
  'Host': 'apis.36kr.com',
  'Connection': 'Keep-Alive',
  'User-Agent':'android-async-http/1.4.1 (http://loopj.com/android-async-http)',
  //'Accept-Encoding': 'gzip' //Do not enable gzip
};

var site = "36kr";

var categorys = [
  {cateid:1, first:1, label:"首页", name:"topics", pagesize:10, maxpage:1719},
  {cateid:2, first:1, label:"国外创业公司", name:"topics/category/us-startups", pagesize:10, maxpage:114},
  {cateid:3, first:1, label:"国内创业公司", name:"topics/category/cn-startups", pagesize:10, maxpage:56},
  {cateid:4, first:1, label:"国外资讯", name:"topics/category/breaking", pagesize:10, maxpage:706},
  {cateid:5, first:1, label:"国内资讯", name:"topics/category/cn-news", pagesize:10, maxpage:64},
  {cateid:6, first:1, label:"生活方式", name:"topics/category/digest", pagesize:10, maxpage:82},
  {cateid:7, first:1, label:"专栏文章", name:"topics/category/column", pagesize:10, maxpage:98},
];

function genBodyHtmlAndImg(obj) {
  var body = "";
  var img = [];
  var text = "";
  var j = 0;
  var reg = new RegExp("<img.+?src=[\'\"]http(?!http).+?[\'\"].+?\\/>","g");
  var regrn = new RegExp("\r\n","g");

  if((!obj) || (!obj.body_html)) {
    console.log("hzfdbg file[" + __filename + "]" + " genBodyHtmlAndImg():null");
    console.log(util.inspect(obj));
    return "";
  }

  //console.log("hzfdbg file[" + __filename + "]" + " genBodyHtmlAndImg() util.inspect(obj.body_html)="+util.inspect(obj));
  if(obj.body_html.length) {
    text = obj.body_html;
    text = text.replace(reg, function(url){
      var document = jsdom(url);
      var e = document.getElementsByTagName('img');
      url = e[0].getAttribute("src");
      img[j] = url;
      j += 1;
      //console.log("url="+url);
      return genLazyLoadHtml(obj.title, url);
    });
    text = text.replace(regrn,function(match) {
      return "<br/>";
    });
    body += text;//console.log("body="+body);
  }

  return {"body":body, "img":img};
}

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

var getNewsDetail = function(entry) {
  var bodyimg = genBodyHtmlAndImg(entry);

  News.findOne(genFindCmd(site, entry.id), function(err, result) {
    if(err) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.findOne():error " + err);
      return;
    }
    if (result) {
      //console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.findOne():exist ");
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
  var MAX_PAGE_NUM = 3;
  var page = 1;

  if(entry.first == 1) {
    entry.first = 0;
    MAX_PAGE_NUM = 5;//1 + entry.maxpage;
  }

  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    //http://apis.36kr.com/api/v1/topics.json?token=734dca654f1689f727cc:32710&page=1&per_page=10
    //http://apis.36kr.com/api/v1/topics/category/us-startups.json?token=734dca654f1689f727cc:32710&page=1&per_page=10
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
        //console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():title="+newsEntry.title);
        for(var i = 0; i < tags.length; i++) {
          try {
            if (newsEntry.title.indexOf(tags[i]) !== -1) {
              //console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():title="+newsEntry.title);
              newsEntry.tagName = tags[i];
              newsEntry.cateid = entry.cateid;
              newsEntry.pageindex = page;

              News.findOne(genFindCmd(site,newsEntry.id), function(err, result) {
                if(err) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory(), News.findOne():error " + err);
                  return;
                }
                if (!result) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.id);
                  if(newsEntry.body_html) {
                    startGetDetail.emit('startGetNewsDetail', newsEntry);
                  }else { // 有些较旧的文章摘要里没有body_html字段，需要访问详情获取
                    // http://apis.36kr.com/api/v1/topics/204615.json?token=734dca654f1689f727cc:32710
                    var detailUrl = util.format("http://apis.36kr.com/api/v1/topics/%s.json?token=734dca654f1689f727cc:32710", newsEntry.id);
                    var req = {uri: detailUrl, method: "GET", headers: headers};
                    if(proxyEnable) {
                      req.proxy = proxyUrl;
                    }
                    request(req, function (err, res, body) {
                      var entry = data2Json(err, res, body);
                      if(!entry) {
                        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():detailUrl JSON.parse() error");
                        return;
                      }
                      console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():detailUrl="+detailUrl);
                      newsEntry.body_html = entry.body_html;
                      startGetDetail.emit('startGetNewsDetail', newsEntry);
                    });//request
                  }
                }
              }); // News.findOne
            }
          }
          catch (e) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory(): catch error");
            console.log(e);
            continue;
          }
        }//for
      });//forEach
    });//request
    })(page);
  }//for
};

var krCrawler = function() {
  console.log("hzfdbg file[" + __filename + "]" + " krCrawler():Start time="+new Date());

  categorys.forEach(function(entry) {
    crawlerCategory(entry);
  });//forEach

  setTimeout(krCrawler, 1000 * 60 * 60);
}

exports.krCrawler = krCrawler;
krCrawler();