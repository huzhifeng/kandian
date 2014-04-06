var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var News = require('../models/news');
var utils = require('../lib/utils');
var genLazyLoadHtml = utils.genLazyLoadHtml;
var genJwPlayerEmbedCode = utils.genJwPlayerEmbedCode;
var genFindCmd = utils.genFindCmd;
var encodeDocID = utils.encodeDocID;
var data2Json = utils.data2Json;
var genDigest = utils.genDigest;
var findTagName = utils.findTagName;
var moment = require('moment');
var crawlFlag = require('config').Config.crawlFlag;

var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': 'MI_2__sinanews__4.0.1__android__os4.1.1',
  'Host': 'api.sina.cn',
  'Connection': 'Keep-Alive',
};
var site = "sina";
var sinaSubscribes = [
  {
    tname:'头条',
    tid:'news_toutiao',
    tags:[
      '新观察', // 2014-02-12 停止更新
      '万花筒', // 2013-08-15 停止更新
      '新历史', // 2014-01-18 停止更新
      '今日网言', // 2013-12-13 停止更新
      '海外观察', // 2014-01-31 停止更新
      '军情茶馆', // 2013-06-21 停止更新
      '每日深度', // 2013-12-19 停止更新
      '一周八卦', // 2014-01-12 停止更新
      '茶娱饭后',
      '新闻早点',
    ]
  },
  // 新浪订阅管理 // 2014-02-21 停止更新
  {
    tname:'搞笑',
    tid:'news_funny',
    tags:[
      '神最右',
      '囧哥说事',
      '囧哥囧事', // 2013-12-27 停止更新
      '图哥乐呵',
      '一日一囧',
      '奇趣壹周', // 2014-02-07 停止更新
      '段子PK秀',
      '新闻乐轻松', // 2014-03-07 停止更新
      '毒舌美少女',
      '周末乐不停',
    ]
  },
  //{tname:'数码', tid:'news_digital', tags:[]},
  //{tname:'时尚', tid:'news_fashion', tags:[]},
  //{tname:'星座', tid:'news_ast', tags:[]},
  //{tname:'历史', tid:'news_history', tags:[]},
  //{tname:'女性', tid:'news_eladies', tags:[]},
  //{tname:'科技', tid:'news_tech', tags:[]},
  //{tname:'体育', tid:'news_sports', tags:[]},
  //{tname:'财经', tid:'news_finance', tags:[]},
  //{tname:'娱乐', tid:'news_ent', tags:[]},
  //{tname:'军事', tid:'news_mil', tags:[]},
  //{tname:'专栏', tid:'zhuanlan_recommend', tags:[]},
  // 新浪图片
  {tname:'图片.精选', tid:'hdpic_toutiao', tags:[]},
  {tname:'图片.趣图', tid:'hdpic_funny', tags:[]},
  {tname:'图片.美图', tid:'hdpic_pretty', tags:[]},
  {tname:'图片.故事', tid:'hdpic_story', tags:[]},
  // 新浪视频
  //{tname:'视频.精选', tid:'video_video', tags:[]},
  //{tname:'视频.搞笑', tid:'video_funny', tags:[]}, // TODO 自2014-02-10起, 视频地址跳转多次导致JwPlayer无法播放
  //{tname:'视频.现场', tid:'video_scene', tags:[]},
  //{tname:'视频.花絮', tid:'video_highlight', tags:[]},
];

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

var getNewsDetail = function(entry) {
  // http://api.sina.cn/sinago/article.json?id=124-10568626-news-cms&postt=news_news_toutiao_36&wm=b207&from=6037095012&chwm=5062_0058&oldchwm=5062_0058&imei=&uid=27ad58fc698efcc1
  var detailLink = 'http://api.sina.cn/sinago/article.json?id=%s';
  var docid = util.format("%s",entry.id);
  var url = util.format(detailLink, docid);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json || !json.data || (json.status == '-1')) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():JSON.parse() error");
      return;
    }
    var jObj = json.data;
    var obj = entry;

    News.findOne(genFindCmd(site, docid), function(err, result) {
      if(err || result) {
        return;
      }
      obj.docid = encodeDocID(site, docid);
      obj.site = site;
      obj.body = jObj.content;
      obj.img = [];
      if(jObj.pics) {
        var i = 0;
        var html = '';
        for(i=0; i<jObj.pics.length; i++) {
          jObj.pics[i].pic = jObj.pics[i].pic.replace(/auto\.jpg/, "original.jpg");
          html = genLazyLoadHtml(jObj.pics[i].alt, jObj.pics[i].pic) + jObj.pics[i].alt + '<br/>';
          obj.body = obj.body.replace(util.format("<!--{IMG_%d}-->", i+1), html);
          obj.img[obj.img.length] = jObj.pics[i].pic;
        }
      }
      if(jObj.videos) {
        var i = 0;
        var html = '';
        for(i=0; i<jObj.videos.length; i++) {
          jObj.videos[i].pic = jObj.videos[i].pic.replace(/auto\.jpg/, "original.jpg");
          html += util.format('<a href="%s" target="_blank">%s</a><br/>', jObj.videos[i].url, jObj.long_title);
          html += genJwPlayerEmbedCode(util.format("vid_%s", jObj.videos[i].video_id), jObj.videos[i].url, jObj.videos[i].pic, i===0);
          obj.body = obj.body.replace(util.format("<!--{VIDEO_%d}-->", i+1), html);
          obj.img[obj.img.length] = jObj.videos[i].pic;
        }
      }
      obj.link = "";
      if(jObj.link) {
        obj.link = jObj.link; // http://news.sina.cn/?sa=t124d8940595v2357
      }else if(entry.link) {
        obj.link = entry.link; // http://news.sina.cn/?sa=d8940595t124v71
      }else {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), link null");
      }
      obj.title = entry.title;
      obj.time = parseInt(jObj.pubDate) * 1000; // 1390574527 * 1000
      obj.ptime = moment(obj.time).format('YYYY-MM-DD HH:mm:ss');
      obj.marked = obj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.digest = genDigest(obj.body);
      obj.cover = entry.pic;
      if (!entry.pic && obj.img[0]) {
        obj.cover = obj.img[0].url;
      }

      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():["+obj.tags+"]"+obj.title+",docid="+obj.docid);
      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
        }
      }); // News.insert
    }); // News.findOne
  }); // request
};

var crawlerSubscribe = function (entry) {
  // http://api.sina.cn/sinago/list.json?channel=news_toutiao&p=1
  var url = util.format('http://api.sina.cn/sinago/list.json?channel=%s&p=%d', entry.tid, entry.page);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json || !json.data || !json.data.list) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():JSON.parse() error");
      return;
    }
    var newsList = json.data.list;
    if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():newsList empty in url " + url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if(!newsEntry.title || !newsEntry.id) {
        return;
      }
      newsEntry.tagName = findTagName(newsEntry.title, entry) || findTagName(newsEntry.long_title, entry);
      if(!newsEntry.tagName) {
        return;
      }
      News.findOne(genFindCmd(site, newsEntry.id), function(err, result) {
        if(err || result) {
          return;
        }
        startGetDetail.emit('startGetNewsDetail', newsEntry);
      }); // News.findOne
    });//forEach
    if(entry.crawlFlag) {
      if(newsList.length > 1) {
        entry.page += 1;
        console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():["+entry.tname+"] next page="+entry.page);
        setTimeout(function() {
          crawlerSubscribe(entry);
        }, 3000); // crawl next page after 3 seconds
      }else {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():["+entry.tname+"] last page");
        entry.crawlFlag = 0;
      }
    }
  });//request
};

var crawlerSinaSubscribes = function () {
  sinaSubscribes.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    entry.page = 1;
    crawlerSubscribe(entry);
  });
}

var sinaCrawler = function() {
  console.log('Start sinaCrawler() at ' + new Date());
  crawlerSinaSubscribes();
  setTimeout(sinaCrawler, 4000 * 60 * 60);
}

var crawlerInit = function() {
  if(process.argv[2] == 1) {
    crawlFlag = 1;
  }
  sinaSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
}

exports.sinaCrawler = sinaCrawler;
exports.sinaTags = sinaSubscribes;
crawlerInit();
sinaCrawler();