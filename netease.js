var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var neteaseTags = require('config').Config.neteaseTags;
var tags = _.keys(neteaseTags);
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var genFindCmd = require('./lib/utils').genFindCmd;
var encodeDocID = require('./lib/utils').encodeDocID;
var jsdom = require("jsdom").jsdom;

var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': 'NTES Android',
  'Connection': 'Keep-Alive',
  'Host': 'c.3g.163.com',//c.m.163.com
  //'Accept-Encoding': 'gzip',
};
var site = "netease";

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

startGetDetail.on('startGetPhotoDetail', function (entry) {
  getPhotoDetail(entry);
});

var getNewsDetail = function(entry) {
  // http://c.3g.163.com/nc/article/8GOVEI0L00964JJM/full.html
  var detailLink = 'http://c.3g.163.com/nc/article/%s/full.html';
  var docid = util.format("%s",entry['docid']);
  var url = util.format(detailLink, docid);
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
    var jObj = json[docid];
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
      obj['body'] = jObj['body'];
      obj['img'] = jObj['img'];
      obj['video'] = jObj['video'];
      obj['link'] = "";
      if(entry['url_3w']) {
        obj['link'] = entry['url_3w']; // http://help.3g.163.com/13/0611/08/912V2VCS00963VRO.html
      }else if(entry['url']) {
        obj['link'] = entry['url']; // http://3g.163.com/ntes/13/0611/08/912V2VCS00963VRO.html
      }else {
        obj['link'] = util.format("http://3g.163.com/touch/article.html?docid=%s", docid); // http://3g.163.com/touch/article.html?docid=912V2VCS00963VRO
      }
      obj['title'] = jObj['title'];//.trim().replace(/\s+/g, '');
      obj['ptime'] = jObj['ptime'];
      obj['time'] = new Date(Date.parse(jObj['ptime']));
      obj['marked'] = jObj['body'].replace('<!--@@PRE-->', '【').replace('<!--@@PRE-->', '】<br/>');
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

      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
        }
      }); // News.insert
    }); // News.findOne
  });// request
};

function genBodyHtml(obj) {
  var body = "";
  var i = 0;

  if((!obj) || (!obj['photos'])) {
    console.log("hzfdbg file[" + __filename + "]" + " genBodyHtml():null");
    return "";
  }

  body = obj['desc'] + "<br>";

  for(i=0; i<obj['photos'].length; i++) {
    body += obj['photos'][i]['note']?obj['photos'][i]['note']: obj['photos'][i]['imgtitle'];
    body += genLazyLoadHtml("", obj['photos'][i]['imgurl']);
  }

  return body;
}

function pickImg(obj) {
  var img = [];
  var i = 0;

  if((!obj) || (!obj['photos'])) {
    console.log("hzfdbg file[" + __filename + "]" + " pickImg():null");
    return "";
  }

  for(i=0; i<obj['photos'].length; i++) {
    img[i] = obj['photos'][i]['imgurl'];
  }

  return img;
}

var getPhotoDetail = function(entry) {
  var docid = util.format("%s",entry['setid']);
  var url = util.format("http://c.3g.163.com/photo/api/set/0096/%s.json",entry['setid']);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    if(err || (res.statusCode != 200) || (!body)) {
      console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail():error");
      console.log(err);console.log(url);/*console.log(util.inspect(res));*/console.log(body);
      return;
    }
    //console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail() util.inspect(body)="+util.inspect(body));
    var json = null;
    try {
      json = JSON.parse(body);
    }
    catch (e) {
      json = null;
      console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail():JSON.parse() catch error");
      console.log(e);
      return;
    }
    if(!json) {
      console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail():json null");
      return;
    }
    var jObj = json;
    var obj = {};
    News.findOne(genFindCmd(site, docid), function(err, result) {
      if(err) {
        console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail(), News.findOne():error " + err);
        return;
      }
      if (result) {
        //console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail(), News.findOne():exist ");
        return;
      }
      obj['docid'] = encodeDocID(site, docid);
      obj['site'] = site;
      //obj['jsonstr'] = body; // delete it to save db size
      obj['body'] = genBodyHtml(jObj);
      obj['img'] = pickImg(jObj);
      obj['video'] = [];
      obj['link'] = "";
      if(jObj['url']) {
        obj['link'] = jObj['url']; // http://sports.163.com/photoview/011U0005/99130.html#p=90Q9LN0D4FFF0005
      }
      obj['title'] = entry['setname'];//.trim().replace(/\s+/g, '');
      obj['ptime'] = jObj['createdate'];
      obj['time'] = new Date(Date.parse(jObj['ptime']));
      obj['marked'] = jObj['body'];
      obj['created'] = new Date();
      obj['views'] = 1;
      obj['tags'] = entry['tagName'];
      obj['marked'] = obj['body'];
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
      if(entry['clientcover']) {
        obj['cover'] = entry['clientcover'];
      } else if (entry['clientcover1']){
        obj['cover'] = entry['clientcover1'];
      }else if (obj['img'][0]) {
        obj['cover'] = obj['img'][0];
      }

      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail(), News.insert():error " + err);
        }
      }); // News.insert
    }); // News.findOne
  });// request
};

var crawlerHeadLineFirstTime = 1; //Crawl more pages at the first time
var crawlerHeadLine = function () {
  // http://c.3g.163.com/nc/article/headline/T1295501906343/0-20.html
  // http://c.3g.163.com/nc/article/headline/T1348647909107/400-20.html
  //var headlineLink = 'http://c.3g.163.com/nc/article/headline/T1295501906343/%d-20.html';
  var headlineLink2 = 'http://c.3g.163.com/nc/article/headline/T1348647909107/%d-20.html';
  var MAX_PAGE_NUM = 3;
  var page = 0;
  if(crawlerHeadLineFirstTime) {
    //console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): All");
    MAX_PAGE_NUM = 5;//20;
    crawlerHeadLineFirstTime = 0;
  }
  for(page=0; page<MAX_PAGE_NUM; page++) {
    (function(page) {
    var url = util.format(headlineLink2, page*20);
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
      var newsList = json["T1348647909107"];
      if(!newsList) {
        newsList = json["T1295501906343"];
      }
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():newsList empty in url " + url);
        return;
      }
      newsList.forEach(function(newsEntry) {
        for(var i = 0; i < tags.length; i++) {
          if(neteaseTags[tags[i]].indexOf("netease_") === -1) {//crawlerTags will handle these tags, so skip them here
            continue;
          }
          try {
            if (newsEntry['title'].indexOf(tags[i]) !== -1) {
              newsEntry['tagName'] = tags[i];
              News.findOne(genFindCmd(site, newsEntry['docid']), function(err, result) {
                if(err) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(), News.findOne():error " + err);
                  return;
                }
                if (!result) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():["+newsEntry['tagName']+"]"+newsEntry['title']+",docid="+newsEntry['docid']);
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

var crawlerPhotoFirstTime = 0; //Crawl more pages at the first time
var crawlerPhotoPage = function(url) {
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    if(err || (!body)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoPage():error");
      console.log(err);console.log(url);/*console.log(util.inspect(res));*/console.log(body);
      return;
    }else if(res.statusCode != 200) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoPage():res.statusCode=" + res.statusCode);
      setTimeout(function() {
        crawlerPhotoPage(url);
      }, 60000); // try again after 60 seconds
      return;
    }
    var json = null;
    try {
      json = JSON.parse(body);
    }
    catch (e) {
      json = null;
      console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoPage():JSON.parse() catch error");
      console.log(e);
    }
    if(!json) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoPage():JSON.parse() error");
      return;
    }
    var newsList = json;
    if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoPage():newsList empty in url " + url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      try {
        newsEntry['tagName'] = "独家图集";
        News.findOne(genFindCmd(site, newsEntry['setid']), function(err, result) {
          if(err) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoPage(), News.findOne():error " + err);
            return;
          }
          if (!result) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoPage():["+newsEntry['tagName']+"]"+newsEntry['setname']+",docid="+newsEntry['setid']);
            startGetDetail.emit('startGetPhotoDetail', newsEntry);
          }
        }); // News.findOne
      }
      catch (e) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoPage(): catch error");
        console.log(e);
      }
    });//forEach
    if(newsList.length == 10) {
      if(crawlerPhotoFirstTime) {
        var nexPage = util.format("http://c.3g.163.com/photo/api/morelist/0096/54GJ0096/%s.json", newsList[9]['setid']);
        console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoPage(): next page="+nexPage);
        setTimeout(function() {
          crawlerPhotoPage(nexPage);
        }, 30000); // crawl next page after 30 seconds
      }
    }else {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoPage(): last page");
      crawlerPhotoFirstTime = 0;
    }
  });//request
}
var crawlerPhoto = function () {
  var startPage = "http://c.3g.163.com/photo/api/list/0096/54GJ0096.json";
  crawlerPhotoPage(startPage);
};

var crawlerTagFirstTime = {}; //Crawl more pages at the first time
var crawlerTag = function (tag, id) {
  // http://c.3g.163.com/nc/article/list/T1350383429665/0-20.html
  var tagLink = 'http://c.3g.163.com/nc/article/list/%s/%d-20.html';
  var MAX_PAGE_NUM = 1;
  var page = 0;
  if(!crawlerTagFirstTime[tag]) {
    //console.log("hzfdbg file[" + __filename + "]" + " crawlerTag(): All, tag="+tag);
    MAX_PAGE_NUM = 2;//20;
    crawlerTagFirstTime[tag] = 1;
  }
  for(page=0; page<MAX_PAGE_NUM; page++) {
    (function(page) {
    var url = util.format(tagLink, id, page*20);
    var req = {uri: url, method: "GET", headers: headers};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
    request(req, function (err, res, body) {
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
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        //console.log("hzfdbg file[" + __filename + "]" + " crawlerTag():newsList empty in url " + url);
        return;
      }
      newsList.forEach(function(newsEntry) {
        newsEntry['tagName'] = tag;
        News.findOne(genFindCmd(site, newsEntry['docid']), function(err, result) {
          if(err) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerTag(), News.findOne():error " + err);
            return;
          }
          if (!result) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerTag():["+newsEntry['tagName']+"]"+newsEntry['title']+",docid="+newsEntry['docid']);
            startGetDetail.emit('startGetNewsDetail', newsEntry);
          }
        }); // News.findOne
      });//forEach
    });//request
    })(page);
  }//for
};

var crawlerTags = function () {
  tags.forEach(function(tagName) {
    if(neteaseTags[tagName].indexOf("netease_") === -1) {
      crawlerTag(tagName,neteaseTags[tagName]);
    }
  });
}

var neteaseCrawler = function() {
  console.log("hzfdbg file[" + __filename + "]" + " neteaseCrawler():Date="+new Date());
  crawlerTags();
  crawlerHeadLine();
  crawlerPhoto();
  setTimeout(neteaseCrawler, 1000 * 60 * 60);
}

exports.neteaseCrawler = neteaseCrawler;
neteaseCrawler();