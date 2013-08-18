var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var qqTags = require('config').Config.qqTags;
var tags = _.keys(qqTags);
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var genQqFindCmd = require('./lib/utils').genQqFindCmd;
var encodeDocID = require('./lib/utils').encodeDocID;
var jsdom = require("jsdom").jsdom;

var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': '~...260(android)',
  'Host': 'inews.qq.com',
  'Connection': 'Keep-Alive',
  //'Accept-Encoding': 'gzip,deflate',
};
// http://inews.qq.com/getQQNewsNormalHtmlContent?id=NEW2013050300143202&store=63&hw=Xiaomi_MI2&devid=1366805394774330052&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_news_top&appver=16_android_2.6.0
var detailLink = 'http://inews.qq.com/getQQNewsNormalHtmlContent?id=%s';
var site = "qq";

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

startGetDetail.on('startGetTopicDetail', function (entry) {
  getTopicDetail(entry);
});

startGetDetail.on('startGetPhotoDetail', function (entry) {
  getPhotoDetail(entry);
});

var getNewsDetail = function(entry) {
  var docid = util.format("%s",entry['id']);
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
    }
    if((!json) || (json['ret'] != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():ret="+json['ret']);
      return;
    }
    var jObj = json;
    var obj = {};

    News.findOne(genQqFindCmd(site, entry), function(err, result) {
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
      obj['body'] = '';
      obj['img'] = [];
      jObj['content'].forEach(function(item) {
        if(item['type'] == 1) { //text
          obj['body'] += item['value'];
        }
        else if(item['type'] == 2) { //pic
          obj['body'] += genLazyLoadHtml(entry['tagName'], item['value']);
          obj['img'][obj['img'].length] = item['value'];
        }
        else if(item['type'] == 3) { //video
          obj['body'] += genLazyLoadHtml(entry['tagName'], item['value']['img']);
          obj['img'][obj['img'].length] = item['value']['img'];
        }
      });
      obj['video'] = [];
      obj['link'] = "";
      if(entry['url']) {
        obj['link'] = entry['url']; // http://view.inews.qq.com/a/NEW2013050300143202
      }else if(entry['surl']) {
        obj['link'] = entry['surl']; // http://view.inews.qq.com/a/NEW2013050300143202
      }else if(jObj['url']) {
        obj['link'] = jObj['url']; // http://view.inews.qq.com/a/NEW2013050300143202
      }else if(jObj['surl']) {
        obj['link'] = jObj['surl']; // http://view.inews.qq.com/a/NEW2013050300143202
      }else {
        obj['link'] = util.format("http://view.inews.qq.com/a/%s", docid);
      }
      obj['title'] = entry['title'];//.trim().replace(/\s+/g, '');
      obj['ptime'] = entry['time'];
      obj['time'] = new Date(entry['time']);
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
      obj['cover'] = entry['thumbnails'][0];
      if (obj['img'][0]) {
        obj['cover'] = obj['img'][0];
      }

      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
        }
      });
    });//News.findOne
  });//request
};

var getTopicDetail = function(entry) {
  // http://inews.qq.com/getQQNewsSimpleHtmlContent?id=TPC2013061100203800
  var topicDetailLink = "http://inews.qq.com/getQQNewsSimpleHtmlContent?id=%s";
  var docid = util.format("%s",entry['id']);
  var url = util.format(topicDetailLink, docid);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    if(err || (res.statusCode != 200) || (!body)) {
      console.log("hzfdbg file[" + __filename + "]" + " getTopicDetail():error");
      console.log(err);console.log(url);console.log(util.inspect(res));console.log(body);
      return;
    }
    //console.log("hzfdbg file[" + __filename + "]" + " getTopicDetail() util.inspect(body)="+util.inspect(body));
    var json = null;
    try {
      json = JSON.parse(body);
    }
    catch (e) {
      json = null;
      console.log("hzfdbg file[" + __filename + "]" + " getTopicDetail():JSON.parse() catch error");
      console.log(e);
    }
    if((!json) || (json['ret'] != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " getTopicDetail():ret="+json['ret']);
      return;
    }
    var jObj = json;
    var obj = {};

    News.findOne(genQqFindCmd(site, entry), function(err, result) {
      if(err) {
        console.log("hzfdbg file[" + __filename + "]" + " getTopicDetail(), News.findOne():error " + err);
        return;
      }
      if (result) {
        //console.log("hzfdbg file[" + __filename + "]" + " getTopicDetail(), News.findOne():exist ");
        return;
      }
      obj['docid'] = encodeDocID(site, docid);
      obj['site'] = site;
      //obj['jsonstr'] = body; // delete it to save db size
      obj['body'] = jObj['intro'] + jObj['content']['text'];
      obj['img'] = [];
      var attribute = jObj['attribute'];
      var img_keys = _.keys(attribute);
      img_keys.forEach(function(key){
        obj['img'][obj['img'].length] = attribute[key]['url'];
        var imgHtml = genLazyLoadHtml(entry['tagName'], attribute[key]['url']);
        obj['body'] = obj['body'].replace("<!--" + key + "-->", imgHtml); // <!--IMG_4-->
      });
      obj['video'] = [];
      obj['link'] = "";
      if(entry['url']) {
        obj['link'] = entry['url']; // http://view.inews.qq.com/a/TPC2013061100203800
      }else if(entry['surl']) {
        obj['link'] = entry['surl']; // http://view.inews.qq.com/a/TPC2013061100203800
      }else if(jObj['url']) {
        obj['link'] = jObj['url']; // http://view.inews.qq.com/a/TPC2013061100203800
      }else if(jObj['surl']) {
        obj['link'] = jObj['surl']; // http://view.inews.qq.com/a/TPC2013061100203800
      }else {
        obj['link'] = util.format("http://view.inews.qq.com/a/%s", docid);
      }
      obj['title'] = entry['title'];//.trim().replace(/\s+/g, '');
      obj['ptime'] = entry['time'];
      obj['time'] = new Date(entry['time']);
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
      obj['cover'] = entry['thumbnails'][0];
      if (obj['img'][0]) {
        obj['cover'] = obj['img'][0];
      }

      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getTopicDetail(), News.insert():error " + err);
        }
      });
    });//News.findOne
  });//request
};

var getPhotoDetail = function(entry) {
  // http://inews.qq.com/getQQNewsSimpleHtmlContent?id=PIC2013061200601000&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_photo&appver=16_android_2.7.0
  var photoDetailLink = "http://inews.qq.com/getQQNewsSimpleHtmlContent?id=%s&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_photo&appver=16_android_2.7.0";
  var docid = util.format("%s",entry['id']);
  var url = util.format(photoDetailLink, docid);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
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
    }
    if((!json) || (json['ret'] != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail():ret="+json['ret']);
      return;
    }
    var jObj = json;
    var obj = {};

    News.findOne(genQqFindCmd(site, entry), function(err, result) {
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
      obj['body'] = jObj['intro'] + jObj['content']['text'];
      obj['img'] = [];
      var attribute = jObj['attribute'];
      var img_keys = _.keys(attribute);
      img_keys.forEach(function(key){
        obj['img'][obj['img'].length] = attribute[key]['url'];
        var imgHtml = attribute[key]['desc'] + genLazyLoadHtml(attribute[key]['desc'], attribute[key]['url']);
        obj['body'] = obj['body'].replace("<!--" + key + "-->", imgHtml); // <!--IMG_4-->
      });
      obj['video'] = [];
      obj['link'] = "";
      if(entry['url']) {
        obj['link'] = entry['url']; // http://view.inews.qq.com/a/TPC2013061100203800
      }else if(entry['surl']) {
        obj['link'] = entry['surl']; // http://view.inews.qq.com/a/TPC2013061100203800
      }else if(jObj['url']) {
        obj['link'] = jObj['url']; // http://view.inews.qq.com/a/TPC2013061100203800
      }else if(jObj['surl']) {
        obj['link'] = jObj['surl']; // http://view.inews.qq.com/a/TPC2013061100203800
      }else {
        obj['link'] = util.format("http://view.inews.qq.com/a/%s", docid);
      }
      obj['title'] = entry['title'];//.trim().replace(/\s+/g, '');
      obj['ptime'] = entry['time'];
      obj['time'] = new Date(entry['time']);
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
      obj['cover'] = entry['thumbnails'][0];
      if (obj['img'][0]) {
        obj['cover'] = obj['img'][0];
      }

      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail(), News.insert():error " + err);
        }
      });
    });//News.findOne
  });//request
};

var findTagInSummary = function(entry, tagType) {
  var i = 0, j = 0;

  if(!entry) {
    console.log("findTagInSummary() null obj");
    console.log(util.inspect(entry));
    return "";
  }

  for(i=0; i<tags.length; i++) {
    if(qqTags[tags[i]].indexOf(tagType) === -1) {
      continue;
    }
    if (entry['title'] && (entry['title'].indexOf(tags[i]) !== -1)) {
      return tags[i];
    }else if (entry['source'] && (entry['source'].indexOf(tags[i]) !== -1)) {
      return tags[i];
    }else if (entry['abstract'] && (entry['abstract'].indexOf(tags[i]) !== -1)) {
      return tags[i];
    }else if(entry['tag']) {
      for(j=0; j<entry['tag'].length; j++){
        if((entry['tag'][j]) && (entry['tag'][j].indexOf(tags[i]) !== -1)) {
          return tags[i];
        }
      } // for j=0
    }
  } // for i=0

  return "";
}

var findTagInDetail = function(entry) {
  var i = 0, j = 0;

  if((!entry) || (!entry['content']) || (!entry['content'].length)) {
    console.log("findTagInDetail() null obj");
    console.log(util.inspect(entry));
    return "";
  }

  for(i=0; i<entry['content'].length; i++){
    if((entry['content'][i]['type']) && (entry['content'][i]['type'] === 1)) { // text
      for(j=0; j<tags.length; j++) {
        if((entry['content'][i]['value']) && (entry['content'][i]['value'].indexOf(tags[j]) !== -1)) {
          return tags[j];
        }
      } // for j=0
    }
  } // for i=0

  return "";
}

var crawlerHeadLineFirstTime = 1; //Crawl more pages at the first time
var crawlerHeadLine = function () {
  // http://inews.qq.com/getQQNewsIndexAndItems?store=63&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_news_top&appver=16_android_2.6.0
  // http://inews.qq.com/getQQNewsIndexAndItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_news_top&appver=16_android_2.7.0
  var headlineLink = 'http://inews.qq.com/getQQNewsIndexAndItems?store=%d';
  var MAX_PAGE_NUM = 63;
  var page = 63;
  if(crawlerHeadLineFirstTime) {
    //console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): All");
    //MAX_PAGE_NUM = 20;
    crawlerHeadLineFirstTime = 0;
  }
  for(page=63; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    var url = util.format(headlineLink, page);
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
      if(json['ret'] != 0) {
        console.log("zhutest file[" + __filename + "]" + " crawlerHeadLine():home page ret="+json['ret']);
        return;
      }
      var ids = json["idlist"][0]["ids"];
      var i = 0;
      ids.forEach(function(idsEntry) {
        var summaryUrl = util.format("http://inews.qq.com/getQQNewsListItems?store=63&ids=%s", idsEntry['id']);
        var req = {uri: summaryUrl, method: "GET", headers: headers};
        if(proxyEnable) {
          req.proxy = proxyUrl;
        }
        request(req, function (err, res, body) {
          if(err || (res.statusCode != 200) || (!body)) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():summaryUrl error");
            console.log(err);console.log(summaryUrl);console.log(util.inspect(res));console.log(body);
            return;
          }
          var summary_json = null;
          try {
            summary_json = JSON.parse(body);
          }
          catch (e) {
            summary_json = null;
            console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():JSON.parse() summary_json catch error");
            console.log(e);
          }
          if(!summary_json) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():JSON.parse() summary_json error");
            return;
          }
          if(summary_json['ret'] != 0) {
            console.log("zhutest file[" + __filename + "]" + " crawlerHeadLine():summaryUrl ret="+summary_json['ret']);
            return;
          }
          var newsList = summary_json["newslist"];
          if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():summaryUrl newsList empty in url " + summaryUrl);
            return;
          }
          var newsEntry =newsList[0];
          try {
            newsEntry['tagName'] = findTagInSummary(newsEntry, "qq_news");
            if (newsEntry['tagName']) {
              News.findOne(genQqFindCmd(site, newsEntry), function(err, result) {
                if(err) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(), News.findOne():error " + err);
                  return;
                }
                if (!result) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():summaryUrl ["+newsEntry['tagName']+"]"+newsEntry['title']+",docid="+newsEntry['id']);
                  startGetDetail.emit('startGetNewsDetail', newsEntry);
                }
              }); // News.findOne
            }else {
              var detailUrl = util.format(detailLink, newsEntry['id']);
              var req = {uri: detailUrl, method: "GET", headers: headers};
              if(proxyEnable) {
                req.proxy = proxyUrl;
              }
              request(req, function (err, res, body) {
                if(err || (res.statusCode != 200) || (!body)) {
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): detailUrl error");
                  console.log(err);console.log(detailUrl);console.log(util.inspect(res));console.log(body);
                  return;
                }
                var json = null;
                try {
                  json = JSON.parse(body);
                }
                catch (e) {
                  json = null;
                  console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): detailUrl JSON.parse() catch error");
                  console.log(e);
                }
                if((!json) || (!json.ret) || (json.ret != 0)) {
                  //console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): detailUrl ret="+json['ret']);
                  return;
                }
                var newsDetail = json;
                newsEntry['tagName'] = findTagInDetail(newsDetail, "qq_news");
                if (newsEntry['tagName']) {
                  News.findOne(genQqFindCmd(site, newsEntry), function(err, result) {
                    if(err) {
                      console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): detailUrl News.findOne():error " + err);
                      return;
                    }
                    if (!result) {
                      console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): detailUrl ["+newsEntry['tagName']+"]"+newsEntry['title']+",docid="+newsEntry['id']);
                      startGetDetail.emit('startGetNewsDetail', newsEntry);
                    }
                  }); // News.findOne
                }
              });
            }
          }
          catch (e) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): catch error");
            console.log(e);
          }
        });
      });
    });//request url
    })(page);
  }//for
};

var crawlerTopicFirstTime = 1; //Crawl more pages at the first time
var crawlerTopic = function () {
  // http://inews.qq.com/getQQNewsIndexAndItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_topic&appver=16_android_2.7.0
  var topicLink = 'http://inews.qq.com/getQQNewsIndexAndItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_topic&appver=16_android_2.7.0';
  var MAX_PAGE_NUM = 3;
  var NEWS_NUM_PER_PAGE = 20;

  if(crawlerTopicFirstTime) {
    //console.log("hzfdbg file[" + __filename + "]" + " crawlerTopic(): All");
    MAX_PAGE_NUM = 3;//10;
    crawlerTopicFirstTime = 0;
  }

  var url = topicLink;
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    if(err || (res.statusCode != 200) || (!body)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerTopic():error");
      console.log(err);console.log(url);/*console.log(util.inspect(res));*/console.log(body);
      return;
    }
    var json = null;
    try {
      json = JSON.parse(body);
    }
    catch (e) {
      json = null;
      console.log("hzfdbg file[" + __filename + "]" + " crawlerTopic():JSON.parse() catch error");
      console.log(e);
    }
    if(!json) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerTopic():JSON.parse() error");
      return;
    }
    if(json['ret'] != 0) {
      console.log("zhutest file[" + __filename + "]" + " crawlerTopic():home page ret="+json['ret']);
      return;
    }
    var ids = json["idlist"][0]["ids"];
    if((MAX_PAGE_NUM * NEWS_NUM_PER_PAGE) < ids.length) {
      ids = ids.slice(0,MAX_PAGE_NUM * NEWS_NUM_PER_PAGE)
    }
    ids.forEach(function(idsEntry) {
      // http://inews.qq.com/getQQNewsListItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=TPC2013061100203800
      var summaryUrl = util.format("http://inews.qq.com/getQQNewsListItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=%s", idsEntry['id']);
      var req = {uri: summaryUrl, method: "GET", headers: headers};
      if(proxyEnable) {
        req.proxy = proxyUrl;
      }
      request(req, function (err, res, body) {
        if(err || (res.statusCode != 200) || (!body)) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerTopic():summaryUrl error");
          console.log(err);console.log(summaryUrl);console.log(util.inspect(res));console.log(body);
          return;
        }
        var summary_json = null;
        try {
          summary_json = JSON.parse(body);
        }
        catch (e) {
          summary_json = null;
          console.log("hzfdbg file[" + __filename + "]" + " crawlerTopic():JSON.parse() summary_json catch error");
          console.log(e);
        }
        if(!summary_json) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerTopic():JSON.parse() summary_json error");
          return;
        }
        if(summary_json['ret'] != 0) {
          console.log("zhutest file[" + __filename + "]" + " crawlerTopic():summaryUrl ret="+summary_json['ret']);
          return;
        }
        var newsList = summary_json["newslist"];
        if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerTopic():summaryUrl newsList empty in url " + summaryUrl);
          return;
        }
        var newsEntry =newsList[0];
        try {
          newsEntry['tagName'] = "今日话题";//findTagInSummary(newsEntry);
          if (newsEntry['tagName']) {
            News.findOne(genQqFindCmd(site, newsEntry), function(err, result) {
              if(err) {
                console.log("hzfdbg file[" + __filename + "]" + " crawlerTopic(), News.findOne():error " + err);
                return;
              }
              if (!result) {
                console.log("hzfdbg file[" + __filename + "]" + " crawlerTopic():summaryUrl ["+newsEntry['tagName']+"]"+newsEntry['title']+",docid="+newsEntry['id']);
                startGetDetail.emit('startGetTopicDetail', newsEntry);
              }
            }); // News.findOne
          }
        }
        catch (e) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerTopic(): catch error");
          console.log(e);
        }
      });
    });
  });//request url
};

var crawlerPhotoFirstTime = 1; //Crawl more pages at the first time
var crawlerPhoto = function () {
  // http://inews.qq.com/getQQNewsIndexAndItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_photo&appver=16_android_2.7.0
  var photoLinks = [
    'http://inews.qq.com/getQQNewsIndexAndItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_photo&appver=16_android_2.7.0', // 精选
    'http://inews.qq.com/getQQNewsIndexAndItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_photo_yl&appver=16_android_2.7.0', // 娱乐
    'http://inews.qq.com/getQQNewsIndexAndItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_photo_mn&appver=16_android_2.7.0', // 美女
    //'http://inews.qq.com/getQQNewsIndexAndItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_photo_qiqu&appver=16_android_2.7.0', // 奇趣
    //'http://inews.qq.com/getQQNewsIndexAndItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_photo_sy&appver=16_android_2.7.0', //摄影
  ];
  var MAX_PAGE_NUM = 3;
  var NEWS_NUM_PER_PAGE = 20;

  if(crawlerPhotoFirstTime) {
    //console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto(): All");
    MAX_PAGE_NUM = 3;//10;
    crawlerPhotoFirstTime = 0;
  }

  photoLinks.forEach(function(link) {
  var url = link;
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
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
    if(json['ret'] != 0) {
      console.log("zhutest file[" + __filename + "]" + " crawlerPhoto():home page ret="+json['ret']);
      return;
    }
    var ids = json["idlist"][0]["ids"];
    if((MAX_PAGE_NUM * NEWS_NUM_PER_PAGE) < ids.length) {
      ids = ids.slice(0,MAX_PAGE_NUM * NEWS_NUM_PER_PAGE)
    }
    ids.forEach(function(idsEntry) {
      // http://inews.qq.com/getQQNewsListItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=PIC2013061200601200&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_photo&appver=16_android_2.7.0
      var summaryUrl = util.format("http://inews.qq.com/getQQNewsListItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=%s&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_photo&appver=16_android_2.7.0", idsEntry['id']);
      var req = {uri: summaryUrl, method: "GET", headers: headers};
      if(proxyEnable) {
        req.proxy = proxyUrl;
      }
      request(req, function (err, res, body) {
        if(err || (res.statusCode != 200) || (!body)) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():summaryUrl error");
          console.log(err);console.log(summaryUrl);console.log(util.inspect(res));console.log(body);
          return;
        }
        var summary_json = null;
        try {
          summary_json = JSON.parse(body);
        }
        catch (e) {
          summary_json = null;
          console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():JSON.parse() summary_json catch error");
          console.log(e);
        }
        if(!summary_json) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():JSON.parse() summary_json error");
          return;
        }
        if(summary_json['ret'] != 0) {
          console.log("zhutest file[" + __filename + "]" + " crawlerPhoto():summaryUrl ret="+summary_json['ret']);
          return;
        }
        var newsList = summary_json["newslist"];
        if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():summaryUrl newsList empty in url " + summaryUrl);
          return;
        }
        var newsEntry =newsList[0];
        try {
          newsEntry['tagName'] = findTagInSummary(newsEntry, "qq_photo");
          if (newsEntry['tagName']) {
            News.findOne(genQqFindCmd(site, newsEntry), function(err, result) {
              if(err) {
                console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto(), News.findOne():error " + err);
                return;
              }
              if (!result) {
                console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():summaryUrl ["+newsEntry['tagName']+"]"+newsEntry['title']+",docid="+newsEntry['id']);
                startGetDetail.emit('startGetPhotoDetail', newsEntry);
              }
            }); // News.findOne
          }
        }
        catch (e) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto(): catch error");
          console.log(e);
        }
      });
    });
  });//request url
  }); // forEach
};

var qqCrawler = function() {
  console.log("hzfdbg file[" + __filename + "]" + " qqCrawler():Date="+new Date());
  crawlerHeadLine();
  crawlerTopic();
  crawlerPhoto();
  setTimeout(qqCrawler, 1000 * 60 * 60);
}

exports.qqCrawler = qqCrawler;
qqCrawler();
