var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var sinaTags = require('config').Config.sinaTags;
var tags = _.keys(sinaTags);
var News = require('../models/news');
var utils = require('../lib/utils')
var genLazyLoadHtml = utils.genLazyLoadHtml;
var genFindCmd = utils.genFindCmd;
var encodeDocID = utils.encodeDocID;
var data2Json = utils.data2Json;
var genDigest = utils.genDigest;

var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': 'MI_2__sinanews__3.4.0__android__os4.1.1',
  'Host': 'api.sina.cn',
  'Connection': 'Keep-Alive',
};
var site = "sina";

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

var getNewsDetail = function(entry) {
  // http://api.sina.cn/sinago/article.json?id=124-10568626-news-cms&postt=news_news_toutiao_36&wm=b207&from=6037095012&chwm=5062_0058&oldchwm=5062_0058&imei=&uid=27ad58fc698efcc1
  var detailLink = 'http://api.sina.cn/sinago/article.json?id=%s';
  var docid = util.format("%s",entry.id);
  var url = util.format(detailLink, docid);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():JSON.parse() error");
      return;
    }
    var jObj = json.data;
    var obj = entry;

    News.findOne(genFindCmd(site, docid), function(err, result) {
      if(err || result) {
        return;
      }
      obj.docid = encodeDocID(site, docid);
      obj.site = site;
      obj.body = jObj.content;
      obj.img = [];
      if(jObj.pics) {
        var i = 0;
        var html = '';
        for(i=0; i<jObj.pics.length; i++) {
          jObj.pics[i].pic = jObj.pics[i].pic.replace(/auto\.jpg/, "original.jpg");
          html = genLazyLoadHtml(jObj.pics[i].alt, jObj.pics[i].pic) + jObj.pics[i].alt + '<br/>';
          obj.body = obj.body.replace(util.format("<!--{IMG_%d}-->", i+1), html);
          obj.img[obj.img.length] = jObj.pics[i].pic;
        }
      }
      obj.video = [];
      obj.link = "";
      if(jObj.link) {
        obj.link = jObj.link; // http://news.sina.cn/?sa=t124d8940595v2357
      }else if(entry.link) {
        obj.link = entry.link; // http://news.sina.cn/?sa=d8940595t124v71
      }else {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), link null");
      }
      obj.title = entry.title;
      obj.ptime = jObj.pubDate;
      obj.time = new Date(parseInt(obj.ptime) * 1000);
      obj.marked = obj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.digest = genDigest(obj.body);
      obj.cover = entry.pic;
      if (!entry.pic && obj.img[0]) {
        obj.cover = obj.img[0].url;
      }

      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
        }
      }); // News.insert
    }); // News.findOne
  }); // request
};

var crawlerHeadLineFirstTime = 1; //Crawl more pages at the first time
var crawlerHeadLine = function () {
  // http://api.sina.cn/sinago/list.json?channel=news_toutiao&p=1
  // http://api.sina.cn/sinago/list.json?channel=news_toutiao&p=25
  var headlineLink = 'http://api.sina.cn/sinago/list.json?channel=news_toutiao&p=%d';
  var MAX_PAGE_NUM = 3;
  var page = 1;
  if(crawlerHeadLineFirstTime) {
    MAX_PAGE_NUM = 25;
    crawlerHeadLineFirstTime = 0;
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
      if(!json || !json.data || !json.data.list) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():JSON.parse() error");
        return;
      }
      var newsList = json.data.list;
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():newsList empty in url " + url);
        return;
      }
      newsList.forEach(function(newsEntry) {
        if(!newsEntry.title || !newsEntry.id) {
          return;
        }
        for(var i = 0; i < tags.length; i++) {
          if (newsEntry.title.indexOf(tags[i]) !== -1 || (newsEntry.long_title && newsEntry.long_title.indexOf(tags[i]) !== -1)) {
            newsEntry.tagName = tags[i];
            News.findOne(genFindCmd(site, newsEntry.id), function(err, result) {
              if(err || result) {
                return;
              }
              console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.id);
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

var sinaCrawler = function() {
  console.log('Start sinaCrawler() at ' + new Date());
  crawlerHeadLine();
  setTimeout(sinaCrawler, 2000 * 60 * 60);
}

exports.sinaCrawler = sinaCrawler;
sinaCrawler();