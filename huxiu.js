var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var huxiuTags = require('config').Config.huxiuTags;
var tags = _.keys(huxiuTags);
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var genFindCmd = require('./lib/utils').genFindCmd;
var encodeDocID = require('./lib/utils').encodeDocID;
var genDigest = require('./lib/utils').genDigest;
var timestamp2date = require('./lib/utils').timestamp2date;

var headers = {
  'mAuthorKey': '',
  'x-uid': '',
  'x-username': '',
  'x-platform': 'AndroidMI 2',
  'x-machine-id': '00000000-7c2c-2bc9-0000-000000000000',
  'x-client-version': '0.3.0',
  'x-app-version': '2',
  'x-timeline': '1375336249000',
  'Host': 'android.m.huxiu.com',
  'Connection': 'Keep-Alive',
  'User-Agent': 'Apache-HttpClient/UNAVAILABLE (java 1.4)'
};

var site = "huxiu";

var categorys = [
  {cateid:1, first:1, label:"看点", name:"/portal/1/", pagesize:20, maxpage:276},
  {cateid:6, first:1, label:"读点", name:"/portal/6/", pagesize:20, maxpage:18},
  {cateid:4, first:1, label:"观点", name:"/portal/4/", pagesize:20, maxpage:164},
];

function genBodyHtmlAndImg(obj) {
  var body = "";
  var img = [];
  var text = "";
  var j = 0;
  var reg = new RegExp("<img.+?src=[\'\"]http(?!http).+?[\'\"].+?\\/>","g");
  var regrn = new RegExp("\r\n","g");

  if((!obj) || (!obj.content)) {
    console.log("hzfdbg file[" + __filename + "]" + " genBodyHtmlAndImg():null");
    console.log(util.inspect(obj));
    return "";
  }

  //console.log("hzfdbg file[" + __filename + "]" + " genBodyHtmlAndImg() util.inspect(obj.content)="+util.inspect(obj));
  if(obj.content.length) {
    text = obj.content;
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
  // http://android.m.huxiu.com/article/17962/1
  var url = util.format('http://android.m.huxiu.com/article/%s/1', entry.aid);
  request({uri: url, method: "GET", headers: headers/*, proxy: "http://127.0.0.1:7788"*/}, function (err, res, body) {
    if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():error");
        console.log(err);console.log(url);/*console.log(util.inspect(res));*/console.log(body);
        return;
    }
    var json = null;
    try {
      json = JSON.parse(body);
    }
    catch (e) {
      json = null;
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():JSON.parse() catch error");
      console.log(e);
    }
    if((!json) || (json.result != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():ret="+json.result);
      return;
    }

    News.findOne(genFindCmd(site, entry.aid), function(err, result) {
      if(err) {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.findOne():error " + err);
        return;
      }
      if (result) {
        //console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.findOne():exist ");
        return;
      }
      var obj = json.content;
      var bodyimg = genBodyHtmlAndImg(json.content);
      obj.docid = encodeDocID(site, entry.aid);
      obj.site = site;
      obj.body = bodyimg.body;
      obj.img = bodyimg.img;
      obj.link = json.content.url;
      if(!obj.link) {
        obj.link = util.format("http://www.huxiu.com/article/%s/1.html", entry.aid); // http://www.huxiu.com/article/17962/1.html
      }
      obj.title = entry.title;
      obj.ptime = timestamp2date(entry.dateline);
      obj.time = new Date(Date.parse(obj.ptime));
      obj.marked = obj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.cateid = entry.cateid;
      obj.pageindex = entry.pageindex;
      obj.digest = genDigest(obj.body);
      obj.cover = entry.img;
      if (!entry.img && obj.img[0]) {
        obj.cover = obj.img[0];
      }

      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
        }
      }); // News.insert
    }); // News.findOne
  }); // request
};

var crawlerCategory = function (entry) {
  var MAX_PAGE_NUM = 2;
  var page = 1;

  if(entry.first == 1) {
    entry.first = 0;
    MAX_PAGE_NUM = 1 + entry.maxpage;
  }

  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    // http://android.m.huxiu.com/portal/1/1
    var url = util.format("http://android.m.huxiu.com/portal/%d/%d", entry.cateid, page);
    request({uri: url, method: "GET", headers: headers/*, proxy: "http://127.0.0.1:7788"*/}, function (err, res, body) {
      if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():error");
        console.log(err);console.log(url);/*console.log(util.inspect(res));*/console.log(body);
        return;
      }
      var json = null;
      try {
        json = JSON.parse(body);
      }
      catch (e) {
        json = null;
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():JSON.parse() catch error");
        console.log(e);
      }
      if(!json) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():JSON.parse() error");
        return;
      }
      if(json.result != 0) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():result="+json.result+",url="+url);
        return;
      }
      var newsList = json.content;
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
              if("早报" == newsEntry.tagName) {
                newsEntry.tagName = "虎嗅早报";
              }

              News.findOne(genFindCmd(site,newsEntry.aid), function(err, result) {
                if(err) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory(), News.findOne():error " + err);
                  return;
                }
                if (!result) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.aid);
                  startGetDetail.emit('startGetNewsDetail', newsEntry);
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

var huxiuCrawler = function() {
  console.log("hzfdbg file[" + __filename + "]" + " huxiuCrawler():Start time="+new Date());

  categorys.forEach(function(entry) {
    crawlerCategory(entry);
  });//forEach

  setTimeout(huxiuCrawler, 1000 * 60 * 30);
}

exports.huxiuCrawler = huxiuCrawler;
huxiuCrawler();