var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var sinaTags = require('config').Config.sinaTags;
var tags = _.keys(sinaTags);
var News = require('./models/news');
var xml2json = require('xml2json');
var jsdom = require("jsdom").jsdom;;
var headers = {
    'User-Agent': 'NTES Android',
    'Referer': 'http://api.sina.cn/'
};
// http://api.sina.cn/sinago/list.json?channel=news_toutiao&p=1
var listLink = 'http://api.sina.cn/sinago/list.json?channel=news_toutiao&p=%d';
// http://data.3g.sina.com.cn/api/t/art/index.php?id=124-8468729-news-cms
var detailLink = 'http://data.3g.sina.com.cn/api/t/art/index.php?id=%s';

function pickImg(enclosure) {
  var objs = enclosure;
  //console.log("zhutest pickImg() util.inspect(objs)="+util.inspect(objs));
  var img = [];
  if(objs){
    if(objs[0]) {
      for(i=0; i<objs.length; i++) {
        img[i] = {};
        img[i]['src'] = objs[i]['url'].replace(/auto\.jpg/, "original.jpg");;
        img[i]['alt'] = objs[i]['alt'];
        img[i]['size'] = objs[i]["size"];
      }
    }
    else {
      img[0] = objs;
    }
  }
  return img;
}

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetDetail', function (obj) {
  getDetail(obj);
});

var getDetail = function(entry, tag, mustUpdate) {
  var docid = entry['id']
  var uri = util.format(detailLink, docid);
  //console.log(uri);
  request({uri: uri, headers: headers}, function (err, response, body) {
    if (!err && response.statusCode === 200) {
      //console.log("zhutest getDetail() util.inspect(body)="+util.inspect(body));
      var json = xml2json.toJson(body,{object:true, sanitize:false});
      var jObj = json['rss']["channel"]["item"];
      var obj = {};
      obj['docid'] = jObj['id'];
      
      News.findOne({docid: obj['docid']}, function(err, result) {
        if(!err) {
          var isUpdate = false;
          if (mustUpdate) {
            isUpdate = true;
          } else if (result && !result.disableAutoUpdate && (result.body !== jObj['description'] || result.title !== jObj['title'].trim().replace(/\s+/g, ''))) {
            isUpdate = true;
          }
          if (!result || isUpdate) {
            obj['site'] = "sina";
            obj['jsonstr'] = body;
            obj['body'] = jObj['description'];

            obj['img'] = pickImg(jObj['enclosure']);
            obj['video'] = [];
            obj['link'] = jObj['link'];

            obj['title'] = jObj['title'].trim().replace(/\s+/g, '');
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
            obj['cover'] = entry['listPic'];
            if (obj['img'][1]) {
              //console.log("zhutest cover="+obj['img'][1]['src']);
              obj['cover'] = obj['img'][1]['src'];
            }

            // img lazyloading
            for(i=0; i<obj['img'].length; i++) {
              var imgHtml = util.format('<br/><img class="lazy" alt="%s" src="/img/grey.gif" data-original="%s" /><noscript><img alt="%s" src="%s" /></noscript><br/>',
                obj['img'][i]['alt'], obj['img'][i]['src'], obj['img'][i]['alt'], obj['img'][i]['src']);
              obj['marked'] = obj['marked'].replace(/<br\/><br\/>/, imgHtml);
              //console.log("zhutest imgHtml="+imgHtml);
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
            console.log("zhutest already exist");
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

var MAX_PAGE_NUM = 25;
var crawlerAll = function () {
  for(page=1; page<=MAX_PAGE_NUM; page++) {
    var uri = util.format(listLink, page);
    request({uri: uri, headers: headers}, function (err, response, body) {
      if (!err && response.statusCode === 200 && body) {
        var jobj = JSON.parse(body)["data"]["list"];
        if (jobj.length > 0) {
          jobj.forEach(function(obj) {
            for(var i = 0; i < tags.length; i++) {
              if (obj['title'].indexOf(tags[i]) !== -1) {
                //console.log("zhutest crawlerAll():title="+obj['title']);
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
