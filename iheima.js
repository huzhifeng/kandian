var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var iheimaTags = require('config').Config.iheimaTags;
var tags = _.keys(iheimaTags);
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var genFindCmd = require('./lib/utils').genFindCmd;
var encodeDocID = require('./lib/utils').encodeDocID;
var data2Json = require('./lib/utils').data2Json;
var genDigest = require('./lib/utils').genDigest;
var timestamp2date = require('./lib/utils').timestamp2date;
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';

var headers = {
  //'Accept-Encoding': 'gzip, deflate',//Do not enable gzip
  'app': '43',
  'device': 'aries',
  'Host': 'zhiyue.cutt.com',
  'Connection': 'Keep-Alive',
  'User-Agent': 'app43 2.0 (Xiaomi,MI 2; Android 4.1.1)'
};

var site = "iheima";

var categorys = [
  {cateid:1, first:1, label:"抄本质", clipId:"100238521", pagesize:20, offset:0},
  {cateid:2, first:1, label:"找灵感", clipId:"100238528", pagesize:20, offset:0},
  {cateid:3, first:1, label:"挖黑马", clipId:"100238575", pagesize:20, offset:0},
  {cateid:4, first:1, label:"项目诊断", clipId:"100238675", pagesize:20, offset:0},
  {cateid:5, first:1, label:"评热点", clipId:"100185712", pagesize:20, offset:0},
  {cateid:6, first:1, label:"国外精选", clipId:"100238826", pagesize:20, offset:0},
];

function genBodyHtmlAndImg(obj) {
  var body = "";
  var img = [];
  var text = "";
  var reg = new RegExp("##zhiyueImageTag##.+?##zhiyueImageTag##","g");
  var regrn = new RegExp("\r\n","g");
  var regr = new RegExp("\r","g");
  var regn = new RegExp("\n","g");

  if((!obj) || (!obj.content)) {
    console.log("hzfdbg file[" + __filename + "]" + " genBodyHtmlAndImg():null");
    console.log(util.inspect(obj));
    return "";
  }

  if(obj.note) {
    body += "<h2>浓缩观点</h2>"+obj.note + "<br />";
  }
  
  if(obj.content.length) {
    text = obj.content;
    text = text.replace(reg, function(url){
      url = url.replace("##zhiyueImageTag##","");
      url = url.replace("##zhiyueImageTag##","");
      url = util.format("http://img1.cutt.com/img/%s", url);
      img.push(url);
      //console.log("url="+url);
      return genLazyLoadHtml(obj.title, url);
    });
    text = text.replace(regrn,function(match) {
      return "<br/>";
    });
    text = text.replace(regr,function(match) {
      return "<br/>";
    });
    text = text.replace(regn,function(match) {
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
    obj.link = "";
    if(obj.cuttURL) { // http://hyb.im/43/1jAN5H
      obj.link = obj.cuttURL;
    }else if(obj.url) {
      obj.link = obj.url; // http://www.iheima.com/archives/46814.html
    }
    obj.title = entry.title;
    obj.ptime = timestamp2date(entry.articleTime); // entry.timestamp
    obj.time = new Date(Date.parse(obj.ptime));
    obj.marked = obj.body;
    obj.created = new Date();
    obj.views = 1;
    obj.tags = entry.tagName;
    obj.digest = genDigest(obj.body);
    obj.cover = "";
    if (obj.imageId) {
      obj.cover = util.format("http://img1.cutt.com/img/%s", obj.imageId); // http://img1.cutt.com/img/120612080915925554292423
    }else if(obj.img[0]) {
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
  //http://zhiyue.cutt.com/api/clip/items?clipId=100238521&full=1&offset=0&note=1
  //http://zhiyue.cutt.com/api/clip/items?clipId=100238521&full=1&offset=3896353985&note=1
  var url = util.format("http://zhiyue.cutt.com/api/clip/items?clipId=%s&full=1&offset=%s&note=1", entry.clipId, entry.offset);
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
    var newsList = json.articles;
    if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():newsList empty in url " + url);
      return;
    }
    if((-1 != json.next) && (entry.first)) {
      entry.offset = json.next;
      setTimeout(function() {
        crawlerCategory(entry);
      }, 100);
    }else {
      entry.first = 0;
      entry.offset = 0;
    }
    newsList.forEach(function(newsEntry) {
      //console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():title="+newsEntry.title);
      for(var i = 0; i < tags.length; i++) {
        try {
          if (newsEntry.title.indexOf(tags[i]) !== -1) {
            //console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():title="+newsEntry.title);
            newsEntry.tagName = tags[i];
            newsEntry.cateid = entry.cateid;

            News.findOne(genFindCmd(site,newsEntry.id), function(err, result) {
              if(err) {
                console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory(), News.findOne():error " + err);
                return;
              }
              if (!result) {
                console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.id);
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
};

var iheimaCrawler = function() {
  console.log("hzfdbg file[" + __filename + "]" + " iheimaCrawler():Start time="+new Date());

  categorys.forEach(function(entry) {
    crawlerCategory(entry);
  });//forEach

  setTimeout(iheimaCrawler, 1000 * 60 * 60);
}

exports.iheimaCrawler = iheimaCrawler;
iheimaCrawler();