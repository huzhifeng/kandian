var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var yokaTags = require('config').Config.yokaTags;
var tags = _.keys(yokaTags);
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var genFindCmd = require('./lib/utils').genFindCmd;
var encodeDocID = require('./lib/utils').encodeDocID;
var genDigest = require('./lib/utils').genDigest;
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
  //'Content-Length': '32',//Set Content-Length automaticly
  'hc': '700',
  //'Accept-Encoding': 'gzip' //Do not enable gzip
};
var site = "yoka";

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
  //console.log("hzfdbg file[" + __filename + "]" + " genBodyHtmlAndImg() util.inspect(list)="+util.inspect(list));

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
  //var bodyimg = genBodyHtmlAndImg(entry);
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

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

var getNewsDetail = function(entry) {
  var bodyimg = genBodyHtmlAndImg(entry);
  
  News.findOne(genYokaFindCmd(entry), function(err, result) {
    if(err) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.findOne():error " + err);
      return;
    }
    if (result) {
      //console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.findOne():exist ");
      return;
    }
    var obj = {};
    obj.docid = encodeDocID(site, entry.ID);
    obj.site = site;
    obj.cateid = entry.cateid;
    obj.pageindex = entry.pageindex;
    obj.body = bodyimg.body;
    obj.img = bodyimg.img;
    obj.video = [];
    obj.link = "";
    if(entry.Url) {
      obj.link = entry.Url; // http://3g.yoka.com/m/id301255 
    }else {
      obj.link = "http://3g.yoka.com/m/id" + entry.ID; // http://3g.yoka.com/m/id301255 
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), link null");
    }
    obj.title = entry.Shorttitle;
    obj.realtitle = entry.Title;
    obj.ptime = entry.Createtime;
    obj.time = new Date(Date.parse(entry.Createtime));
    obj.marked = obj.body;
    obj.created = new Date();
    obj.views = 1;
    obj.tags = entry.tagName;
    obj.digest = genDigest(obj.body);

    // cover
    obj.cover = entry.Image;
    if (!entry.Image && entry.focalImageUrl) {
      obj.cover = entry.focalImageUrl;
      //console.log("hzfdbg file[" + __filename + "]" + " cover="+obj.cover);
    }
    if((obj.tags.indexOf("ÇáËÉÒ»¿Ì") !== -1) && (obj.img.length > 0)) {
      obj.cover = obj.img[0];
    }

    News.insert(obj, function (err, result) {
      if(err) {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
      }
    }); // News.insert
  }); // News.findOne
};

var crawlerCategory = function (cateid, pagesize, maxpage) {
  var MAX_PAGE_NUM = 1 + maxpage;
  var page = 1;

  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    var url = "http://mobservices3.yoka.com/service.ashx";
    var postData = {'pageindex':page,'pagesize':pagesize,'cateid':cateid};
    request({uri: url, method: "POST", headers: headers, form: postData/*, proxy: "http://127.0.0.1:7788"*/}, function (err, res, body) {
      if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():error");
        console.log(err);console.log(url+"?pageindex="+page+"&pagesize="+pagesize+"&cateid="+cateid);/*console.log(util.inspect(res));*/console.log(body);
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
      if(json.State.Code != 0) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():Msg="+json.State.Msg);
        return;
      }
      var newsList = json.Contents.Data;
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():newsList empty in url " + url);
        return;
      }
      newsList.forEach(function(newsEntry) {
        //console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():title="+newsEntry.Shorttitle);
        for(var i = 0; i < tags.length; i++) {
          //if(yokaTags[tags[i]].indexOf("yoka_") === -1) {//crawlerTags will handle these tags, so skip them here
          //  continue;
          //}
          try {
            if ((newsEntry.Title.indexOf(tags[i]) !== -1) || (newsEntry.Shorttitle.indexOf(tags[i]) !== -1)) {
              //console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():title="+newsEntry.Shorttitle);
              newsEntry.tagName = tags[i];
              newsEntry.cateid = cateid;
              newsEntry.pageindex = page;
              
              News.findOne(genYokaFindCmd(newsEntry), function(err, result) {
                if(err) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory(), News.findOne():error " + err);
                  return;
                }
                if (!result) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():["+newsEntry.tagName+"]"+newsEntry.Shorttitle+",docid="+newsEntry.ID);
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

var yokaCrawler = function() {
  console.log("hzfdbg file[" + __filename + "]" + " yokaCrawler():Start time="+new Date());
  var cateids = [
    {cateid:1, name:"beauty", pagesize:21, maxpage:100},
    {cateid:2, name:"fashion", pagesize:21, maxpage:100},
    {cateid:3, name:"life", pagesize:21, maxpage:100},
    {cateid:4, name:"unknown", pagesize:21, maxpage:5},
    {cateid:5, name:"unknown", pagesize:21, maxpage:100},
    {cateid:6, name:"star", pagesize:21, maxpage:100},
    {cateid:7, name:"unknown", pagesize:21, maxpage:100},
    {cateid:8, name:"unknown", pagesize:21, maxpage:13},
    {cateid:9, name:"luxury", pagesize:21, maxpage:100},
    {cateid:10, name:"unknown", pagesize:21, maxpage:5},
    //{cateid:11, name:"unknown", pagesize:21, maxpage:0},
    {cateid:12, name:"focus", pagesize:21, maxpage:100},
    {cateid:13, name:"man", pagesize:21, maxpage:100},
    {cateid:14, name:"unknown", pagesize:21, maxpage:9},
    {cateid:15, name:"unknown", pagesize:21, maxpage:1},
    {cateid:16, name:"unknown", pagesize:21, maxpage:3},
    {cateid:17, name:"unknown", pagesize:21, maxpage:3},
    {cateid:18, name:"unknown", pagesize:21, maxpage:3},
    {cateid:19, name:"unknown", pagesize:21, maxpage:3},
    {cateid:20, name:"unknown", pagesize:21, maxpage:7},
  ];
  cateids.forEach(function(entry) {
    crawlerCategory(entry.cateid, entry.pagesize, entry.maxpage);
  });//forEach
}

exports.yokaCrawler = yokaCrawler;
yokaCrawler();