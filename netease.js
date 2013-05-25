var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
//var cheerio = require('cheerio');
var neteaseTags = require('config').Config.neteaseTags;
var tags = _.keys(neteaseTags);
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var jsdom = require("jsdom").jsdom;
var headers = {
    'User-Agent': 'NTES Android',
    'Referer': 'http://www.163.com'
};
// http://c.3g.163.com/nc/article/headline/T1295501906343/0-20.html
// http://c.3g.163.com/nc/article/headline/T1348647909107/400-20.html
var headlineLink = 'http://c.3g.163.com/nc/article/headline/T1295501906343/%d-20.html';
var headlineLink2 = 'http://c.3g.163.com/nc/article/headline/T1348647909107/%d-20.html';
// http://c.3g.163.com/nc/article/list/T1350383429665/0-20.html
var tagLink = 'http://c.3g.163.com/nc/article/list/%s/%d-20.html';
// http://c.3g.163.com/nc/article/8GOVEI0L00964JJM/full.html
var detailLink = 'http://c.3g.163.com/nc/article/%s/full.html';
// http://c.3g.163.com/nc/article/search/5q%2BP5pel6L275p2%2B5LiA5Yi7.html
var searchLink = 'http://c.3g.163.com/nc/article/search/%s.html';

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetDetail', function (entry, tag) {
  getDetail(entry, tag);
});

var getDetail = function(entry, tag) {
  var docid = util.format("%s",entry['docid']);
  var url = util.format(detailLink, docid);
  request({uri: url, headers: headers}, function (err, res, body) {
    if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " getDetail():error");
        console.log(err);console.log(url);console.log(util.inspect(res));console.log(body);
        return;
    }
    //console.log("hzfdbg file[" + __filename + "]" + " getDetail() util.inspect(body)="+util.inspect(body));
    var json = null;
    try {
      json = JSON.parse(body);
    }
    catch (e) {
      json = null;
      console.log("hzfdbg file[" + __filename + "]" + " getDeatil():JSON.parse() catch error");
      console.log(e);
    }
    var jObj = json[docid];
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
        obj['site'] = "netease";
        obj['jsonstr'] = body;
        obj['body'] = jObj['body'];
        obj['img'] = jObj['img'];
        obj['video'] = jObj['video'];
        obj['link'] = jObj['link'];
        obj['title'] = jObj['title'].trim().replace(/\s+/g, '');
        obj['ptime'] = jObj['ptime'];
        obj['time'] = new Date(Date.parse(jObj['ptime']));
        obj['marked'] = jObj['body'].replace('<!--@@PRE-->', '【').replace('<!--@@PRE-->', '】<br/>');

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
        if(entry['imgsrc']) {
          obj['cover'] = entry['imgsrc'];
        } else if (obj['img'][0]) {
          obj['cover'] = obj['img'][0]['src'];
        } else if (obj['video'][0]) {
          obj['cover'] = obj['video'][0]['cover'];
        }

        // img lazyloading
        obj['img'].forEach(function (img) {
          var imgHtml = genLazyLoadHtml(img['alt'], img['src']);
          obj['marked'] = obj['marked'].replace(img['ref'], imgHtml);
        });

        // video
        obj['video'].forEach(function (v) {
          var vHtml = util.format('<a title="%s" href="%s" target="_blank"><img class="lazy" alt="%s" src="/img/grey.gif" data-original="%s" /><noscript><img alt="%s" src="%s" /></noscript></a>',
            v['alt'], v['url_mp4'], v['alt'], v['cover'], v['alt'], v['cover']);
          obj['marked'] = obj['marked'].replace(v['ref'], vHtml);
        });

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

var crawlerOne = function (docid, tag) {
  getDetail(docid, tag);
};

var searchList = function (tag) {
  var url = util.format(searchLink, encodeURIComponent(tag));
  request({uri: url, headers: headers}, function (err, res, body) {
    if(err || (res.statusCode != 200) || (!body)) {
      console.log("hzfdbg file[" + __filename + "]" + " searchList():error");
      console.log(err);console.log(url);console.log(util.inspect(res));console.log(body);
      return;
    }
    var json = null;
    try {
      json = JSON.parse(body);
    }
    catch (e) {
      json = null;
      console.log("hzfdbg file[" + __filename + "]" + " searchList():JSON.parse() catch error");
      console.log(e);
    }
    if(!json) {
      console.log("hzfdbg file[" + __filename + "]" + " searchList():JSON.parse() error");
      return;
    }
    var newsList = json;
    if(newsList.length <= 0) {
      console.log("hzfdbg file[" + __filename + "]" + " searchList():newsList empty");
      return;
    }
    newsList.forEach(function(newsEntry) {
      for(var i = 0; i < tags.length; i++) {
        if (newsEntry['title'].indexOf(tags[i]) !== -1) {
         //console.log("hzfdbg file[" + __filename + "]" + " searchList():title="+newsEntry['title']);
         startGetDetail.emit('startGetDetail', newsEntry, tags[i]);
        }
      }//for
    });//forEach
  });//request
};

var crawlAllHeadLine = 1; //Crawl more headline at the first time
var crawlerHeadLine = function () {
  var MAX_PAGE_NUM = 5;
  var page = 0;
  var urls = [];
  var url_num = 0;
  var i = 0;
  if(crawlAllHeadLine) {
    console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): All");
    MAX_PAGE_NUM = 20;
    crawlAllHeadLine = 0;
  }
  for(page=0; page<=MAX_PAGE_NUM; page++) {
    urls[url_num++] = util.format(headlineLink, page*20);
    urls[url_num++] = util.format(headlineLink2, page*20);
  }
  for(i=0; i<url_num; i++) {
    var url = urls[i];
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
      var newsList = json["T1295501906343"];
      if(!newsList) {
        newsList = json["T1348647909107"];
      }
      if(newsList.length <= 0) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():newsList empty");
        return;
      }
      newsList.forEach(function(newsEntry) {
        for(var i = 0; i < tags.length; i++) {
          if(neteaseTags[tags[i]].indexOf("netease_") === -1) {//crawlerTags will handle these tags, so skip them here
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

var crawlerTag = function (tag, id) {
  var MAX_PAGE_NUM = 1;
  var page = 0;
  for(page=0; page<MAX_PAGE_NUM; page++) {
    var url = util.format(tagLink, id, page*20);
    request({uri: url, headers: headers}, function (err, res, body) {
      if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerTag():error");
        console.log(err);console.log(url);/*console.log(util.inspect(res));*/console.log(body);
        return;
      }
      var json = null;
      try {
        json = JSON.parse(body);
      }
      catch (e) {
        json = null;
        console.log("hzfdbg file[" + __filename + "]" + " crawlerTag():JSON.parse() catch error");
        console.log(e);
      }
      if(!json) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerTag():JSON.parse() error");
        return;
      }
      var newsList = json[id];
      if(newsList.length <= 0) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerTag():newsList empty in url " + url);
        return;
     }
     newsList.forEach(function(newsEntry) {
       //console.log("hzfdbg file[" + __filename + "]" + " crawlerTag():title="+newsEntry['title']);
       startGetDetail.emit('startGetDetail', newsEntry, tag);
     });//forEach
    });//request
  }//for
};

var crawlerTags = function () {
    tags.forEach(function(tagName) {
      if(neteaseTags[tagName].indexOf("netease_") === -1) {
        crawlerTag(tagName,neteaseTags[tagName]);
      }
    });
}

exports.crawlerHeadLine = crawlerHeadLine;
exports.crawlerTags = crawlerTags;
exports.crawlerOne = crawlerOne;
crawlerTags();
crawlerHeadLine();
//searchList('每日轻松一刻');
