var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var sinaTags = require('config').Config.sinaTags;
var tags = _.keys(sinaTags);
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var genFindCmd = require('./lib/utils').genFindCmd;
var encodeDocID = require('./lib/utils').encodeDocID;
var xml2json = require('xml2json');
var jsdom = require("jsdom").jsdom;
var headers = {
  'User-Agent': 'sdk__sinanews__3.1.0__android__os4.0.4',
  //'Host': 'api.sina.cn',// Don't set host because it will cause HTTP request failed
  'Referer': 'http://api.sina.cn'
};
var site = "sina";

function pickImg(enclosure) {
  var objs = enclosure;
  var i = 0;
  //console.log("zhutest file[" + __filename + "]" + " pickImg() util.inspect(objs)="+util.inspect(objs));
  var img = [];
  if(objs){
    if(objs[0]) {
      for(i=0; i<objs.length; i++) {
        img[i] = objs[i];
      }
    }
    else {
      img[0] = objs;
    }
  }
  for(i=0; i<img.length; i++) {
    img[i]['url'] = img[i]['url'].replace(/auto\.jpg/, "original.jpg");
  }
  return img;
}

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

var getNewsDetail = function(entry) {
  // http://data.3g.sina.com.cn/api/t/art/index.php?id=124-8468729-news-cms
  var detailLink = 'http://data.3g.sina.com.cn/api/t/art/index.php?id=%s';
  var docid = util.format("%s",entry['id']);
  var url = util.format(detailLink, docid);
  request({uri: url, headers: headers}, function (err, res, body) {
    if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():error");
        console.log(err);console.log(url);/*console.log(util.inspect(res));*/console.log(body);
        return;
    }
    //console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail() util.inspect(body)="+util.inspect(body));
    var json = xml2json.toJson(body,{object:true, sanitize:false});
    var jObj = json['rss']["channel"]["item"];
    var obj = {};

    News.findOne(genFindCmd(site, docid), function(err, result) {
      if(err) {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.findOne():error " + err);
        return;
      }
      if (result) {
        //console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.findOne():exist ");
        return;
      }
      obj['docid'] = encodeDocID(site, docid);
      obj['site'] = site;
      //obj['jsonstr'] = body; // delete it to save db size
      obj['body'] = jObj['description'];
      obj['img'] = pickImg(jObj['enclosure']);
      obj['video'] = [];
      obj['link'] = "";
      if(jObj['link']) {
        obj['link'] = jObj['link']; // http://news.sina.cn/?sa=t124d8940595v2357
      }else if(jObj['guid']) {
        obj['link'] = jObj['guid']; // http://news.sina.cn/?sa=t124d8940595v2357
      }else if(entry['link']) {
        obj['link'] = entry['link']; // http://news.sina.cn/?sa=d8940595t124v71
      }else {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), link null");
      }
      obj['title'] = entry['title'].trim().replace(/\s+/g, '');// + "-" + entry['intro'].trim().replace(/\s+/g, '');
      obj['ptime'] = jObj['pubDate'];
      obj['time'] = new Date(Date.parse(jObj['pubDate']));
      obj['marked'] = obj['body'];

      obj['created'] = new Date();
      obj['views'] = 1;
      obj['tags'] = entry['tagName'];

      //remove all html tag,
      //refer to <<How to remove HTML Tags from a string in Javascript>>
      //http://geekswithblogs.net/aghausman/archive/2008/10/30/how-to-remove-html-tags-from-a-string-in-javascript.aspx
      //and https://github.com/tmpvar/jsdom
      var window = jsdom().createWindow();
      var mydiv = window.document.createElement("div");
      mydiv.innerHTML = obj['body'];
      // digest
      var maxDigest = 300;
      obj['digest'] = mydiv.textContent.slice(0,maxDigest);

      // cover
      obj['cover'] = entry['pic'];
      if (!entry['pic'] && obj['img'][0]) {
        obj['cover'] = obj['img'][0]['url'];
        //console.log("hzfdbg file[" + __filename + "]" + " cover="+obj['cover']);
      }

      // img lazyloading
      for(i=0; i<obj['img'].length; i++) {
        var imgHtml = genLazyLoadHtml(obj['img'][i]['alt'], obj['img'][i]['url']);
        obj['marked'] = obj['marked'].replace(/<br\/><br\/>/, imgHtml);
        //console.log("hzfdbg file[" + __filename + "]" + " imgHtml="+imgHtml);
      };

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
    console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): All");
    MAX_PAGE_NUM = 3;//25;
    crawlerHeadLineFirstTime = 0;
  }
  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    var url = util.format(headlineLink, page);
    request({uri: url, headers: headers}, function (err, res, body) {
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
      var newsList = json["data"]["list"];
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():newsList empty in url " + url);
        return;
      }
      newsList.forEach(function(newsEntry) {
        for(var i = 0; i < tags.length; i++) {
          if(sinaTags[tags[i]].indexOf("sina_") === -1) {//crawlerTags will handle these tags, so skip them here
            continue;
          }
          try {
            if (newsEntry['title'].indexOf(tags[i]) !== -1) {
              //console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():title="+newsEntry['title']);
              newsEntry['tagName'] = tags[i];
              News.findOne(genFindCmd(site, newsEntry['id']), function(err, result) {
                if(err) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(), News.findOne():error " + err);
                  return;
                }
                if (!result) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():["+newsEntry['tagName']+"]"+newsEntry['title']+",docid="+newsEntry['id']);
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

var sinaCrawler = function() {
  console.log("hzfdbg file[" + __filename + "]" + " sinaCrawler():Date="+new Date());
  crawlerHeadLine();
}

exports.crawlerHeadLine = crawlerHeadLine;
exports.sinaCrawler = sinaCrawler;
sinaCrawler();