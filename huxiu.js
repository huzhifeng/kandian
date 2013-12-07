var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var genFindCmd = require('./lib/utils').genFindCmd;
var encodeDocID = require('./lib/utils').encodeDocID;
var data2Json = require('./lib/utils').data2Json;
var genDigest = require('./lib/utils').genDigest;
var timestamp2date = require('./lib/utils').timestamp2date;
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';

var site = "huxiu";
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
var huxiuTags = [
  '早报',
  '今日嗅评',
  '娱见',
  '动见',
  '大话科技',
  '移动观察',
];
var categorys = [
  {cateid:1, first:0, label:"看点", name:"/portal/1/", pagesize:20, maxpage:276},
  {cateid:6, first:0, label:"读点", name:"/portal/6/", pagesize:20, maxpage:18},
  {cateid:4, first:0, label:"观点", name:"/portal/4/", pagesize:20, maxpage:164},
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

  if((!obj) || (!obj.content)) {
    console.log("hzfdbg file[" + __filename + "]" + " genBodyHtmlAndImg():null");
    return "";
  }

  if(obj.content.length) {
    text = obj.content;
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
  // http://android.m.huxiu.com/article/17962/1
  var url = util.format('http://android.m.huxiu.com/article/%s/1', entry.aid);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json || !json.content || (json.result && json.result != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():ret="+json.result);
      return;
    }

    News.findOne(genFindCmd(site, entry.aid), function(err, result) {
      if(err || result) {
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
  var MAX_PAGE_NUM = entry.maxpage > 3 ? 3 : entry.maxpage;
  var page = 1;

  if(entry.first == 1) {
    entry.first = 0;
    MAX_PAGE_NUM = entry.maxpage;
  }

  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    // http://android.m.huxiu.com/portal/1/1
    var url = util.format("http://android.m.huxiu.com/portal/%d/%d", entry.cateid, page);
    var req = {uri: url, method: "GET", headers: headers};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
    request(req, function (err, res, body) {
      var json = data2Json(err, res, body);
      if(!json || !json.content || (json.result && json.result != 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():JSON.parse() error");
        return;
      }
      var newsList = json.content;
      if(!newsList || !newsList.length || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():newsList empty in url " + url);
        return;
      }
      newsList.forEach(function(newsEntry) {
        if(!newsEntry.title || !newsEntry.aid) {
          return;
        }
        for(var i=0; i<huxiuTags.length; i++) {
          if (newsEntry.title.indexOf(huxiuTags[i]) !== -1) {
            newsEntry.tagName = huxiuTags[i];
            newsEntry.cateid = entry.cateid;
            newsEntry.pageindex = page;
            if("早报" == newsEntry.tagName) {
              newsEntry.tagName = "虎嗅早报";
            }

            News.findOne(genFindCmd(site,newsEntry.aid), function(err, result) {
              if(err || result) {
                return;
              }
              console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.aid);
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

var huxiuCrawler = function() {
  categorys.forEach(function(entry) {
    crawlerCategory(entry);
  });

  setTimeout(huxiuCrawler, 4000 * 60 * 60);
}

exports.huxiuCrawler = huxiuCrawler;
huxiuCrawler();