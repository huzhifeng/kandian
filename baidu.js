var util = require('util');
var request = require('request');
var News = require('./models/news');
var Image = require('./models/image');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var genFindCmd = require('./lib/utils').genFindCmd;
var encodeDocID = require('./lib/utils').encodeDocID;
var genDigest = require('./lib/utils').genDigest;
var site = "baidu";
var baiduNewsTags = ['背景'];
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';

var imageHeaders = {
  //'Accept-Encoding': 'gzip',
  //'Accept-Encoding': 'gzip',
  'User-Agent': 'bdnews_android_phone',
  //'Accept-Encoding': 'gzip',
  'Host': 'app.image.baidu.com',
  'Connection': 'Keep-Alive'
};

var newsHeaders = {
  //'Accept-Encoding': 'gzip',
  //'Accept-Encoding': 'gzip',
  'User-Agent': 'bdnews_android_phone',
  //'Accept-Encoding': 'gzip',
  'Host': 'api.baiyue.baidu.com',
  'Connection': 'Keep-Alive'
};

//http://app.image.baidu.com/app?tag=1&startid=0&reqno=1&sesstime=20130806105154&netenv=wifi&reqtype=resource&appname=yuedu_News&func=list&channelid=1&width=0&height=0&version=1&erotic=1
var imageCategorys = [
  //{cateid:1,  first:1, label:"All", pagesize:40, maxpage:250},//http://app.image.baidu.com/app?tag=ALL&startid=0&sesstime=20130806170125&reqno=40&netenv=wifi&devtype=4.1.1&ie=utf-8&reqtype=latest&appname=yuedu_News&uuid=_c4:6a:b7:de:4d:24&erotic=1&cuid=C561296AC73B6B37D5F71989F2D0F08E
  {cateid:2,  first:1, label:"美空", pagesize:40, maxpage:250},//http://app.image.baidu.com/app?tag=美空&startid=0&sesstime=20130806105626&reqno=40&netenv=wifi&devtype=4.1.1&ie=utf-8&reqtype=latest&appname=yuedu_News&uuid=_c4:6a:b7:de:4d:24&erotic=1&cuid=C561296AC73B6B37D5F71989F2D0F08E
  {cateid:3,  first:1, label:"妹子图", pagesize:40, maxpage:250},//http://app.image.baidu.com/app?tag=妹子图&startid=0&sesstime=20130806105713&reqno=20&netenv=wifi&devtype=4.1.1&ie=utf-8&reqtype=packageList&appname=yuedu_News&uuid=_c4:6a:b7:de:4d:24&erotic=1
  {cateid:4,  first:1, label:"模特", pagesize:40, maxpage:250},//http://app.image.baidu.com/app?tag=模特&startid=0&sesstime=20130806105728&reqno=40&netenv=wifi&devtype=4.1.1&ie=utf-8&reqtype=latest&appname=yuedu_News&uuid=_c4:6a:b7:de:4d:24&erotic=1&cuid=C561296AC73B6B37D5F71989F2D0F08E
  {cateid:5,  first:1, label:"校花", pagesize:40, maxpage:250},//http://app.image.baidu.com/app?tag=校花&startid=0&sesstime=20130806105737&reqno=40&netenv=wifi&devtype=4.1.1&ie=utf-8&reqtype=latest&appname=yuedu_News&uuid=_c4:6a:b7:de:4d:24&erotic=1&cuid=C561296AC73B6B37D5F71989F2D0F08E
  {cateid:6,  first:1, label:"欧美", pagesize:40, maxpage:250},//http://app.image.baidu.com/app?tag=欧美&startid=0&sesstime=20130806105743&reqno=40&netenv=wifi&devtype=4.1.1&ie=utf-8&reqtype=latest&appname=yuedu_News&uuid=_c4:6a:b7:de:4d:24&erotic=1&cuid=C561296AC73B6B37D5F71989F2D0F08E
  {cateid:7 , first:1, label:"日韩", pagesize:40, maxpage:250},//http://app.image.baidu.com/app?tag=日韩&startid=0&sesstime=20130806105750&reqno=40&netenv=wifi&devtype=4.1.1&ie=utf-8&reqtype=latest&appname=yuedu_News&uuid=_c4:6a:b7:de:4d:24&erotic=1&cuid=C561296AC73B6B37D5F71989F2D0F08E
  {cateid:8 , first:1, label:"清新唯美", pagesize:40, maxpage:250},//http://app.image.baidu.com/app?tag=清新唯美&startid=0&sesstime=20130806105755&reqno=40&netenv=wifi&devtype=4.1.1&ie=utf-8&reqtype=latest&appname=yuedu_News&uuid=_c4:6a:b7:de:4d:24&erotic=1&cuid=C561296AC73B6B37D5F71989F2D0F08E
  {cateid:9 , first:1, label:"可爱", pagesize:40, maxpage:250},//http://app.image.baidu.com/app?tag=可爱&startid=0&sesstime=20130806105759&reqno=40&netenv=wifi&devtype=4.1.1&ie=utf-8&reqtype=latest&appname=yuedu_News&uuid=_c4:6a:b7:de:4d:24&erotic=1&cuid=C561296AC73B6B37D5F71989F2D0F08E
  {cateid:10, first:1, label:"性感", pagesize:40, maxpage:250},//http://app.image.baidu.com/app?tag=性感&startid=0&sesstime=20130806105804&reqno=40&netenv=wifi&devtype=4.1.1&ie=utf-8&reqtype=latest&appname=yuedu_News&uuid=_c4:6a:b7:de:4d:24&erotic=1&cuid=C561296AC73B6B37D5F71989F2D0F08E
  {cateid:11, first:1, label:"美腿", pagesize:40, maxpage:250},//http://app.image.baidu.com/app?tag=美腿&startid=0&sesstime=20130806105807&reqno=40&netenv=wifi&devtype=4.1.1&ie=utf-8&reqtype=latest&appname=yuedu_News&uuid=_c4:6a:b7:de:4d:24&erotic=1&cuid=C561296AC73B6B37D5F71989F2D0F08E
];

var newsCategorys = [
  {cateid:1, label:'头条', method:'GET', url:'http://api.baiyue.baidu.com/sn/api/focusnews?rn=%d&time=%s&direct=0&class=top&wf=1&mb=aries&withtoppic=1&ver=2&cuid=C561296AC73B6B37D5F71989F2D0F08E&type=0,1&manu=Xiaomi', time:0, first:1, pagesize:20},
  //{cateid:2, label:'军事', method:'POST', url:'http://api.baiyue.baidu.com/sn/api/recommendlist', time:0, first:1, pagesize:200},
  //{cateid:3, label:'娱乐', method:'POST', url:'http://api.baiyue.baidu.com/sn/api/recommendlist', time:0, first:1, pagesize:200},
  //{cateid:4, label:'搞笑', method:'POST', url:'http://api.baiyue.baidu.com/sn/api/recommendlist', time:0, first:1, pagesize:200},
  //{cateid:5, label:'精选', method:'POST', url:'http://api.baiyue.baidu.com/sn/api/recommendlist', time:0, first:1, pagesize:200},
];

var crawlerImageCategory = function (entry) {
  var MAX_PAGE_NUM = 3;
  var page = 1;

  if(entry.first == 1) {
    entry.first = 0;
    MAX_PAGE_NUM = 1 + entry.maxpage;
  }
  for(page=0; page<MAX_PAGE_NUM; page++) {
    (function(page) {
    //http://app.image.baidu.com/app?tag=%E7%BE%8E%E7%A9%BA&startid=0&sesstime=20130806105626&reqno=40&netenv=wifi&devtype=4.1.1&ie=utf-8&reqtype=latest&appname=yuedu_News&uuid=_c4:6a:b7:de:4d:24&erotic=1&cuid=C561296AC73B6B37D5F71989F2D0F08E
    //http://app.image.baidu.com/app?tag=%E7%BE%8E%E7%A9%BA&startid=40&sesstime=20130806105626&reqno=40&netenv=wifi&devtype=4.1.1&ie=utf-8&reqtype=latest&appname=yuedu_News&uuid=_c4:6a:b7:de:4d:24&erotic=1&cuid=C561296AC73B6B37D5F71989F2D0F08E
    var url = util.format("http://app.image.baidu.com/app?tag=%s&startid=%d&sesstime=20130806105626&reqno=%d&netenv=wifi&devtype=4.1.1&ie=utf-8&reqtype=latest&appname=yuedu_News&uuid=_c4:6a:b7:de:4d:24&erotic=1&cuid=C561296AC73B6B37D5F71989F2D0F08E", encodeURIComponent(entry.label), page*40, entry.pagesize);
    //console.log(url);
    var req = {uri: url, method: "GET", followRedirect:false, pool:{maxSockets:5}, headers: imageHeaders};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
    request(req, function (err, res, body) {
      if(err || (res.statusCode != 200) || (!body)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerImageCategory():error");
        console.log(err);console.log(url);/*console.log(util.inspect(res));*/console.log(body);
        return;
      }
      var json = null;
      try {
        json = JSON.parse(body);
      }
      catch (e) {
        json = null;
        console.log("hzfdbg file[" + __filename + "]" + " crawlerImageCategory():JSON.parse() catch error");
        console.log(e);
        return;
      }
      if(!json) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerImageCategory():JSON.parse() error");
        return;
      }
      var imageList = json.data;
      if((!imageList) || (!imageList.length) || (imageList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerImageCategory():imageList empty in url " + url);
        return;
      }
      imageList.forEach(function(imageEntry) {
        Image.findOne({'site':site, 'id':imageEntry.contsign}, function(err, result) {
          if(err) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerImageCategory(), Image.findOne():error " + err);
            return;
          }
          if (result) {
            //console.log("hzfdbg file[" + __filename + "]" + " crawlerImageCategory(), Image.findOne():exist ");
            return;
          }
          var obj = imageEntry;
          obj.id = imageEntry.contsign;
          obj.alt = imageEntry.tag;
          obj.src = imageEntry.objurl;
          if(!obj.src) {
            obj.src = util.format("http://i1.baidu.com/it/u=%s&fm=17", imageEntry.contsign); // http://i1.baidu.com/it/u=2178766881,636843846&fm=17
          }
          obj.site = site;
          obj.num = 1;
          obj.href = imageEntry.fromurl;
          obj.tags = imageEntry.tag;
          obj.created = new Date();
          if(14 <= imageEntry.editionno.length) {
            var t = imageEntry.editionno;
            var format = util.format("%s-%s-%s %s:%s:%s",t.slice(0,4),t.slice(4,6),t.slice(6,8),t.slice(8,10),t.slice(10,12),t.slice(12,14));//2012-09-21 17:17:24
            obj.time = new Date(format);
          }else {
            obj.time = obj.created;
          }

          Image.insert(obj, function (err, result) {
            if(err) {
              console.log("hzfdbg file[" + __filename + "]" + " crawlerImageCategory(), Image.insert():error " + err);
            }
          }); // Image.insert
        }); // Image.findOne
      });//forEach
    });//request
    })(page);
  }//for
};

var newsAdd = function(entry) {
  var obj = entry;
  obj.docid = encodeDocID(site, entry.nid);
  obj.site = site;
  obj.body = '';
  var content = entry.content;
  var i = 0;
  for(i=0; i<content.length; i++) {
    if('image' == content[i].type) {
      obj.body += genLazyLoadHtml(obj.title, content[i].data.original.url);
    }else if('text' == content[i].type) {
      obj.body += content[i].data;
    }
    obj.body += '<br>'
  }
  obj.link = entry.url;
  obj.title = entry.title;
  obj.ptime = parseInt(entry.ts);
  obj.time = new Date(obj.ptime);
  obj.marked = obj.body;
  obj.created = new Date();
  obj.views = 1;
  obj.tags = entry.tagName;
  obj.digest = genDigest(obj.body);
  obj.cover = '';
  if (entry.imageurls && entry.imageurls[0]) {
    //http://t10.baidu.com/it/u=http://c.hiphotos.baidu.com/news/pic/item/5366d0160924ab18fabaa5e334fae6cd7a890bb1.jpg&fm=36
    //http://t11.baidu.com/it/u=http://e.hiphotos.baidu.com/news/pic/item/ac345982b2b7d0a20a3e5849caef76094a369a6a.jpg&fm=36
    var t = entry.imageurls[0].url.split('u=http');
    obj.cover = 'http' + t[1];
  }

  News.insert(obj, function (err, result) {
    if(err) {
      console.log("hzfdbg file[" + __filename + "]" + " newsAdd(), News.insert():error " + err);
    }
  }); // News.insert
};

var crawlerNewsCategory = function (entry) {
  var url = '';
  var req = {};
  if('GET' == entry.method) {
    //http://api.baiyue.baidu.com/sn/api/focusnews?rn=20&time=0&direct=0&class=top&wf=1&mb=aries&withtoppic=1&ver=2&cuid=C561296AC73B6B37D5F71989F2D0F08E&type=0,1&manu=Xiaomi
    //http://api.baiyue.baidu.com/sn/api/focusnews?rn=20&time=1376106631&direct=0&class=top&wf=1&mb=aries&withtoppic=1&ver=2&cuid=C561296AC73B6B37D5F71989F2D0F08E&type=0,1&manu=Xiaomi
    url = util.format(entry.url, entry.pagesize, entry.time);
    req = {uri: url, method: "GET", headers: newsHeaders};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
  }else if('POST' == entry.method) {
    var data = {
      ts:entry.time,
      ln:entry.pagesize,//'200',
      an:'20',
      topic:entry.label,
      from:'news_smart',
      mid:'_c4:6a:b7:de:4d:24',
      mb:'aries',
      withtoppic:'1',
      ver:'2',
      'internet-subscribe':'1',
      cuid:'C561296AC73B6B37D5F71989F2D0F08E',
      manu:'Xiaomi'
    };
    url = entry.url;
    req = {uri: url, method: "POST", headers: newsHeaders, form: data};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
  }else {
    return;
  }
  request(req, function (err, res, body) {
    if(err || (res.statusCode != 200) || (!body)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerNewsCategory():error");
      console.log(err);console.log(url);/*console.log(util.inspect(res));*/console.log(body);
      return;
    }
    var json = null;
    try {
      json = JSON.parse(body);
    }
    catch (e) {
      json = null;
      console.log("hzfdbg file[" + __filename + "]" + " crawlerNewsCategory():JSON.parse() catch error");
      console.log(e);
      return;
    }
    if(!json) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerNewsCategory():JSON.parse() error");
      return;
    }
    if(json.errno && (json.errno != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerNewsCategory():errno");
      return;
    }
    var newsList = json.data.news;
    if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerNewsCategory():newsList empty in url " + url);
      return;
    }
    if(entry.first && json.data.hasmore && json.data.st) {
      //console.log('st='+json.data.st);
      entry.time = json.data.st;
      setTimeout(function() {
        crawlerNewsCategory(entry);
      }, 100);
    }else if(entry.first && json.data.ts) {
      //console.log('ts='+json.data.ts);
      entry.time = json.data.ts;
      setTimeout(function() {
        crawlerNewsCategory(entry);
      }, 100);
    }else {
      entry.first = 0;
      entry.time = 0;
      console.log('url='+url+',more='+json.data.hasmore+',st='+json.data.st);
    }
    newsList.forEach(function(newsEntry) {
      if(!newsEntry.title) {
        return;
      }
      //console.log("hzfdbg file[" + __filename + "]" + " crawlerNewsCategory():title="+newsEntry.title);
      for(var i = 0; i < baiduNewsTags.length; i++) {
        try {
          if (newsEntry.title.indexOf(baiduNewsTags[i]) !== -1) {
            //console.log("hzfdbg file[" + __filename + "]" + " crawlerNewsCategory():title="+newsEntry.title);
            newsEntry.tagName = baiduNewsTags[i];
    
            News.findOne(genFindCmd(site,newsEntry.nid), function(err, result) {
              if(err) {
                console.log("hzfdbg file[" + __filename + "]" + " crawlerNewsCategory(), News.findOne():error " + err);
                return;
              }
              if (!result) {
                console.log("hzfdbg file[" + __filename + "]" + " crawlerNewsCategory():["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.nid);
                newsAdd(newsEntry);
              }
            }); // News.findOne
          }
        }
        catch (e) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerNewsCategory(): catch error");
          console.log(e);
          continue;
        }
      }//for
    });//forEach
  });//request
};

var baiduImageCrawler = function() {
  imageCategorys.forEach(function(entry) {
    crawlerImageCategory(entry);
  });//forEach

  setTimeout(baiduImageCrawler, 1000 * 60 * 60 * 8);
}

var baiduNewsCrawler = function() {
  newsCategorys.forEach(function(entry) {
    crawlerNewsCategory(entry);
  });//forEach

  setTimeout(baiduNewsCrawler, 1000 * 60 * 60);
}

var baiduCrawler = function() {
  console.log("hzfdbg file[" + __filename + "]" + " baiduCrawler():Start time="+new Date());

  baiduNewsCrawler();
  //baiduImageCrawler();
}

exports.baiduCrawler = baiduCrawler;
baiduCrawler();