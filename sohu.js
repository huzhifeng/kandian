var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var sohuTags = require('config').Config.sohuTags;
var tags = _.keys(sohuTags);
var News = require('./models/news');
var xml2json = require('xml2json');
var jsdom = require("jsdom").jsdom;;
var headers = {
    'User-Agent': 'NTES Android',
    'Referer': 'http://api.k.sohu.com/'
};
// http://api.k.sohu.com/api/channel/news.go?channelId=1&num=100&page=1&rt=json
var listLink = 'http://api.k.sohu.com/api/channel/news.go?channelId=1&num=100&page=%d&rt=json';
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

startGetDetail.on('startGetDetail', function (obj) {
  getDetail(obj);
});

var getDetail = function(entry, tag, mustUpdate) {
  var docid = entry['newsId'];
  var uri = util.format(detailLink, docid);
  //console.log(uri);
  request({uri: uri, headers: headers}, function (err, response, body) {
    if (!err && response.statusCode === 200) {
      //console.log("zhutest file[" + __filename + "]" + " getDetail() util.inspect(body)="+util.inspect(body));
      var json = xml2json.toJson(body,{object:true, sanitize:false});
      var jObj = json['root'];
      var obj = {};
      obj['docid'] = docid;//jObj['newsId'];
      
      News.findOne({docid: obj['docid']}, function(err, result) {
        if(!err) {
          var isUpdate = false;
          if (mustUpdate) {
            isUpdate = true;
          } else if (result && !result.disableAutoUpdate && (result.body !== jObj['content'] || result.title !== jObj['title'].trim().replace(/\s+/g, ''))) {
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
            obj['cover'] = entry['listPic'];
            if (obj['img'][1]) {
              //console.log("zhutest file[" + __filename + "]" + " cover="+obj['img'][1]['src']);
              obj['cover'] = obj['img'][1]['src'];
            }

            // img lazyloading
            for(i=0; i<obj['img'].length; i++) {
              var imgHtml = util.format('<img class="lazy" alt="%s" src="/img/grey.gif" data-original="%s" /><noscript><img alt="%s" src="%s" /></noscript>',
                obj['img'][i]['alt'], obj['img'][i]['data-src'], obj['img'][i]['alt'], obj['img'][i]['data-src']);
              //obj['marked'] = obj['marked'].replace(/<img.*?\/>/gi, imgHtml);
              //console.log("zhutest file[" + __filename + "]" + " imgHtml="+imgHtml);
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

          }
          else {
            console.log("zhutest file[" + __filename + "]" + " already exist");
          }
        } else {
          console.log(err);
        }//if(!err)
      });//News.findOne
    } else {
      console.log(err);
    }
  });//request
};

var MAX_PAGE_NUM = 20;
var crawlerAll = function () {
  for(page=1; page<=MAX_PAGE_NUM; page++) {
    var uri = util.format(listLink, page);
    request({uri: uri, headers: headers}, function (err, response, body) {
      if (!err && response.statusCode === 200 && body) {
        var jobj = JSON.parse(body)["articles"];
        if (jobj.length > 0) {
          jobj.forEach(function(obj) {
            for(var i = 0; i < tags.length; i++) {
              if (obj['title'].indexOf(tags[i]) !== -1) {
                //console.log("zhutest file[" + __filename + "]" + " crawlerAll():title="+obj['title']);
                startGetDetail.emit('startGetDetail', obj);
              }
            }
          });//forEach
        }
        else {
          page = MAX_PAGE_NUM;
        }
      } else {
        console.log(err);
      }
    });//request
  }//for
};

exports.crawlerAll = crawlerAll;
crawlerAll();
