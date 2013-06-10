var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
//var cheerio = require('cheerio');
var neteaseTags = require('config').Config.neteaseTags;
var tags = _.keys(neteaseTags);
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var genFindCmd = require('./lib/utils').genFindCmd;
var encodeDocID = require('./lib/utils').encodeDocID;
var jsdom = require("jsdom").jsdom;
var headers = {
  'User-Agent': 'NTES Android',
  'Host': 'c.3g.163.com'
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
  request({uri: url, headers: headers}, function (err, res, body) {
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
      obj['link'] = jObj['link'];
      obj['title'] = jObj['title'].trim().replace(/\s+/g, '');
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
  request({uri: url, headers: headers}, function (err, res, body) {
    if(err || (res.statusCode != 200) || (!body)) {
      console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail():error");
      console.log(err);console.log(url);console.log(util.inspect(res));console.log(body);
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
      obj['link'] = jObj['url'];
      obj['title'] = entry['setname'].trim().replace(/\s+/g, '');
      obj['ptime'] = jObj['createdate'];
      obj['time'] = obj['ptime'];
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

var crawlerOne = function (docid, tag) {
  var entry = {};

  entry['docid'] = docid;
  entry['tagName'] = tag;
  getNewsDetail(entry);
};

var crawlerHeadLineFirstTime = 1; //Crawl more pages at the first time
var crawlerHeadLine = function () {
  // http://c.3g.163.com/nc/article/headline/T1295501906343/0-20.html
  // http://c.3g.163.com/nc/article/headline/T1348647909107/400-20.html
  var headlineLink = 'http://c.3g.163.com/nc/article/headline/T1295501906343/%d-20.html';
  var headlineLink2 = 'http://c.3g.163.com/nc/article/headline/T1348647909107/%d-20.html';
  var MAX_PAGE_NUM = 3;
  var page = 0;
  var urls = [];
  var url_num = 0;
  var i = 0;
  if(crawlerHeadLineFirstTime) {
    console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): All");
    MAX_PAGE_NUM = 20;
    crawlerHeadLineFirstTime = 0;
  }
  for(page=0; page<=MAX_PAGE_NUM; page++) {
    //urls[url_num++] = util.format(headlineLink, page*20);
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
      var newsList = json["T1348647909107"];
      if(!newsList) {
        newsList = json["T1295501906343"];
      }
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():newsList empty");
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
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():title="+newsEntry['title']);
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
  }//for
};

var crawlerPhotoFirstTime = 1; //Crawl more pages at the first time
var crawlerPhoto = function () {
  var MAX_PAGE_NUM = 1;
  var urls = [
    "/list/0096/54GJ0096.json",
    "/morelist/0096/54GJ0096/22074.json",
    "/morelist/0096/54GJ0096/21927.json",
    "/morelist/0096/54GJ0096/21703.json",
    "/morelist/0096/54GJ0096/21553.json",
    "/morelist/0096/54GJ0096/21374.json",
    "/morelist/0096/54GJ0096/21109.json",
    "/morelist/0096/54GJ0096/20885.json",
    "/morelist/0096/54GJ0096/20587.json",
    "/morelist/0096/54GJ0096/20301.json",
    "/morelist/0096/54GJ0096/20101.json",
    "/morelist/0096/54GJ0096/19834.json",
    "/morelist/0096/54GJ0096/19635.json",
    "/morelist/0096/54GJ0096/19479.json",
    "/morelist/0096/54GJ0096/19354.json",
    "/morelist/0096/54GJ0096/19167.json",
    "/morelist/0096/54GJ0096/19005.json",
    "/morelist/0096/54GJ0096/18684.json",
    "/morelist/0096/54GJ0096/18551.json",
    "/morelist/0096/54GJ0096/18414.json",
    "/morelist/0096/54GJ0096/18209.json",
    "/morelist/0096/54GJ0096/17976.json",
    "/morelist/0096/54GJ0096/17725.json",
    "/morelist/0096/54GJ0096/17531.json",
    "/morelist/0096/54GJ0096/17346.json",
    "/morelist/0096/54GJ0096/17099.json",
    "/morelist/0096/54GJ0096/16920.json",
    "/morelist/0096/54GJ0096/16667.json",
    "/morelist/0096/54GJ0096/16447.json",
    "/morelist/0096/54GJ0096/16190.json",
    "/morelist/0096/54GJ0096/15949.json",
    "/morelist/0096/54GJ0096/15580.json",
    "/morelist/0096/54GJ0096/15259.json",
    "/morelist/0096/54GJ0096/14718.json",
    "/morelist/0096/54GJ0096/14179.json",
    "/morelist/0096/54GJ0096/13920.json",
    "/morelist/0096/54GJ0096/13649.json",
    "/morelist/0096/54GJ0096/13644.json"
  ];
  var url_num = 0;
  var i = 0;
  var prefix = "http://c.3g.163.com/photo/api%s";

  for(i=0; i<urls.length; i++) {
    urls[url_num++] = util.format(prefix, urls[i]);
  }

  if(crawlerPhotoFirstTime) {
    console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto(): All");
    MAX_PAGE_NUM = urls.length;
    crawlerPhotoFirstTime = 0;
  }

  for(i=0; i<MAX_PAGE_NUM; i++) {
    var url = urls[i];
    request({uri: url, headers: headers}, function (err, res, body) {
      if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():error");
        console.log(err);console.log(url);/*console.log(util.inspect(res));*/console.log(body);
        return;
      }
      var json = null;
      try {
        json = JSON.parse(body);
      }
      catch (e) {
        json = null;
        console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():JSON.parse() catch error");
        console.log(e);
      }
      if(!json) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():JSON.parse() error");
        return;
      }
      var newsList = json;
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():newsList empty");
        return;
      }
      newsList.forEach(function(newsEntry) {
        try {
          newsEntry['tagName'] = "独家图集";
          News.findOne(genFindCmd(site, newsEntry['setid']), function(err, result) {
            if(err) {
              console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto(), News.findOne():error " + err);
              return;
            }
            if (!result) {
              console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():title="+newsEntry['setname']);
              startGetDetail.emit('startGetPhotoDetail', newsEntry);
            }
          }); // News.findOne
        }
        catch (e) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto(): catch error");
          console.log(e);
        }
      });//forEach
    });//request
  }//for
};

var crawlerTagFirstTime = {}; //Crawl more pages at the first time
var crawlerTag = function (tag, id) {
  // http://c.3g.163.com/nc/article/list/T1350383429665/0-20.html
  var tagLink = 'http://c.3g.163.com/nc/article/list/%s/%d-20.html';
  var MAX_PAGE_NUM = 1;
  var page = 0;
  if(!crawlerTagFirstTime[tag]) {
    console.log("hzfdbg file[" + __filename + "]" + " crawlerTag(): All, tag="+tag);
    MAX_PAGE_NUM = 20;
    crawlerTagFirstTime[tag] = 1;
  }
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
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerTag():newsList empty in url " + url);
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
            console.log("hzfdbg file[" + __filename + "]" + " crawlerTag():title="+newsEntry['title']);
            startGetDetail.emit('startGetNewsDetail', newsEntry);
          }
        }); // News.findOne
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

var neteaseCrawler = function() {
  crawlerTags();
  crawlerHeadLine();
  crawlerPhoto();
}

exports.crawlerHeadLine = crawlerHeadLine;
exports.crawlerTags = crawlerTags;
exports.crawlerPhoto = crawlerPhoto;
exports.crawlerOne = crawlerOne;
exports.neteaseCrawler = neteaseCrawler;
neteaseCrawler();