var util = require('util');
var request = require('request');
var xml2json = require('xml2json');
var Image = require('./models/image');
var site = "mnbqg";
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';

var headers = {
  'User-Agent': '6.1.0',
  'Host': 'newxml3.b0.upaiyun.com',
  'Connection': 'Keep-Alive',
  //'Accept-Encoding': 'gzip'
};

//http://newxml3.b0.upaiyun.com/3/tab.xml
var categorys = [];
var crawlerCategory = function (entry) {
  var MAX_PAGE_NUM = 3;
  var page = 1;

  if(entry.first == 1) {
    entry.first = 0;
    MAX_PAGE_NUM = 1 + entry.maxpage;
  }
  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    //http://newxml3.b0.upaiyun.com/3/1_1.xml
    //http://newxml3.b0.upaiyun.com/3/1_2.xml
    var url = util.format('http://newxml3.b0.upaiyun.com/3/%d_%d.xml', entry.id, page);
    var req = {uri: url, method: "GET", headers: headers};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
    request(req, function (err, res, body) {
      if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory().request():error");
        console.log(err);console.log(url);/*console.log(util.inspect(res));*/console.log(body);
        return;
      }
      var json = xml2json.toJson(body,{object:true, sanitize:false});
      if(!json) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory().xml2json() error");
        return;
      }
      var imageList = json.list.i;
      if((!imageList) || (!imageList.length) || (imageList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():imageList empty in url " + url);
        return;
      }
      imageList.forEach(function(imageEntry) {
        //console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory(), i=" + imageEntry.i);
        Image.findOne({'site':site, 'id':imageEntry.id}, function(err, result) {
          if(err) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory(), Image.findOne():error " + err);
            return;
          }
          if (result) {
            //console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory(), Image.findOne():exist ");
            return;
          }
          var obj = imageEntry;
          obj.id = util.format("%s", imageEntry.id);
          obj.alt = imageEntry.i;
          obj.thumbnailImgs = [];
          obj.middleImgs = [];
          obj.originalImgs = [];
          obj.num = imageEntry.c - 1;
          if(obj.num < 1) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory(), no image");
            return;
          }
          var i = 0;
          for(i=1; i<=obj.num; i++) {
            obj.thumbnailImgs.push(util.format('%s%d%s', imageEntry.u, i, '.JPG!250'));//http://APPIMG.B0.UPAIYUN.COM/sheying/zol_16_592388/1.JPG!250
            obj.middleImgs.push(util.format('%s%d%s', imageEntry.u, i, '.JPG!400'));//http://APPIMG.B0.UPAIYUN.COM/sheying/zol_16_592388/1.JPG!400
            obj.originalImgs.push(util.format('%s%d%s', imageEntry.u, i, '.JPG!1200'));//http://APPIMG.B0.UPAIYUN.COM/sheying/zol_16_592388/1.JPG!1200
          }
          obj.src = obj.thumbnailImgs[0]; //cover
          obj.site = site;
          obj.tags = imageEntry.t;
          obj.created = new Date();
          obj.page = page;
          obj.time = new Date();

          Image.insert(obj, function (err, result) {
            if(err) {
              console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory(), Image.insert():error " + err);
              return;
            }
          }); // Image.insert
        }); // Image.findOne
      });//forEach
    });//request
    })(page);
  }//for
};

var initCatalogList = function() {
  var url = 'http://newxml3.b0.upaiyun.com/3/tab.xml';
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    if(err || (res.statusCode != 200) || (!body)) {
      console.log("hzfdbg file[" + __filename + "]" + " initCatalogList():error");
      console.log(err);console.log(url);/*console.log(util.inspect(res));*/console.log(body);
      return;
    }
    var json = xml2json.toJson(body,{object:true, sanitize:false});
    if(!json) {
      console.log("hzfdbg file[" + __filename + "]" + " initCatalogList().xml2json() error");
      return;
    }
    //console.log(util.inspect(json.app.tabs));
    var catalogList = json.app.tabs.t;
    if((!catalogList) || (!catalogList.length) || (catalogList.length <= 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " initCatalogList():catalogList empty in url " + url);
      return;
    }
    var i = 0;
    categorys = [];
    for(i=0; i<catalogList.length; i++) {
      var e = catalogList[i];
      categorys.push({id:e.i, name:e.n, icon:e.u, d:e.d, c:e.c, first:1, pagesize:34, maxpage:e.sb});
    }
  });//request
}

var crawlerAllCategory = function() {
  categorys.forEach(function(entry) {
    //if(entry.id == 250)
    crawlerCategory(entry);
  });//forEach

  setTimeout(crawlerAllCategory, 1000 * 60 * 60 * 8); // 8 hours
}

var mnbqgCrawler = function() {
  console.log("hzfdbg file[" + __filename + "]" + " mnbqgCrawler():Start time="+new Date());
  initCatalogList();
  setTimeout(crawlerAllCategory, 1000 * 5); // delay 5 seconds
}

exports.mnbqgCrawler = mnbqgCrawler;
mnbqgCrawler();