var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require("lodash");
var ifengTags = require('config').Config.ifengTags;
var tags = _.keys(ifengTags);
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var jsdom = require("jsdom").jsdom;;
var headers = {
    'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.0.4; sdk Build/MR1)',
    'Referer': 'http://api.3g.ifeng.com/'
};
// http://api.3g.ifeng.com/newAndroidNews?id=SYDT10,SYLB10&type=imgchip,irank&picwidth=300&page=1&gv=3.6.0&av=3.6.0&uid=357719001482474&proid=ifengnews&os=android_15&df=androidphone&vt=5&screen=480x800
var listLink = 'http://api.3g.ifeng.com/newAndroidNews?id=SYDT10,SYLB10&type=imgchip,irank&picwidth=300&page=%d&gv=3.6.0&av=3.6.0&uid=357719001482474&proid=ifengnews&os=android_15&df=androidphone&vt=5&screen=480x800';
// http://api.iapps.ifeng.com/news/detail.json?aid=29584735
var detailLink = 'http://api.iapps.ifeng.com/news/detail.json?aid=%s';

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

startGetDetail.on('startGetDetail', function (obj) {
  getDetail(obj);
});

var getDetail = function(entry, tag) {
  var docid = entry['meta']['documentId'];
/*  var uri = util.format(detailLink, docid);
  //console.log("zhutest file[" + __filename + "]" + " uri=" + uri);
  request({uri: uri, headers: headers}, function (err, response, body) {
    if (!err && response.statusCode === 200) {
      //console.log("zhutest file[" + __filename + "]" + " getDetail() util.inspect(body)="+util.inspect(body));
      var json = JSON.parse(body);
      if(json['ret'] != 0) {
        console.log("zhutest file[" + __filename + "]" + " getDetail():ret="+json['ret']);
        return;
      }*/
      var jObj = entry;
      var obj = {};
      obj['docid'] = docid;
      
      News.findOne({docid: obj['docid']}, function(err, result) {
        if(!err) {
          var isUpdate = false;
          if (result && !result.disableAutoUpdate && (result.title !== jObj['body']['title'].trim().replace(/\s+/g, ''))) {
            isUpdate = true;
          }
          if (!result || isUpdate) {
            obj['site'] = "ifeng";
            obj['jsonstr'] = jObj['body']['text'];
            obj['body'] = jObj['body']['text'].replace(/width=["']140["']/g, '');;
            obj['img'] = pickImg(obj['body']);
            obj['video'] = [];
            obj['link'] = jObj['body']['wwwurl'];
            obj['title'] = jObj['body']['title'].replace(/\s+/g, '');
            obj['ptime'] = jObj['body']['editTime'];
            obj['time'] = new Date(obj['ptime']);
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
                if ((obj['title'].indexOf(tags[i]) !== -1) || (jObj['body']['title'].indexOf(tags[i]) !== -1) || (jObj['body']['source'].indexOf(tags[i]) !== -1)) {
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
            obj['cover'] = '';
            if (obj['img'][0]) {
              obj['cover'] = obj['img'][0];
            }

            // img lazyloading
            for(i=0; i<obj['img'].length; i++) {
              var imgHtml = genLazyLoadHtml(obj['img'][i]['alt'], obj['img'][i]['url']);
              //obj['marked'] = obj['marked'].replace(/<img.*?\/>/, imgHtml);
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
    /*} else {
      console.log(err);
    }
  });//request*/
};

var MAX_PAGE_NUM = 200;
var crawlerAll = function () {
  for(page=1; page<=MAX_PAGE_NUM; page++) {
    var uri = util.format(listLink, page);
    request({uri: uri, headers: headers}, function (err, response, body) {
      if (!err && response.statusCode === 200 && body) {
        var json = JSON.parse(body);
        //console.log("zhutest file[" + __filename + "]" + " crawlerAll():util.inspect(json)="+util.inspect(json));
        var i = 0, j = 0, k = 0;
        for(i=0; i<json.length; i++) {
          var obj = json[i]['doc'];
          for(j=0; j<obj.length; j++) {
            var item = obj[j];
            //console.log("zhutest file[" + __filename + "]" + " crawlerAll():util.inspect(item)="+util.inspect(item));
            //console.log("zhutest file[" + __filename + "]" + " crawlerAll():title="+item['body']['title']);
            for(k=0; k<tags.length; k++) {
              if ((item['body']['title'].indexOf(tags[k]) !== -1) || (item['body']['source'].indexOf(tags[k]) !== -1)) {
                console.log("zhutest file[" + __filename + "]" + " crawlerAll():item['body']['title']="+item['body']['title']);
                //console.log("zhutest file[" + __filename + "]" + " crawlerAll():item="+util.inspect(item));
                startGetDetail.emit('startGetDetail', item, tags[k]);
              }
            }
          }
        }
      } else {
        console.log(err);
      }
    });//request
  }//for
};

exports.crawlerAll = crawlerAll;
crawlerAll();
