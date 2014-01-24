var util = require('util');
var request = require('request');
var News = require('../models/news');
var utils = require('../lib/utils')
var genLazyLoadHtml = utils.genLazyLoadHtml;
var genFindCmd = utils.genFindCmd;
var encodeDocID = utils.encodeDocID;
var data2Json = utils.data2Json;
var genDigest = utils.genDigest;
var findTagName = utils.findTagName;
var moment = require('moment');
var crawlFlag = require('config').Config.crawlFlag; // 0: only one or few pages; 1: all pages

var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.1.1; MI 2 MIUI/JLB5.0)',
  'Connection': 'Keep-Alive',
  'Host': 'www.wumii.com',
};
var meizituSubscribes = [
  // 首页
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&ord=TIME_DESC
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&pageMark=1389837304000&ord=TIME_DESC
  {tname:'妹子图', tid:'1', tags:[]},
  // 今日热门
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&ord=HOT_DESC
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&pageMark=16&ord=HOT_DESC
  //{tname:'今日热门', tid:'2', tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=lRlNwXBT
  // 赤裸美体
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&ord=TIME_DESC&obCateId=DZT9477x
  //{tname:'赤裸美体', tid:'DZT9477x', tags:[]},
  // 喷血酥胸
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&ord=TIME_DESC&obCateId=4Q4VCwNc
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&pageMark=1366671844000&ord=TIME_DESC&obCateId=4Q4VCwNc
  //{tname:'喷血酥胸', tid:'4Q4VCwNc', tags:[]},
  // 细腰美腿
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&ord=TIME_DESC&obCateId=k4FzxUiV
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&pageMark=1368492743000&ord=TIME_DESC&obCateId=k4FzxUiV
  // 性感迷人
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&ord=TIME_DESC&obCateId=k6b4gfix
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&pageMark=1368492743000&ord=TIME_DESC&obCateId=k6b4gfix
  // 文艺小清新
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&ord=TIME_DESC&obCateId=beWc1Oxz
  // 可爱萌妹子
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&ord=TIME_DESC&obCateId=GthH6PBu
];

var meizicoSubscribes = [
  // 首页
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&ord=TIME_DESC
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&pageMark=1389319532394&ord=TIME_DESC
  {tname:'妹子控', tid:'1', tags:[]},
  // 今日热门
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&ord=HOT_DESC
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&pageMark=16&ord=HOT_DESC
  //{tname:'今日热门', tid:'2', tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=3NxAQlet
  // 人像摄影
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&ord=TIME_DESC&obCateId=5jcdQv34
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&pageMark=1383707160000&ord=TIME_DESC&obCateId=5jcdQv34
  //{tname:'人像摄影', tid:'5jcdQv34', tags:[]},
  // 性感美女
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&ord=TIME_DESC&obCateId=Q8HKvEE9
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&pageMark=1385951420000&ord=TIME_DESC&obCateId=Q8HKvEE9
  //{tname:'性感美女', tid:'Q8HKvEE9', tags:[]},
  // 私摄影
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&ord=TIME_DESC&obCateId=pmPSFneG
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&pageMark=1375602357000&ord=TIME_DESC&obCateId=pmPSFneG
  // 清纯妹子
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&ord=TIME_DESC&obCateId=a0X5mZbW
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&pageMark=1386469214000&ord=TIME_DESC&obCateId=a0X5mZbW
  // 萌妹子
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&ord=TIME_DESC&obCateId=czdwAHOY
  // 网络妹子
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&ord=TIME_DESC&obCateId=lRf6YPoG
  // 妹子语录
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&ord=TIME_DESC&obCateId=KPIfaMAy
  // 未分类
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&ord=TIME_DESC&obCateId=Y2WUdddM
  // 微女郎
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&ord=TIME_DESC&obCateId=ewa5UNb
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&pageMark=1370053846000&ord=TIME_DESC&obCateId=ewa5UNb
  // 淘女郎
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&ord=TIME_DESC&obCateId=oYU6BnyD
];

var crawlerSubscribe = function(entry) {
  var req = {uri: entry.url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json || !json.readerModule) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():JSON.parse() error");
      return;
    }
    var newsList = json.readerModule.itemInfos;
    if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():newsList empty in url " + entry.url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if(!newsEntry.item || !newsEntry.item.id || !newsEntry.item.metadata || !newsEntry.obBigImageIds) {
        return;
      }
      newsEntry.tagName = findTagName(newsEntry.item.metadata, entry);
      if(!newsEntry.tagName) {
        return;
      }
      News.findOne(genFindCmd(entry.site, newsEntry.item.id), function(err, result) {
        if(err || result) {
          return;
        }
        var obj = newsEntry;
        obj.docid = encodeDocID(entry.site, util.format("%s",newsEntry.item.id));
        obj.site = entry.site;
        obj.body = newsEntry.item.metadata;
        obj.img = newsEntry.thumbnailUrls;
        obj.link = "";
        if(newsEntry.item.name) {
          obj.link = newsEntry.item.name; // http://www.meizitu.com/a/3990.html
        }else {
          if(entry.site == 'meizitu') {
            obj.link = 'http://www.meizitu.com';
          }else {
            obj.link = 'http://www.meizico.com';
          }
        }
        obj.title = newsEntry.item.metadata;
        obj.time = parseInt(newsEntry.item.creationTime) * 1000; // 1390351233:0
        obj.ptime = moment(obj.time).format('YYYY-MM-DD HH:mm:ss'); // 2014-01-22 08:40:33
        obj.marked = obj.body;
        obj.created = new Date();
        obj.views = 1;
        obj.tags = newsEntry.tagName;
        obj.digest = genDigest(obj.body);
        if(newsEntry.item.thumbnailUrl) {
          obj.cover = newsEntry.item.thumbnailUrl;
        } else if (obj.img[0]) {
          obj.cover = obj.img[0];
        }

        // img lazyloading
        newsEntry.obBigImageIds.forEach(function (imgId) {
          var src = util.format("http://www.wumii.com/app/mobile/image/%s.tmw_720?i=%s", imgId, newsEntry.item.id);
          var imgHtml = genLazyLoadHtml(newsEntry.item.metadata, src);
          obj.marked += imgHtml;
        });

        console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():["+obj.tags+"]"+obj.title+",docid="+obj.docid);
        News.insert(obj, function (err, result) {
          if(err) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe(), News.insert():error " + err);
          }
        }); // News.insert
      }); // News.findOne
    });//forEach
    if(entry.crawlFlag) {
      if((newsList.length > 0) && (json.readerModule.nextPageMark != -1)) {
        if((entry.tid === '1') || (entry.tid === '2')) { // 首页 or 今日热图
          entry.url = util.format("http://www.wumii.com/app/mobile/auto/site/items?obSiteId=%s&pageMark=%s&ord=%s", entry.obSiteId, json.readerModule.nextPageMark, entry.ord);
        }else {
          entry.url = util.format('http://www.wumii.com/app/mobile/auto/site/items?obSiteId=%s&pageMark=%s&ord=%s&obCateId=%s', entry.obSiteId, json.readerModule.nextPageMark, entry.ord, entry.tid);
        }
        console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe(): next page="+entry.url);
        setTimeout(function() {
          crawlerSubscribe(entry);
        }, 3000); // crawl next page after 3 seconds
      }else {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe(): last page");
        entry.crawlFlag = 0;
      }
    }
  });//request
}

var crawlerWumiiSubscribes = function() {
  var subscribes = meizituSubscribes.concat(meizicoSubscribes);
  subscribes.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    if((entry.tid === '1') || (entry.tid === '2')) { // 首页 or 今日热图
      entry.url = util.format('http://www.wumii.com/app/mobile/auto/site/items?obSiteId=%s&ord=%s', entry.obSiteId, entry.ord);
    }else {
      entry.url = util.format('http://www.wumii.com/app/mobile/auto/site/items?obSiteId=%s&ord=%s&obCateId=%s', entry.obSiteId, entry.ord, entry.tid);
    }
    crawlerSubscribe(entry);
  });//forEach
}

var crawlerInit = function() {
  meizituSubscribes.forEach(function(entry) {
    entry.obSiteId = 'lRlNwXBT';
    entry.site = 'meizitu'; // http://www.meizitu.com/
    entry.crawlFlag = crawlFlag;
    if(process.argv[2] == 1) {
      entry.crawlFlag = 1;
    }
    entry.ord = 'TIME_DESC';
    if(entry.tid === '2') { // 今日热图
      entry.ord = 'HOT_DESC';
    }
  });
  meizicoSubscribes.forEach(function(entry) {
    entry.obSiteId = '3NxAQlet';
    entry.site = 'meizico'; // http://www.meizico.com/
    entry.crawlFlag = crawlFlag;
    if(process.argv[2] == 1) {
      entry.crawlFlag = 1;
    }
    entry.ord = 'TIME_DESC';
    if(entry.tid === '2') { // 今日热图
      entry.ord = 'HOT_DESC';
    }
  });
}

var wumiiCrawler = function() {
  console.log('Start wumiiCrawler() at ' + new Date());
  crawlerWumiiSubscribes();
  setTimeout(wumiiCrawler, 12000 * 60 * 60);
}

exports.wumiiCrawler = wumiiCrawler;
exports.wumiiTags = meizituSubscribes.concat(meizicoSubscribes);
crawlerInit();
wumiiCrawler();