var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var sohuTags = require('config').Config.sohuTags;
var tags = _.keys(sohuTags);
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var xml2json = require('xml2json');
var jsdom = require("jsdom").jsdom;;
var headers = {
    'User-Agent': 'NTES Android',
    'Referer': 'http://api.k.sohu.com/'
};
// http://api.k.sohu.com/api/channel/news.go?channelId=1&num=100&page=1&showPic=1&rt=json
var headlineLink = 'http://api.k.sohu.com/api/channel/news.go?channelId=1&num=100&page=%d&rt=json';
// http://api.k.sohu.com/api/flow/newslist.go?subId=681&pubId=0&sid=18&rt=flowCallback&pageNum=1
var tagLink = 'http://api.k.sohu.com/api/flow/newslist.go?subId=%s&pubId=0&sid=18&rt=json&pageNum=%d';
// http://api.k.sohu.com/api/news/article.go?newsId=7189277
var detailLink = 'http://api.k.sohu.com/api/news/article.go?newsId=%s';

function pickImg(html) {
  var document = jsdom(html);
  objs = document.getElementsByTagName('img');
  var img = [];
  if(objs) {
    for(i=0; i<objs.length; i++) {
      img[i] = {};
      img[i]['src'] = objs[i].getAttribute('data-src');
      img[i]['alt'] = objs[i].getAttribute('alt');
      img[i]['data-src'] = objs[i].getAttribute("src");
    }
  }
  return img;
}

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetDetail', function (entry, tag) {
  getDetail(entry, tag);
});

var getDetail = function(entry, tag) {
  var docid = util.format("%s",entry['newsId']);
  var url = util.format(detailLink, docid);
  /*if(tag === "图粹") {
    console.log("hzfdbg file[" + __filename + "]" + " getDetail():tc"+entry['title']);
    url = util.format("http://api.k.sohu.com/api/photos/gallery.go?newsId=%s", docid);
  }*/
  request({uri: url, headers: headers}, function (err, res, body) {
    if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " getDetail():error");
        console.log(err);console.log(url);console.log(util.inspect(res));console.log(body);
        return;
    }
    //console.log("hzfdbg file[" + __filename + "]" + " getDetail() util.inspect(body)="+util.inspect(body));
    var json = xml2json.toJson(body,{object:true, sanitize:false});
    var jObj = json['root'];
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
        obj['site'] = "sohu";
        obj['jsonstr'] = body;
        obj['body'] = jObj['content'].replace(/90_90/gi,"602_1000");//小图片替换为大图片
        obj['img'] = pickImg(obj['body']);
        obj['video'] = [];
        obj['link'] = jObj['link'];
        obj['title'] = entry['title'].trim().replace(/\s+/g, '');
        obj['ptime'] = jObj['time'];
        obj['time'] = new Date(Date.parse(jObj['time']));
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
        if(entry['listPic']) {
          obj['cover'] = entry['listPic'];
        } else if(entry['listpic']) {
          obj['cover'] = entry['listpic'];
        } else if(obj['img'][0]) {
          obj['cover'] = obj['img'][0]['src'];
        }
        if (obj['img'][1]) {
          obj['cover'] = obj['img'][1]['src'];
          //console.log("hzfdbg file[" + __filename + "]" + " cover="+obj['cover']);
        }

        // img lazyloading
        for(i=0; i<obj['img'].length; i++) {
          var imgHtml = genLazyLoadHtml(obj['img'][i]['alt'], obj['img'][i]['data-src']);
          //obj['marked'] = obj['marked'].replace(/<img.*?\/>/gi, imgHtml);
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

var crawlerHeadLine = function () {
  var MAX_PAGE_NUM = 5;
  var page = 1;
  for(page=1; page<=MAX_PAGE_NUM; page++) {
    var url = util.format(headlineLink, page);
    request({uri: url, headers: headers}, function (err, res, body) {
      if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():error");
        console.log(err);console.log(url);console.log(util.inspect(res));console.log(body);
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
      var newsList = json["articles"];
      if(newsList.length <= 0) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():newsList empty");
        return;
      }
      newsList.forEach(function(newsEntry) {
        for(var i = 0; i < tags.length; i++) {
          if(sohuTags[tags[i]].indexOf("sohu_") === -1) {//crawlerTags will handle these tags, so skip them here
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
  var page = 1;
  for(page=1; page<=MAX_PAGE_NUM; page++) {
    var url = util.format(tagLink, id, page);
    request({uri: url, headers: headers}, function (err, res, body) {
      if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerTag():error");
        console.log(err);console.log(url);console.log(util.inspect(res));console.log(body);
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
      var newsList = json['newsList'];
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
      if(sohuTags[tagName].indexOf("sohu_") === -1) {
        crawlerTag(tagName,sohuTags[tagName]);
      }
    });
}

exports.crawlerHeadLine = crawlerHeadLine;
exports.crawlerTags = crawlerTags;
crawlerTags();
crawlerHeadLine();
