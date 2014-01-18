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
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';

var headers = {
  'Host': 'mobservices3.yoka.com',
  'hv': '3.0.5',
  'hmd': 'iPad 3G',
  'User-Agent':'',
  'hi': '16',
  'hsz': '2048*1536',
  'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
  'hsv': '6.1.3',
  'ha': 'free_030',
  'Connection': 'keep-alive',
  'ham': 'wifi',
  'hu': 'AE293A0B-715E-44F8-8ABB-D56A7C0AAB1F',
  'hc': '700',
};

var site = "yoka";
var yokaTags = [
  '星妆容红黑榜',
  '笑到抽筋',
  '每日新闻5头条',
  '明星皆为微博狂',
  '星大片',
  '达人极品晒',
  '谁八卦啊你八卦',
  '穿衣奇葩货',
  '十万个护肤冷知识',
  '周六蹲点儿看街拍',
  '麻辣男题',
  '每日时髦不NG',
  '一周穿衣红榜',
  '女人必知',
  '女人必备',
  '情感攻略',
  '健康课堂',
  '两性趣谈',
  '主妇反思',
  '婆媳过招',
  '情感秘笈',
  '排行榜',
  '1日1话题',
];

var categorys = [
  {cateid:1, first:0, name:"beauty", pagesize:21, maxpage:100},
  {cateid:2, first:0, name:"fashion", pagesize:21, maxpage:100},
  {cateid:3, first:0, name:"life", pagesize:21, maxpage:100},
  {cateid:4, first:0, name:"unknown", pagesize:21, maxpage:5},
  {cateid:5, first:0, name:"unknown", pagesize:21, maxpage:100},
  {cateid:6, first:0, name:"star", pagesize:21, maxpage:100},
  {cateid:7, first:0, name:"unknown", pagesize:21, maxpage:100},
  {cateid:8, first:0, name:"unknown", pagesize:21, maxpage:13},
  {cateid:9, first:0, name:"luxury", pagesize:21, maxpage:100},
  {cateid:10, first:0, name:"unknown", pagesize:21, maxpage:5},
  {cateid:11, first:0, name:"unknown", pagesize:21, maxpage:0},
  {cateid:12, first:0, name:"focus", pagesize:21, maxpage:100},
  {cateid:13, first:0, name:"man", pagesize:21, maxpage:100},
  {cateid:14, first:0, name:"unknown", pagesize:21, maxpage:9},
  {cateid:15, first:0, name:"unknown", pagesize:21, maxpage:1},
  {cateid:16, first:0, name:"unknown", pagesize:21, maxpage:3},
  {cateid:17, first:0, name:"unknown", pagesize:21, maxpage:3},
  {cateid:18, first:0, name:"unknown", pagesize:21, maxpage:3},
  {cateid:19, first:0, name:"unknown", pagesize:21, maxpage:3},
  {cateid:20, first:0, name:"unknown", pagesize:21, maxpage:7},
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

  if((!obj) || (!obj.Pages)) {
    console.log("hzfdbg file[" + __filename + "]" + " genBodyHtmlAndImg():null");
    return "";
  }

  body = obj.Title + "<br/>";
  var list = obj.Pages;

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

function genYokaFindCmd(entry) {
  return {
    "$or":
      [
        {"site": site, "docid": {"$in": [util.format("%s", entry.ID), encodeDocID(site, entry.ID)]}},
        {
          "site": site,
          "tags": entry.tagName,
          "title": entry.Shorttitle,
          "ptime": entry.Createtime
        }
      ]
  };
}

var getNewsDetail = function(entry) {
  var bodyimg = genBodyHtmlAndImg(entry);

  News.findOne(genYokaFindCmd(entry), function(err, result) {
    if(err || result) {
      return;
    }
    var obj = entry;
    obj.docid = encodeDocID(site, entry.ID);
    obj.site = site;
    obj.body = bodyimg.body;
    obj.img = bodyimg.img;
    obj.link = "";
    if(entry.Url) {
      obj.link = entry.Url; // http://3g.yoka.com/m/id301255
    }else {
      obj.link = util.format("http://3g.yoka.com/m/id%s", entry.ID); // http://3g.yoka.com/m/id301255
    }
    obj.title = entry.Shorttitle;
    obj.ptime = entry.Createtime;
    obj.time = new Date(Date.parse(entry.Createtime));
    obj.marked = obj.body;
    obj.created = new Date();
    obj.views = 1;
    obj.tags = entry.tagName;
    obj.digest = genDigest(obj.body);
    obj.cover = entry.Image;
    if (!entry.Image && entry.focalImageUrl) {
      obj.cover = entry.focalImageUrl;
    }
    if((entry.tagName.indexOf("笑到抽筋") !== -1)) {
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

var crawlerCategory = function (entry) {
  var MAX_PAGE_NUM = entry.maxpage > 3 ? 3 : entry.maxpage;
  var page = 1;

  if(entry.first == 1) {
    entry.first = 0;
    MAX_PAGE_NUM = entry.maxpage;
  }

  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    var url = "http://mobservices3.yoka.com/service.ashx";
    var pd = {'pageindex':page,'pagesize':entry.pagesize,'cateid':entry.cateid};
    var req = {uri: url, method: "POST", headers: headers, form: pd};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
    request(req, function (err, res, body) {
      var json = data2Json(err, res, body);
      if(!json || !json.State || (json.State.Code && json.State.Code != 0) || !json.Contents || !json.Contents.Data) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():JSON.parse() error");
        return;
      }
      var newsList = json.Contents.Data;
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():newsList empty in url " + url);
        return;
      }
      newsList.forEach(function(newsEntry) {
        if(!newsEntry.Title || !newsEntry.ID) {
          return;
        }
        for(var i = 0; i < yokaTags.length; i++) {
          if ((newsEntry.Title.indexOf(yokaTags[i]) !== -1) || (newsEntry.Shorttitle.indexOf(yokaTags[i]) !== -1)) {
            newsEntry.tagName = yokaTags[i];
            newsEntry.cateid = entry.cateid;
            newsEntry.pageindex = page;

            News.findOne(genYokaFindCmd(newsEntry), function(err, result) {
              if(err || result) {
                return;
              }
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

var yokaCrawler = function() {
  console.log('Start yokaCrawler() at ' + new Date());
  categorys.forEach(function(entry) {
    crawlerCategory(entry);
  });

  setTimeout(yokaCrawler, 2000 * 60 * 60);
}

exports.yokaCrawler = yokaCrawler;
yokaCrawler();