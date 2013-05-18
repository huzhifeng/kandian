var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var sinaTags = require('config').Config.sinaTags;
var tags = _.keys(sinaTags);
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var xml2json = require('xml2json');
var jsdom = require("jsdom").jsdom;
var headers = {
    'User-Agent': 'sdk__sinanews__3.1.0__android__os4.0.4',
    'Referer': 'http://api.sina.cn/'
};
// http://api.sina.cn/sinago/list.json?channel=news_toutiao&p=1
var headlineLink = 'http://api.sina.cn/sinago/list.json?channel=news_toutiao&p=%d';
// http://data.3g.sina.com.cn/api/t/art/index.php?id=124-8468729-news-cms
var detailLink = 'http://data.3g.sina.com.cn/api/t/art/index.php?id=%s';

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

startGetDetail.on('startGetDetail', function (entry, tag) {
  getDetail(entry, tag);
});

var getDetail = function(entry, tag) {
  var docid = util.format("%s",entry['id']);
  var url = util.format(detailLink, docid);
  request({uri: url, headers: headers}, function (err, res, body) {
    if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " getDetail():error");
        console.log(err);console.log(url);console.log(util.inspect(res));console.log(body);
        return;
    }
    //console.log("hzfdbg file[" + __filename + "]" + " getDetail() util.inspect(body)="+util.inspect(body));
    var json = xml2json.toJson(body,{object:true, sanitize:false});
    var jObj = json['rss']["channel"]["item"];
    var obj = {};
    obj['docid'] = docid;

    News.findOne({docid: obj['docid']}, function(err, result) {
      if(err) {
        console.log("hzfdbg file[" + __filename + "]" + " News.findOne():error " + err);
        return;
      }
      var isUpdate = false;
      if (result && !result.disableAutoUpdate && (result.title !== entry['title'].trim().replace(/\s+/g, ''))) {
        isUpdate = true;
      }
      if (!result || isUpdate) {
        obj['site'] = "sina";
        obj['jsonstr'] = body;
        obj['body'] = jObj['description'];
        obj['img'] = pickImg(jObj['enclosure']);
        obj['video'] = [];
        obj['link'] = jObj['link'];
        obj['title'] = entry['title'].trim().replace(/\s+/g, '');// + "-" + entry['intro'].trim().replace(/\s+/g, '');
        obj['ptime'] = jObj['pubDate'];
        obj['time'] = new Date(Date.parse(jObj['pubDate']));
        obj['marked'] = obj['body'];

       if (isUpdate) {
          obj['updated'] = new Date();
        } else {
          obj['created'] = new Date();
          obj['views'] = 1;
        }

        if (tag) {
          obj['tags'] = [tag];
        } else {
          for (var i = 0; i < tags.length; i++) {
            if (obj['title'].indexOf(tags[i]) !== -1 || entry['title'].indexOf(tags[i]) !== -1) {
              obj['tags'] = [tags[i]];
              break;
            }
          }
        }

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
        if (obj['img'][0]) {
          obj['cover'] = obj['img'][0]['url'];
          //console.log("hzfdbg file[" + __filename + "]" + " cover="+obj['cover']);
        }

        // img lazyloading
        for(i=0; i<obj['img'].length; i++) {
          var imgHtml = genLazyLoadHtml(obj['img'][i]['alt'], obj['img'][i]['url']);
          obj['marked'] = obj['marked'].replace(/<br\/><br\/>/, imgHtml);
          //console.log("hzfdbg file[" + __filename + "]" + " imgHtml="+imgHtml);
        };

        if (isUpdate) {
          News.update({docid: result.docid}, obj, function (err, result) {
            if(err) {
              console.log(err);
            }
          });
        } else {
          News.insert(obj, function (err, result) {
            if(err) {
              console.log(err);
            }
          });
        }
      }//if (!result || isUpdate)
    });//News.findOne
  });//request
};

var crawlAllHeadLine = 1; //Crawl more headline at the first time
var crawlerHeadLine = function () {
  var MAX_PAGE_NUM = 5;
  var page = 1;
  if(crawlAllHeadLine) {
    console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): All");
    MAX_PAGE_NUM = 20;
    crawlAllHeadLine = 0;
  }
  for(page=1; page<=MAX_PAGE_NUM; page++) {
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
      if(newsList.length <= 0) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():newsList empty");
        return;
      }
      newsList.forEach(function(newsEntry) {
        for(var i = 0; i < tags.length; i++) {
          if(sinaTags[tags[i]].indexOf("sina_") === -1) {//crawlerTags will handle these tags, so skip them here
            continue;
          }
          if (newsEntry['title'].indexOf(tags[i]) !== -1) {
           //console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():title="+newsEntry['title']);
           startGetDetail.emit('startGetDetail', newsEntry, tags[i]);
          }
        }//for
      });//forEach
    });//request
  }//for
};

exports.crawlerHeadLine = crawlerHeadLine;
crawlerHeadLine();
