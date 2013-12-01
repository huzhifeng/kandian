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
var data2Json = require('./lib/utils').data2Json;
var genDigest = require('./lib/utils').genDigest;

var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': '~...260(android)',
  'Host': 'inews.qq.com',
  'Connection': 'Keep-Alive',
};
var site = "qq";

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

startGetDetail.on('startGetSubscribeNewsDetail', function (entry) {
  getSubscribeNewsDetail(entry);
});

startGetDetail.on('startGetPhotoDetail', function (entry) {
  getPhotoDetail(entry);
});

var getNewsDetail = function(entry) {
  var detailLink = 'http://inews.qq.com/getQQNewsNormalHtmlContent?id=%s';
  var docid = util.format("%s",entry.id);
  var url = util.format(detailLink, docid);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if((!json) || (json.ret != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():ret="+json.ret);
      return;
    }
    var jObj = json;
    var obj = entry;

    News.findOne(genQqFindCmd(site, entry), function(err, result) {
      if(err) {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.findOne():error " + err);
        return;
      }
      if (result) {
        //console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.findOne():exist ");
        return;
      }
      obj.docid = encodeDocID(site, docid);
      obj.site = site;
      obj.body = '';
      obj.img = [];
      jObj.content.forEach(function(item) {
        if(item.type == 1) { //text
          obj.body += item.value;
        }
        else if(item.type == 2) { //pic
          obj.body += genLazyLoadHtml(entry.tagName, item.value);
          obj.img[obj.img.length] = item.value;
        }
        else if(item.type == 3) { //video
          obj.body += genLazyLoadHtml(entry.tagName, item.value.img);
          obj.img[obj.img.length] = item.value.img;
        }
      });
      obj.video = [];
      obj.link = "";
      if(entry.url) {
        obj.link = entry.url; // http://view.inews.qq.com/a/NEW2013050300143202
      }else if(entry.surl) {
        obj.link = entry.surl; // http://view.inews.qq.com/a/NEW2013050300143202
      }else if(jObj.url) {
        obj.link = jObj.url; // http://view.inews.qq.com/a/NEW2013050300143202
      }else if(jObj.surl) {
        obj.link = jObj.surl; // http://view.inews.qq.com/a/NEW2013050300143202
      }else {
        obj.link = util.format("http://view.inews.qq.com/a/%s", docid);
      }
      obj.title = entry.title;
      obj.ptime = entry.time;
      obj.time = new Date(entry.time);
      obj.marked = obj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.digest = genDigest(obj.body);
      if(!obj.digest) {
        obj.digest = obj.body;
      }
      obj.cover = entry.thumbnails[0];
      if (obj.img[0]) {
        obj.cover = obj.img[0];
      }

      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
        }
      });
    });//News.findOne
  });//request
};

var getSubscribeNewsDetail = function(entry) {
  // http://r.inews.qq.com/getSubNewsContent?id=20131129A000H600&qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&appver=16_android_3.2.1
  var subscribeNewsDetailLink = 'http://r.inews.qq.com/getSubNewsContent?id=%s&qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&appver=16_android_3.2.1';
  var docid = util.format("%s",entry.id);
  var url = util.format(subscribeNewsDetailLink, docid);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if((!json) || (json.ret != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " getSubscribeNewsDetail():ret="+json.ret);
      return;
    }
    var jObj = json;
    var obj = entry;

    News.findOne(genQqFindCmd(site, entry), function(err, result) {
      if(err) {
        console.log("hzfdbg file[" + __filename + "]" + " getSubscribeNewsDetail(), News.findOne():error " + err);
        return;
      }
      if (result) {
        //console.log("hzfdbg file[" + __filename + "]" + " getSubscribeNewsDetail(), News.findOne():exist ");
        return;
      }
      obj.docid = encodeDocID(site, docid);
      obj.site = site;
      obj.body = jObj.content.text;
      obj.img = [];
      for(key in jObj.attribute) {
        var html = genLazyLoadHtml(entry.title, jObj.attribute[key].url);
        if(jObj.attribute[key].desc) {
          html = html + jObj.attribute[key].desc + '<br/>';
        }
        obj.img[obj.img.length] = jObj.attribute[key].url;
        obj.body = obj.body.replace(util.format('<!--%s-->', key), html);
      }
      obj.video = [];
      obj.link = '';
      if(entry.url) {
        obj.link = entry.url;
      }else {
        obj.link = util.format("http://view.inews.qq.com/a/%s", entry.id);
      }
      obj.title = entry.title;
      obj.ptime = entry.time;
      obj.time = new Date(entry.time);
      obj.marked = obj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.digest = genDigest(obj.body);
      obj.cover = '';
      if(entry.thumbnails_qqnews && entry.thumbnails_qqnews[0]) {
        obj.cover = entry.thumbnails_qqnews[0];
      }else if(entry.chlsicon) {
        obj.cover = entry.chlsicon;
      }else if(entry.chlicon) {
        obj.cover = entry.chlicon;
      }else if(jObj.card && jObj.card.icon) {
        obj.cover = jObj.card.icon;
      }else if(obj.img) {
        obj.cover = obj.img[0];
      }else {
        obj.cover = '';
      }

      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getSubscribeNewsDetail(), News.insert():error " + err);
        }
      });
    });//News.findOne
  });//request
};

var getPhotoDetail = function(entry) {
  // http://inews.qq.com/getQQNewsSimpleHtmlContent?id=PIC2013061200601000&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_photo&appver=16_android_2.7.0
  var photoDetailLink = "http://inews.qq.com/getQQNewsSimpleHtmlContent?id=%s&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_photo&appver=16_android_2.7.0";
  var docid = util.format("%s",entry.id);
  var url = util.format(photoDetailLink, docid);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if((!json) || (json.ret != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail():ret="+json.ret);
      return;
    }
    var jObj = json;
    var obj = entry;

    News.findOne(genQqFindCmd(site, entry), function(err, result) {
      if(err) {
        console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail(), News.findOne():error " + err);
        return;
      }
      if (result) {
        //console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail(), News.findOne():exist ");
        return;
      }
      obj.docid = encodeDocID(site, docid);
      obj.site = site;
      obj.body = jObj.intro + jObj.content.text;
      obj.img = [];
      var attribute = jObj.attribute;
      var img_keys = _.keys(attribute);
      img_keys.forEach(function(key){
        obj.img[obj.img.length] = attribute[key].url;
        var imgHtml = attribute[key].desc + genLazyLoadHtml(attribute[key].desc, attribute[key].url);
        obj.body = obj.body.replace("<!--" + key + "-->", imgHtml); // <!--IMG_4-->
      });
      obj.video = [];
      obj.link = "";
      if(entry.url) {
        obj.link = entry.url; // http://view.inews.qq.com/a/TPC2013061100203800
      }else if(entry.surl) {
        obj.link = entry.surl; // http://view.inews.qq.com/a/TPC2013061100203800
      }else if(jObj.url) {
        obj.link = jObj.url; // http://view.inews.qq.com/a/TPC2013061100203800
      }else if(jObj.surl) {
        obj.link = jObj.surl; // http://view.inews.qq.com/a/TPC2013061100203800
      }else {
        obj.link = util.format("http://view.inews.qq.com/a/%s", docid);
      }
      obj.title = entry.title;
      obj.ptime = entry.time;
      obj.time = new Date(entry.time);
      obj.marked = obj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.digest = genDigest(obj.body);
      obj.cover = entry.thumbnails[0];
      if (obj.img[0]) {
        obj.cover = obj.img[0];
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

  for(i=0; i<tags.length; i++) {
    if(qqTags[tags[i]].indexOf(tagType) === -1) {
      continue;
    }
    if (entry.title && (entry.title.indexOf(tags[i]) !== -1)) {
      return tags[i];
    }else if (entry.source && (entry.source.indexOf(tags[i]) !== -1)) {
      return tags[i];
    }else if (entry.abstract && (entry.abstract.indexOf(tags[i]) !== -1)) {
      return tags[i];
    }else if(entry.tag) {
      for(j=0; j<entry.tag.length; j++){
        if((entry.tag[j]) && (entry.tag[j].indexOf(tags[i]) !== -1)) {
          return tags[i];
        }
      } // for j=0
    }
  } // for i=0

  return "";
}

var crawlerHeadLine = function () {
  // 要闻 http://r.inews.qq.com/getQQNewsIndexAndItems?qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_news_top&appver=16_android_3.2.1
  // 要闻Next http://r.inews.qq.com/getQQNewsListItems?qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=NEW2013120100044901%2CNEW2013120100069303%2CNEW2013120100088800%2CNEW2013120100058703%2CNEW2013120100044800%2CNEW2013120100046501%2CNEW2013120100073602%2CNEW2013120100045700%2CNEW2013120100103704%2CNEW2013113000646602%2CNEW2013120100235601%2CNEW2013120100084100%2CNEW201311270116140Z%2CNEW2013120100059400%2CNEW2013113000661106%2CNEW2013120100035301%2CNEW2013120100043600%2CNEW2013120100026701%2CNEW2013120100032002%2CNEW2013120100043700&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_news_top&appver=16_android_3.2.1
  // 科技 http://r.inews.qq.com/getQQNewsIndexAndItems?qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_news_tech&appver=16_android_3.2.1
  // 社会 http://r.inews.qq.com/getQQNewsIndexAndItems?qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_news_ssh&appver=16_android_3.2.1
  // 娱乐 http://r.inews.qq.com/getQQNewsIndexAndItems?qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_news_ent&appver=16_android_3.2.1
  // 军事 http://r.inews.qq.com/getQQNewsIndexAndItems?qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_news_mil&appver=16_android_3.2.1
  var headlineLink = 'http://r.inews.qq.com/getQQNewsIndexAndItems?qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_news_top&appver=16_android_3.2.1';

  var url = headlineLink;
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json || (json.ret != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():JSON.parse() error");
      return;
    }
    var ids = json["idlist"][0]["ids"];
    var i = 0;
    ids.forEach(function(idsEntry) {
      var summaryUrl = util.format("http://inews.qq.com/getQQNewsListItems?store=118&ids=%s", idsEntry.id);
      var req = {uri: summaryUrl, method: "GET", headers: headers};
      if(proxyEnable) {
        req.proxy = proxyUrl;
      }
      request(req, function (err, res, body) {
        var summary_json = data2Json(err, res, body);
        if(!summary_json || (summary_json.ret != 0)) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():JSON.parse() summary_json error");
          return;
        }
        var newsList = summary_json["newslist"];
        if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():summaryUrl newsList empty in url " + summaryUrl);
          return;
        }
        var newsEntry =newsList[0];
        try {
          newsEntry.tagName = findTagInSummary(newsEntry, "qq_news");
          if (newsEntry.tagName) {
            News.findOne(genQqFindCmd(site, newsEntry), function(err, result) {
              if(err) {
                console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(), News.findOne():error " + err);
                return;
              }
              if (!result) {
                console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine():summaryUrl ["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.id);
                startGetDetail.emit('startGetNewsDetail', newsEntry);
              }
            }); // News.findOne
          }
        }
        catch (e) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerHeadLine(): catch error");
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
    var json = data2Json(err, res, body);
    if(!json || (json.ret != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():JSON.parse() error");
      return;
    }
    var ids = json["idlist"][0]["ids"];
    if((MAX_PAGE_NUM * NEWS_NUM_PER_PAGE) < ids.length) {
      ids = ids.slice(0,MAX_PAGE_NUM * NEWS_NUM_PER_PAGE)
    }
    ids.forEach(function(idsEntry) {
      // http://inews.qq.com/getQQNewsListItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=PIC2013061200601200&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_photo&appver=16_android_2.7.0
      var summaryUrl = util.format("http://inews.qq.com/getQQNewsListItems?store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=%s&screen_width=720&sceneid=00000&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&chlid=news_photo&appver=16_android_2.7.0", idsEntry.id);
      var req = {uri: summaryUrl, method: "GET", headers: headers};
      if(proxyEnable) {
        req.proxy = proxyUrl;
      }
      request(req, function (err, res, body) {
        var summary_json = data2Json(err, res, body);
        if(!summary_json || (summary_json.ret != 0)) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():JSON.parse() summary_json error");
          return;
        }
        var newsList = summary_json["newslist"];
        if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():summaryUrl newsList empty in url " + summaryUrl);
          return;
        }
        var newsEntry =newsList[0];
        try {
          newsEntry.tagName = findTagInSummary(newsEntry, "qq_photo");
          if (newsEntry.tagName) {
            News.findOne(genQqFindCmd(site, newsEntry), function(err, result) {
              if(err) {
                console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto(), News.findOne():error " + err);
                return;
              }
              if (!result) {
                console.log("hzfdbg file[" + __filename + "]" + " crawlerPhoto():summaryUrl ["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.id);
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

var mySubscribes = [
  //{name:'贵圈', id:'32', tags:['贵圈'], all:1},
  {name:'封面人物', id:'33', tags:['封面人物'], all:1},
  {name:'娱乐底片', id:'34', tags:['娱乐底片', '底片']},
  {name:'活着', id:'35', tags:['活着'], all:1},
  {name:'中国人的一天', id:'37', tags:['中国人的一天'], all:1},
  {name:'新闻百科', id:'39', tags:['新闻百科'], all:1},
  {name:'今日话题', id:'41', tags:['今日话题'], all:1},
  {name:'讲武堂', id:'47', tags:['讲武堂'], all:1},
  {name:'存照', id:'49', tags:['存照'], all:1},
  {name:'名家', id:'51', tags:['名家']},
  {name:'图片报告', id:'53', tags:['图片报告'], all:1},
  //{name:'财经眼', id:'54', tags:['财经眼'], all:1},
  {name:'图话', id:'55', tags:['图话'], all:1},
  {name:'新闻晚8点', id:'94', tags:['新闻晚8点'], all:1},
  {name:'金错刀', id:'1032', tags:['每日一干', '独家干', '病毒一干', '干案例', '干调查', '周末一湿']},
  {name:'新闻哥', id:'1033', tags:['新闻哥'], all:1},
  {name:'娱乐钢牙哥', id:'1039', tags:['钢牙八卦', '钢牙漫画', '钢牙答题']},
  {name:'喷嚏图卦', id:'1081', tags:['喷嚏图卦'], all:1},
  {name:'虎扑体育网', id:'1182', tags:['虎扑健身', '虎扑翻译团']},
  {name:'香港凤凰周刊', id:'1154', tags:['历史档', '奇闻录', '周刊速读']},
  //{name:'', id:'', tags:['']},
  {name:'夜夜谈', id:'1212', tags:['夜夜谈']},
  {name:'微博搞笑', id:'1240', tags:['微博搞笑'], all:1},
  {name:'冷兔', id:'1250', tags:['每日一冷']},
  {name:'我们爱讲冷笑话', id:'1251', tags:['我们爱讲冷笑话'], all:1},
  {name:'封面秀', id:'1310', tags:['封面秀'], all:1},
  {name:'洋葱新闻', id:'1344', tags:['洋葱新闻'], all:1},
  {name:'趣你的', id:'1354', tags:['趣你的'], all:1},
  {name:'骂人宝典', id:'1388', tags:['骂人宝典'], all:1},
  {name:'M老头', id:'1410', tags:['M老头'], all:1},
  {name:'冷知识', id:'1478', tags:['冷知识']},
  {name:'冷笑话精选', id:'1503', tags:['冷笑话精选'], all:1},
  {name:'每周一品', id:'1708', tags:['每周一品'], all:1},
];

var crawlerSubscribe = function(entry) {
  // 所有栏目列表 http://r.inews.qq.com/getCatList?qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&appver=16_android_3.2.1&version=0
  // 获取某一栏目文章ids http://r.inews.qq.com/getSubNewsIndex?qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&format=json&apptype=android&chlid=1250&appver=16_android_3.2.1
  // 获取指定ids文章 http://r.inews.qq.com/getSubNewsListItems?uid=22c4d53a-7d52-4f50-9185-90a77c7b80b0&qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=20131107A000D700%2C20131106A000DE00%2C20131106A000DD00%2C20131105A000DS00%2C20131105A000DR00%2C20131104A000CW00%2C20131101A000DZ00%2C20131031A000BZ00%2C20131030A000BV00%2C20131029A000C600%2C20131028A0017800%2C20131025A0019S00%2C20131024A000CG00%2C20131023A000CM00%2C20131022A000I400%2C20131022A000I300%2C20131022A0007700%2C20131018A000EB00%2C20131017A0015800%2C20131016A000AX00&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&appver=16_android_3.2.1
  // 获取某篇文章内容 http://r.inews.qq.com/getSubNewsContent?id=20131129A000H600&qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&appver=16_android_3.2.1
  var subscribeNewsIdsLink = 'http://r.inews.qq.com/getSubNewsIndex?qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&format=json&apptype=android&chlid=%s&appver=16_android_3.2.1';
  var subscribeNewsListLink = 'http://r.inews.qq.com/getSubNewsListItems?uid=22c4d53a-7d52-4f50-9185-90a77c7b80b0&qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=%s&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&appver=16_android_3.2.1'

  var url = '';
  if(entry.ids) {
    var ids = '';
    var i = 0;
    for(i=0; (i<20) && (i<entry.ids.length); i++) {
      if(i > 0) {
        ids = ids + ','
      }
      ids = ids + entry.ids[i].id;
    }
    url = util.format(subscribeNewsListLink, ids);
    entry.ids = entry.ids.slice(i);
  }else {
    url = util.format(subscribeNewsIdsLink, entry.id);
  }
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json || (json.ret != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():JSON.parse() error");
      return;
    }
    
    if(entry.ids) {
      setTimeout(function() {
        crawlerSubscribe(entry);
      }, 100);
    }else if(json.ids) {
      entry.ids = json.ids;
      setTimeout(function() {
        crawlerSubscribe(entry);
      }, 100);
    }
    var newsList = json.newslist;
    if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():newsList empty in url " + url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      //console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():title="+newsEntry.title);
      var tags = entry.tags;
      for(var i = 0; i < tags.length; i++) {
        try {
          if (newsEntry.title.indexOf(tags[i]) !== -1 || entry.all) {
            //console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():title="+newsEntry.title);
            newsEntry.tagName = tags[i];
            newsEntry.subscribeName = entry.name;

            News.findOne(genQqFindCmd(site,newsEntry), function(err, result) {
              if(err) {
                console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe(), News.findOne():error " + err);
                return;
              }
              if (!result) {
                console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.id);
                startGetDetail.emit('startGetSubscribeNewsDetail', newsEntry);
              }
            }); // News.findOne
            break;
          }
        }
        catch (e) {
          console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe(): catch error");
          console.log(e);
          continue;
        }
      }//for
    });//forEach
  });//request
}

var crawlerAllSubscribe = function() {
  mySubscribes.forEach(function(entry) {
    crawlerSubscribe(entry);
  });//forEach
}

var qqCrawler = function() {
  console.log("hzfdbg file[" + __filename + "]" + " qqCrawler():Date="+new Date());
  crawlerHeadLine();
  crawlerPhoto();
  crawlerAllSubscribe();
  setTimeout(qqCrawler, 4000 * 60 * 60);
}

exports.qqCrawler = qqCrawler;
qqCrawler();