var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var ifengTags = require('config').Config.ifengTags;
var tags = _.keys(ifengTags);
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var genFindCmd = require('./lib/utils').genFindCmd;
var encodeDocID = require('./lib/utils').encodeDocID;
var jsdom = require("jsdom").jsdom;

var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.1.1; MI 2 MIUI/JLB5.0)',
  'Host': 'api.3g.ifeng.com',
  'Connection': 'Keep-Alive',
};
var site = 'ifeng';

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
    if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():error");
        console.log(err);console.log(url);console.log(util.inspect(res));console.log(body);
        return;
    }
    //console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail() util.inspect(body)="+util.inspect(body));
    var json = null;
    try {
      json = JSON.parse(body);
    }
    catch (e) {
      json = null;
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():JSON.parse() catch error");
      console.log(e);
      return;
    }
    if(!json) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():json null");
      return;
    }
    var jObj = json.body;
    var obj = entry;
    News.findOne(genFindCmd(site, docid), function(err, result) {
      if(err) {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.findOne():error " + err);
        return;
      }
      if (result) {
        //console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.findOne():exist ");
        return;
      }
      obj.docid = encodeDocID(site, docid);
      obj.site = site;
      obj.body = jObj.text.replace(/width=["']140["']/g, '');
      obj.img = jObj.img;
      obj.video = [];
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

      //remove all html tag,
      //refer to <<How to remove HTML Tags from a string in Javascript>>
      //http://geekswithblogs.net/aghausman/archive/2008/10/30/how-to-remove-html-tags-from-a-string-in-javascript.aspx
      //and https://github.com/tmpvar/jsdom
      var window = jsdom().createWindow();
      var mydiv = window.document.createElement("div");
      mydiv.innerHTML = obj.body;
      // digest
      var maxDigest = 300;
      obj.digest = mydiv.textContent.slice(0,maxDigest);

      // cover
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

      // img lazyloading
      for(i=0; i<obj.img.length; i++) {
        //var imgHtml = genLazyLoadHtml(obj.title, obj.img[i].url);
        //obj.marked = obj.marked.replace(/<img.*?\/>/gi, imgHtml);
        //console.log("hzfdbg file[" + __filename + "]" + " imgHtml="+imgHtml);
      };

      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
        }
      }); // News.insert
    }); // News.findOne
  });// request
};

var crawlerHeadLineFirstTime = 0; //Crawl more pages at the first time
var crawlerHeadLine = function () {
  // http://api.3g.ifeng.com/iosNews?id=aid=SYLB10,SYDT10&imgwidth=480,100&type=list,list&pagesize=20,20&page=1&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  // http://api.3g.ifeng.com/iosNews?id=aid=SYLB10,SYDT10&imgwidth=480,100&type=list,list&pagesize=20,20&page=56&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005
  var headlineLink = 'http://api.3g.ifeng.com/iosNews?id=aid=SYLB10,SYDT10&imgwidth=480,100&type=list,list&pagesize=20,20&page=%d&gv=4.0.8&av=4.0.8&uid=c4:6a:b7:de:4d:24&proid=ifengnews&os=android_16&df=androidphone&vt=5&screen=720x1280&publishid=2005';
  var MAX_PAGE_NUM = 3;
  var page = 1;
  if(crawlerHeadLineFirstTime) {
    //console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): All");
    MAX_PAGE_NUM = 56;
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
      if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():error");
        console.log(err);console.log(url);/*console.log(util.inspect(res));*/console.log(body);
        return;
      }
      var json = null;
      try {
        json = JSON.parse(body);
      }
      catch (e) {
        json = null;
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():JSON.parse() catch error");
        console.log(e);
      }
      if(!json) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():JSON.parse() error");
        return;
      }
      var newsList = json[0].body.item;
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():newsList empty in url " + url);
        return;
      }
      newsList.forEach(function(newsEntry) {
        for(var i = 0; i < tags.length; i++) {
          if(ifengTags[tags[i]].indexOf("ifeng_") === -1) {//crawlerTags will handle these tags, so skip them here
            continue;
          }
          try {
            if (newsEntry.title.indexOf(tags[i]) !== -1) {
              newsEntry.tagName = tags[i];
              News.findOne(genFindCmd(site, newsEntry.documentId), function(err, result) {
                if(err) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(), News.findOne():error " + err);
                  return;
                }
                if (!result) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.documentId);
                  startGetDetail.emit('startGetNewsDetail', newsEntry);
                }
              }); // News.findOne
            }
          }
          catch (e) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): catch error");
            console.log(e);
            continue;
          }
        }//for
      });//forEach
    });//request
    })(page);
  }//for
};

var ifengCrawler = function() {
  console.log("hzfdbg file[" + __filename + "]" + " ifengCrawler():Date="+new Date());
  crawlerHeadLine();
  setTimeout(ifengCrawler, 1000 * 60 * 60);
}

exports.ifengCrawler = ifengCrawler;
ifengCrawler();