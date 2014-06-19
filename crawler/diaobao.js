var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var News = require('../models/news');
var utils = require('../lib/utils');
var genFindCmd = utils.genFindCmd;
var encodeDocID = utils.encodeDocID;
var data2Json = utils.data2Json;
var findTagName = utils.findTagName;
var moment = require('moment');
var crawlFlag = require('config').Config.crawlFlag;

var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': 'Apache-HttpClient/UNAVAILABLE (java 1.4)',
  'Host': 'api.diaobao.in',
  'Connection': 'Keep-Alive',
};
var site = "diaobao";
var diaobaoSubscribes = [
  // 宅推荐 http://api.diaobao.in/index.php/community/index/all_info?uid=0&community_type=1
  // 腐推荐 http://api.diaobao.in/index.php/community/index/all_info?uid=0&community_type=2
  // 癖推荐 http://api.diaobao.in/index.php/community/index/all_info?uid=0&community_type=3
  {tname:'人性实验', tid:'78207', tags:[]},
  // 欲推荐 http://api.diaobao.in/index.php/community/index/all_info?uid=0&community_type=4
  // 乐推荐 http://api.diaobao.in/index.php/community/index/all_info?uid=0&community_type=5
  // 囧图圈
  // http://api.diaobao.in/index.php/community/content/index?&size=10&id=1000040
  // http://api.diaobao.in/index.php/community/content/index?last=1402712667-1168217-2&size=10&id=1000040
  {tname:'每日囧图', tid:'16', tags:[]},
  {tname:'碉民早爆', tid:'5', tags:[]},
  {tname:'每日一撸', tid:'8', tags:[]},
  {tname:'十万个冷知识', tid:'9', tags:[]},
  {tname:'帅哥暖床图', tid:'139', tags:[]},
  {tname:'碉堡微小说', tid:'140', tags:[]},
];

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

var getNewsDetail = function(entry) {
  // http://api.diaobao.in/index.php/post/view/1168191?uid=0&scroll-src=1
  var docid = util.format("%s",entry.id);
  var url = util.format('http://api.diaobao.in/index.php/post/view/%s?uid=0&scroll-src=1', docid);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body.slice(1));  // 正文前三个字节 EF BB BF 应该是干扰码, slice(1) 忽略即可
    if(!json || !json.data || (json.status != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():JSON.parse() error");
      return;
    }
    var jObj = json.data.detail;
    var obj = {};

    News.findOne(genFindCmd(site, docid), function(err, result) {
      if(err || result) {
        return;
      }
      obj.docid = encodeDocID(site, docid);
      obj.site = site;
      obj.body = jObj.content.replace(/scroll-src/g, 'src'); // 暂时不做 LazyLoad
      obj.link = "";
      if(jObj.articleUrl) {
        obj.link = jObj.articleUrl; // http://api.diaobao.in/index.php/post/v/1168191
      }else if(entry.shareUrl) {
        obj.link = entry.shareUrl; // http://api.diaobao.in/index.php/post/v/1168191
      }else {
        obj.link = util.format('http://api.diaobao.in/index.php/post/v/%s', docid);
      }
      obj.title = entry.title;
      obj.time = parseInt(entry.publish_time) * 1000; // 1402711858 * 1000
      obj.ptime = moment(obj.time).format('YYYY-MM-DD HH:mm:ss');
      obj.marked = obj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.digest = jObj.des.slice(0,300);
      obj.cover = '';
      if (entry.images && (entry.images.length > 0) && entry.images[0].imgUrl) {
        obj.cover = entry.images[0].imgUrl;
      }
      else if (jObj.images && (jObj.images.length > 0)  && jObj.images[0].imgUrl) {
        obj.cover = jObj.images[0].imgUrl;
      }

      if (!obj.marked && !obj.digest) {
        console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():["+obj.tags+"]"+obj.title+",no content and digest");
        return;
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
  // http://api.diaobao.in/index.php/topic/articles?topic_id=5&begin=0&size=20&access_token=f9f4f05d1fb4d556ba8b6d75fa1b721f
  var url = util.format('http://api.diaobao.in/index.php/topic/articles?topic_id=%s&begin=%d&size=%d&access_token=f9f4f05d1fb4d556ba8b6d75fa1b721f', entry.tid, entry.page * entry.pageSize, entry.pageSize);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body.slice(1)); // 正文前三个字节 EF BB BF 应该是干扰码, slice(1) 忽略即可
    if(!json || !json.data || (json.status != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():JSON.parse() error");
      return;
    }
    var newsList = json.data;
    if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():newsList empty in url " + url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if(!newsEntry.title || !newsEntry.id) {
        return;
      }
      newsEntry.tagName = findTagName(newsEntry.title, entry);
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
      if(newsList.length == entry.pageSize) {
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

var crawlerDiaobaoSubscribes = function () {
  diaobaoSubscribes.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    entry.page = 0;
    entry.pageSize = 20;
    crawlerSubscribe(entry);
  });
}

var diaobaoCrawler = function() {
  console.log('Start diaobaoCrawler() at ' + new Date());
  crawlerDiaobaoSubscribes();
  setTimeout(diaobaoCrawler, 4000 * 60 * 60);
}

var crawlerInit = function() {
  if(process.argv[2] == 1) {
    crawlFlag = 1;
  }
  diaobaoSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
}

exports.diaobaoCrawler = diaobaoCrawler;
exports.diaobaoTags = diaobaoSubscribes;
crawlerInit();
diaobaoCrawler();
