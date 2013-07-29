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
var headers = {
    'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.0.4; sdk Build/MR1)',
    'Host': 'api.3g.ifeng.com'
};
var site = "ifeng";
// http://api.iapps.ifeng.com/news/detail.json?aid=29584735
//var detailLink = 'http://api.iapps.ifeng.com/news/detail.json?aid=%s';

function pickImg(html) {
  var document = jsdom(html);
  objs = document.getElementsByTagName('img');
  var img = [];
  if(objs) {
    for(i=0; i<objs.length; i++) {
      img[i] = objs[i].getAttribute('src');
    }
  }
  return img;
}

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

var getNewsDetail = function(entry) {
  var docid = entry['meta']['documentId'];
  var jObj = entry;
  var obj = {};
  News.findOne(genFindCmd(site, docid), function(err, result) {
    if(err) {
      console.log("hzfdbg file[" + __filename + "]" + " getDeatil(), News.findOne():error " + err);
      return;
    }
    if (result) {
      //console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.findOne():exist ");
      return;
    }
    obj['docid'] = encodeDocID(site, docid);
    obj['site'] = site;
    //obj['jsonstr'] = jObj['body']['text']; // delete it to save db size
    obj['body'] = jObj['body']['text'].replace(/width=["']140["']/g, '');;
    obj['img'] = pickImg(obj['body']);
    obj['video'] = [];
    obj['link'] = "";
    if(jObj['body']['shareurl']) {
      obj['link'] = jObj['body']['shareurl']; // http://i.ifeng.com/news/sharenews.f?aid=62947535
    }else if(jObj['body']['wwwurl']) {
      obj['link'] = jObj['body']['wwwurl']; // http://news.ifeng.com/photo/hdsociety/detail_2013_06/11/26317114_0.shtml
    }else if(jObj['body']['wapurl']) {
      obj['link'] = jObj['body']['wapurl']; // http://i.ifeng.com/news?aid=62947535
    }else {
      obj['link'] = util.format("http://i.ifeng.com/news/sharenews.f?aid=%s", (docid.indexOf("imcp_") != -1)?docid.substring(5):docid);
    }
    obj['title'] = jObj['body']['title'].replace(/\s+/g, '');
    obj['ptime'] = jObj['body']['editTime'];
    obj['time'] = new Date(obj['ptime']);
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
    obj['cover'] = '';
    if (obj['img'][0]) {
      obj['cover'] = obj['img'][0];
    }

    // img lazyloading
    for(i=0; i<obj['img'].length; i++) {
      var imgHtml = genLazyLoadHtml(obj['img'][i]['alt'], obj['img'][i]['url']);
      //obj['marked'] = obj['marked'].replace(/<img.*?\/>/, imgHtml);
      //console.log("hzfdbg file[" + __filename + "]" + " imgHtml="+imgHtml);
    };

    News.insert(obj, function (err, result) {
      if(err) {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
      }
    }); // News.insert
  }); // News.findOne
};

var crawlerHeadLineFirstTime = 1; //Crawl more pages at the first time
var crawlerHeadLine = function () {
  // http://api.3g.ifeng.com/newAndroidNews?id=SYDT10,SYLB10&type=imgchip,irank&picwidth=300&page=1&gv=3.6.0&av=3.6.0&uid=357719001482474&proid=ifengnews&os=android_15&df=androidphone&vt=5&screen=480x800
  // http://api.3g.ifeng.com/newAndroidNews?id=SYDT10,SYLB10&type=imgchip,irank&picwidth=300&page=50&gv=3.6.0&av=3.6.0&uid=357719001482474&proid=ifengnews&os=android_15&df=androidphone&vt=5&screen=480x800
  var headlineLink = 'http://api.3g.ifeng.com/newAndroidNews?id=SYDT10,SYLB10&type=imgchip,irank&picwidth=300&page=%d&gv=3.6.0&av=3.6.0&uid=357719001482474&proid=ifengnews&os=android_15&df=androidphone&vt=5&screen=480x800';
  var MAX_PAGE_NUM = 3;
  var page = 1;
  if(crawlerHeadLineFirstTime) {
    console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): All");
    MAX_PAGE_NUM = 10;//50;
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
      var i = 0, j = 0, k = 0;
      for(i=0; i<json.length; i++) {
        var obj = json[i]['doc'];
        if(!obj) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():null obj");
          continue;
        }
        for(j=0; j<obj.length; j++) {
          var item = obj[j];
          if(!item) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():null item in url " + url);
            continue;
          }
          //console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():util.inspect(item)="+util.inspect(item));
          //console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():title="+item['body']['title']);
          for(k=0; k<tags.length; k++) {
            if(ifengTags[tags[k]].indexOf("ifeng_") === -1) {//crawlerTags will handle these tags, so skip them here
              continue;
            }
            if((!item['body']) || (!item['body']['title'])) {
              console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():null item['body']");
              continue;
            }
            try {
              if ((item['body']['title'].indexOf(tags[k]) !== -1) || (item['body']['source'].indexOf(tags[k]) !== -1)) {
                //console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():item="+util.inspect(item));
                item['tagName'] = tags[k];
                //console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():["+item['tagName']+"]"+item['body']['title']+",docid="+item['meta']['documentId']);
                startGetDetail.emit('startGetNewsDetail', item);
                /*News.findOne(genFindCmd(site, item['meta']['documentId']), function(err, result) {
                 if(err) {
                 console.log("hzfdbg file[" + __filename + "]" + " crawlerTag(), News.findOne():error " + err);
                 return;
                 }
                 if (!result) {
                 console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():item['body']['title']="+item['body']['title']+item['body']['editTime']+item['tagName']);
                 startGetDetail.emit('startGetNewsDetail', item);
                 }else {
                 console.log("hzfdbg file[" + __filename + "]" + " crawlerTag(), News.findOne():exist ");
                 return;
                 }
                 }); // News.findOne*/
              }
            }
            catch (e) {
              console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): catch error");
              console.log(e);
              continue;
            }
          }//for k
        }//for j
      }//for i
    });//request
    })(page);
  }//for
};

var ifengCrawler = function() {
  console.log("hzfdbg file[" + __filename + "]" + " ifengCrawler():Date="+new Date());
  crawlerHeadLine();
}

exports.crawlerHeadLine = crawlerHeadLine;
exports.ifengCrawler = ifengCrawler;
ifengCrawler();