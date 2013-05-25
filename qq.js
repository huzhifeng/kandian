var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var qqTags = require('config').Config.qqTags;
var tags = _.keys(qqTags);
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var jsdom = require("jsdom").jsdom;
var headers = {
    'User-Agent': '~...260(android)',
    'Referer': 'http://inews.qq.com'
};
// http://inews.qq.com/getQQNewsIndexAndItems?store=63&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_news_top&appver=16_android_2.6.0
// http://inews.qq.com/getQQNewsIndexAndItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_news_top&appver=16_android_2.7.0
var headlineLink = 'http://inews.qq.com/getQQNewsIndexAndItems?store=%d';
// http://inews.qq.com/getQQNewsNormalHtmlContent?id=NEW2013050300143202&store=63&hw=Xiaomi_MI2&devid=1366805394774330052&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_news_top&appver=16_android_2.6.0
var detailLink = 'http://inews.qq.com/getQQNewsNormalHtmlContent?id=%s';

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
    var json = null;
    try {
      json = JSON.parse(body);
    }
    catch (e) {
      json = null;
      console.log("hzfdbg file[" + __filename + "]" + " getDeatil():JSON.parse() catch error");
      console.log(e);
    }
    if(json['ret'] != 0) {
      console.log("hzfdbg file[" + __filename + "]" + " getDetail():ret="+json['ret']);
      return;
    }
    var jObj = json;
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
        obj['site'] = "qq";
        obj['jsonstr'] = body;
        obj['body'] = '';
        obj['img'] = [];
        jObj['content'].forEach(function(item) {
          if(item['type'] == 1) { //text
            obj['body'] += item['value'];
          }
          else if(item['type'] == 2) { //pic
            obj['body'] += genLazyLoadHtml('', item['value']);
            obj['img'][obj['img'].length] = item['value'];
          }
          else if(item['type'] == 3) { //video
            obj['body'] += genLazyLoadHtml('', item['value']['img']);
            obj['img'][obj['img'].length] = item['value']['img'];
          }
        });
        obj['video'] = [];
        obj['link'] = jObj['url'];
        obj['title'] = entry['title'].trim().replace(/\s+/g, '');// + "-" + entry['intro'].trim().replace(/\s+/g, '');
        obj['ptime'] = entry['time'];
        obj['time'] = new Date(entry['time']);
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
            if ((obj['title'].indexOf(tags[i]) !== -1) || (entry['title'].indexOf(tags[i]) !== -1) || (entry['source'].indexOf(tags[i]) !== -1)) {
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
        obj['cover'] = entry['thumbnails'][0];
        if (obj['img'][0]) {
          obj['cover'] = obj['img'][0];
        }

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
  var MAX_PAGE_NUM = 63;
  var page = 63;
  if(crawlAllHeadLine) {
    console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): All");
    //MAX_PAGE_NUM = 20;
    crawlAllHeadLine = 0;
  }
  for(page=63; page<=MAX_PAGE_NUM; page++) {
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
      if(json['ret'] != 0) {
        console.log("zhutest file[" + __filename + "]" + " crawlerHeadLine():home page ret="+json['ret']);
        return;
      }
      var ids = json["idlist"][0]["ids"];
      var i = 0;
      var newUrl = 'http://inews.qq.com/getQQNewsListItems?store=63&ids=';
      for(i=0; i<ids.length; i++) {
        newUrl += ids[i]['id'];
        if(i<(ids.length-1)) {
          newUrl += ',';
        }
      }
      request({uri: newUrl, headers: headers}, function (err, res, body) {
        if(err || (res.statusCode != 200) || (!body)) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():newUrl error");
          console.log(err);console.log(newUrl);console.log(util.inspect(res));console.log(body);
          return;
        }
        var newJson = null;
        try {
          newJson = JSON.parse(body);
        }
        catch (e) {
          newJson = null;
          console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():JSON.parse() catch error");
          console.log(e);
        }
        if(!newJson) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():newUrl JSON.parse() error");
          return;
        }
        if(newJson['ret'] != 0) {
          console.log("zhutest file[" + __filename + "]" + " crawlerHeadLine():newUrl ret="+newJson['ret']);
          return;
        }
        var newsList = newJson["newslist"];
        if(newsList.length <= 0) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():newUrl newsList empty");
          return;
        }
        newsList.forEach(function(newsEntry) {
          for(var i = 0; i < tags.length; i++) {
            if(qqTags[tags[i]].indexOf("qq_") === -1) {//crawlerTags will handle these tags, so skip them here
              continue;
            }
            if ((newsEntry['title'].indexOf(tags[i]) !== -1) || (newsEntry['source'].indexOf(tags[i]) !== -1)) {
             //console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():newUrl title="+newsEntry['title']);
             startGetDetail.emit('startGetDetail', newsEntry, tags[i]);
            }
          }//for
        });//forEach
      });//request newUrl
    });//request url
  }//for
};

exports.crawlerHeadLine = crawlerHeadLine;
crawlerHeadLine();
