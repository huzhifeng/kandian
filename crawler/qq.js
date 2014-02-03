var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var News = require('../models/news');
var utils = require('../lib/utils')
var genLazyLoadHtml = utils.genLazyLoadHtml;
var genFindCmd = utils.genFindCmd;
var encodeDocID = utils.encodeDocID;
var data2Json = utils.data2Json;
var genDigest = utils.genDigest;
var findTagName = utils.findTagName;
var crawlFlag = require('config').Config.crawlFlag;

var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': '%E8%85%BE%E8%AE%AF%E6%96%B0%E9%97%BB330(android)',
  'Host': 'r.inews.qq.com',
  'Connection': 'Keep-Alive',
};
var site = "qq";
var qqSubscribes = [
  //{tname:'要闻', tid:'news_news_top', tags:['娱乐午报', '留声机', '西洋镜', '问编辑', '新闻周考', '猜新闻', '数据控', '视界', '新闻当事人']},
  //{tname:'科技', tid:'news_news_tech', tags:[]},
  //{tname:'社会', tid:'news_news_ssh', tags:[]},
  //{tname:'娱乐', tid:'news_news_ent', tags:[]},
  //{tname:'军事', tid:'news_news_mil', tags:[]},
  //{tname:'文化', tid:'news_news_cul', tags:[]},
  //{tname:'时尚', tid:'news_news_lad', tags:[]},
  //腾讯原创栏目
  {tname:'新闻晚8点', tid:'94', tags:[]},
  {tname:'新闻哥', tid:'1033', tags:[]},
  {tname:'短史记', tid:'1783', tags:[]},
  {tname:'今日话题', tid:'41', tags:[]},
  {tname:'新闻百科', tid:'39', tags:[]},
  {tname:'讲武堂', tid:'47', tags:[]},
  {tname:'活着', tid:'35', tags:[]},
  {tname:'科技不怕问', tid:'1597', tags:[]},
  {tname:'TMT解码', tid:'1780', tags:[]},
  {tname:'启示录', tid:'1779', tags:[]},
  {tname:'所谓娱乐', tid:'1451', tags:[]},
  {tname:'娱乐钢牙哥', tid:'1039', tags:['钢牙八卦']},
  {tname:'凡人观时尚', tid:'1804', tags:[]},
  {tname:'图话', tid:'55', tags:[]},
  {tname:'存照', tid:'49', tags:[]},
  {tname:'中国人的一天', tid:'37', tags:[]},
  {tname:'天天看', tid:'44', tags:[]}, // Video
  {tname:'腾讯大家', tid:'45', tags:[]},
  {tname:'腾讯精品课', tid:'1432', tags:[]}, // Video
  {tname:'腾讯育儿宝典', tid:'1328', tags:[]},
];
var otherSubscribes = [
  {tname:'贵圈', tid:'32', tags:[]},
  {tname:'封面人物', tid:'33', tags:[]},
  {tname:'娱乐底片', tid:'34', tags:['娱乐底片', '底片']},
  //{tname:'名家', tid:'51', tags:['名家']},
  //{tname:'图片报告', tid:'53', tags:['图片报告']},
  {tname:'财经眼', tid:'54', tags:[]}, // Video
  {tname:'金错刀', tid:'1032', tags:['每日一干', '独家干', '病毒一干', '干案例', '干调查', '周末一湿']},
  //{tname:'喷嚏图卦', tid:'1081', tags:['喷嚏图卦']},
  {tname:'虎扑体育网', tid:'1182', tags:['虎扑健身', '虎扑翻译团']},
  {tname:'香港凤凰周刊', tid:'1154', tags:['历史档', '奇闻录', '周刊速读', '新刊速读']},
  {tname:'夜夜谈', tid:'1212', tags:[]}, // Video
  {tname:'微博搞笑', tid:'1240', tags:[]},
  //{tname:'冷兔', tid:'1250', tags:[]}, // Refer to netease
  //{tname:'我们爱讲冷笑话', tid:'1251', tags:[]}, // Refer to netease
  {tname:'封面秀', tid:'1310', tags:['封面秀']}, // 图片防盗链
  {tname:'洋葱新闻', tid:'1344', tags:['洋葱新闻']},
  {tname:'趣你的', tid:'1354', tags:[]},
  {tname:'骂人宝典', tid:'1338', tags:[]},
  {tname:'M老头', tid:'1410', tags:[]},
  {tname:'冷知识', tid:'1478', tags:[]},
  //{tname:'冷笑话精选', tid:'1503', tags:[]}, // Refer to netease
  {tname:'每周一品', tid:'1708', tags:[]},
  {tname:'健康每一天', tid:'1252', tags:[]}, // Video
  {tname:'捧腹网', tid:'1796', tags:[]},
  //{tname:'妹子图', tid:'1727', tags:[]},
  {tname:'哈爸哼妈', tid:'1389', tags:[]},
  {tname:'时尚有意思', tid:'1312', tags:[]}, // Video
  {tname:'恋爱高手', tid:'1480', tags:[]}, // Video
  {tname:'V+视频', tid:'1811', tags:[]}, // Video
  {tname:'网络新闻联播', tid:'1681', tags:[]},
  {tname:'笑来了大姨夫', tid:'1373', tags:[]}, // Video
  {tname:'生活家', tid:'1386', tags:[]}, // Video
  {tname:'吃货大本营', tid:'1401', tags:[]}, // Video
  {tname:'家有萌宝', tid:'1268', tags:[]}, // Video
  {tname:'推软妹', tid:'1365', tags:[]},
];
var photoTags = [
  {tname:'精选', tid:'news_photo', tags:['一周', '脸谱', '去年今日', '影像记忆', '春运', '图刊', '年度', '盘点']},
  {tname:'娱乐', tid:'news_photo_yl', tags:['底片', '趣图', '娱图', '一周', ]},
  //{tname:'美女', tid:'news_photo_mn', tags:[]},
  //{tname:'奇趣', tid:'news_photo_qiqu', tags:['盘点']},
  //{tname:'摄影', tid:'news_photo_sy', tags:[]},
];

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetDetail', function (entry) {
  getDetail(entry);
});

var genVideoPlayerHtml = function(vid) {
  // swf播放器地址
  // http://static.video.qq.com/TPout.swf?auto=1&vid=y0013oow0k2
  // html代码
  // <embed src="http://static.video.qq.com/TPout.swf?auto=1&vid=y0013oow0k2" quality="high" width="460" height="372" align="middle" allowScriptAccess="sameDomain" allowFullscreen="true" type="application/x-shockwave-flash"></embed>
  // 页面地址
  // http://v.qq.com/page/y/k/2/y0013oow0k2.html
  var html = '';
  html = util.format('<p><embed src="http://static.video.qq.com/TPout.swf?auto=1&vid=%s" quality="high" width="460" height="372" align="middle" allowScriptAccess="sameDomain" allowFullscreen="true" type="application/x-shockwave-flash"></embed></p>', vid);
  html += util.format('</br><a href="http://v.qq.com/page/y/k/2/%s.html" target="_blank">传送门</a></br>', vid);

  return html;
}

var getDetail = function(entry) {
  // http://r.inews.qq.com/getSubNewsContent?id=20131129A000H600&qqnetwork=wifi&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&apptype=android&appver=16_android_3.2.1
  var subscribeNewsDetailLink = 'http://r.inews.qq.com/getSubNewsContent?id=%s&qqnetwork=wifi&qn-rid=515897579&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&qn-sig=6839f4724164cda53c18d93f882ca729&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&imsi=460001112558692&apptype=android&appver=16_android_3.3.0';
  var docid = util.format("%s",entry.id);
  var url = util.format(subscribeNewsDetailLink, docid);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if((!json) || (json.ret != 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " getDetail():ret="+json.ret);
      return;
    }
    var jObj = json;
    var obj = entry;

    News.findOne(genFindCmd(site, entry.id), function(err, result) {
      if(err || result) {
        return;
      }
      obj.docid = encodeDocID(site, docid);
      obj.site = site;
      obj.body = jObj.content.text;
      obj.body = obj.body.replace(/<!--H2-->/g, '<H4>')
      obj.body = obj.body.replace(/<!--\/H2-->/g, '</H4>')
      obj.img = [];
      for(key in jObj.attribute) {
        var url = jObj.attribute[key].url || jObj.attribute[key].img;
        var html = '';
        if(key.indexOf('VIDEO') !== -1) {
          if(jObj.attribute[key].vid) {
            html = genVideoPlayerHtml(jObj.attribute[key].vid);
          }
        }else if(key.indexOf('IMG') !== -1) {
          html = genLazyLoadHtml(entry.title, url);
        }else {
          continue;
        }
        if(jObj.attribute[key].desc) {
          html = html + jObj.attribute[key].desc + '<br/>';
        }
        obj.img[obj.img.length] = url;
        obj.body = obj.body.replace(util.format('<!--%s-->', key), html);
      }
      obj.link = '';
      if(entry.url) {
        obj.link = entry.url;
      }else if(jObj.url) {
        obj.link = jObj.url;
      }else if(jObj.surl) {
        obj.link = jObj.surl;
      }else {
        obj.link = util.format("http://view.inews.qq.com/a/%s", entry.id);
      }
      obj.title = entry.title;
      obj.ptime = entry.time; // 2014-01-16 19:38:01
      obj.time = Date.parse(obj.ptime); // 1389872281000
      obj.marked = obj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.digest = genDigest(obj.body);
      obj.cover = '';
      if(entry.thumbnails && entry.thumbnails[0]) {
        obj.cover = entry.thumbnails[0];
      }else if(entry.thumbnails_big && entry.thumbnails_big[0]) {
        obj.cover = entry.thumbnails_big[0];
      }else if(entry.thumbnails_qqnews && entry.thumbnails_qqnews[0]) {
        obj.cover = entry.thumbnails_qqnews[0];
      }else if(entry.thumbnails_qqnews_photo && entry.thumbnails_qqnews_photo[0]) {
        obj.cover = entry.thumbnails_qqnews_photo[0];
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

      console.log("hzfdbg file[" + __filename + "]" + " getDetail():["+obj.tags+"]"+obj.title+",docid="+obj.docid);
      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getDetail(), News.insert():error " + err);
        }
      });
    });//News.findOne
  });//request
};

var crawlerSubscribe = function(entry) {
  var subscribeNewsIdsLink = 'http://r.inews.qq.com/getSubNewsIndex?qqnetwork=wifi&qn-rid=252257119&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&qn-sig=92be51a75e268df43aef4e7e1655a9f9&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&imsi=460001112558692&format=json&apptype=android&chlid=%s&appver=16_android_3.3.0';
  var subscribeNewsListLink = 'http://r.inews.qq.com/getSubNewsListItems?uid=22c4d53a-7d52-4f50-9185-90a77c7b80b0&qqnetwork=wifi&qn-rid=1085800932&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=%s&qn-sig=bc391588cf2d4aa75e2042e90822ba84&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&imsi=460001112558692&apptype=android&appver=16_android_3.3.0';
  var headlineLink = 'http://r.inews.qq.com/getQQNewsIndexAndItems?qqnetwork=wifi&qn-rid=209000533&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&qn-sig=4b3cfbeb1d30f935de9630698c586cd5&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&imsi=460001112558692&apptype=android&chlid=%s&appver=16_android_3.3.0';
  var headLineListLink = 'http://r.inews.qq.com/getQQNewsListItems?qn-rid=264249064&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=%s&qn-sig=2a14884f2a0e3cc02625c26931d8db9c&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&chlid=news_news_top&appver=16_android_3.3.0&qqnetwork=wifi&imsi=460001112558692&apptype=android';
  var photoLink = 'http://r.inews.qq.com/getQQNewsIndexAndItems?qqnetwork=wifi&qn-rid=359104299&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&qn-sig=92f5abdb0bf6ec98be397408639c3276&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&imsi=460001112558692&apptype=android&chlid=%s&appver=16_android_3.3.0';
  var photoListLink = 'http://r.inews.qq.com/getQQNewsListItems?qn-rid=125777722&store=118&hw=Xiaomi_MI2&devid=1366805394774330052&ids=%s&qn-sig=2fe55dd0f7d003bb1b8104dc0372130a&screen_width=720&mac=c4%253A6a%253Ab7%253Ade%253A4d%253A24&chlid=news_photo&appver=16_android_3.3.0&qqnetwork=wifi&imsi=460001112558692&apptype=android';

  var url = '';
  if(entry.ids && entry.ids.length) {
    var num = 20 < entry.ids.length ? 20 : entry.ids.length;
    var ids = '';
    var i = 0;
    for(i=0; i<num; i++) {
      if(i > 0) {
        ids = ids + ','
      }
      ids = ids + entry.ids[i].id;
    }
    if(entry.tid.indexOf('news_news') !== -1) {
      url = util.format(headLineListLink, ids);
    }else if(entry.tid.indexOf('news_photo') !== -1) {
      url = util.format(photoListLink, ids);
    }else {
      url = util.format(subscribeNewsListLink, ids);
    }
  }else {
    if(entry.tid.indexOf('news_news') !== -1) {
      url = util.format(headlineLink, entry.tid);
    }else if(entry.tid.indexOf('news_photo') !== -1) {
      url = util.format(photoLink, entry.tid);
    }else {
      url = util.format(subscribeNewsIdsLink, entry.tid);
    }
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
    var newsList = json.newslist || json.idlist[0].newslist;
    if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():newsList empty in url " + url);
      return;
    }

    if(entry.ids && entry.ids.length) {
      var num = 20 < entry.ids.length ? 20 : entry.ids.length;
      entry.ids = entry.ids.slice(num);
      if(entry.ids.length) {
        setTimeout(function() {
          crawlerSubscribe(entry);
        }, 100);
      }
    }else if(entry.crawlFlag) {
      entry.crawlFlag = 0;
      if(json.ids && json.ids.length) {
        entry.ids = json.ids;
      }else if(json.idlist && json.idlist.length && json.idlist[0].ids && json.idlist[0].ids.length) {
        entry.ids = json.idlist[0].ids;
      }else {
        return;
      }
      setTimeout(function() {
        crawlerSubscribe(entry);
      }, 100);
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
      News.findOne(genFindCmd(site,newsEntry.id), function(err, result) {
        if(err || result) {
          return;
        }
        startGetDetail.emit('startGetDetail', newsEntry);
      }); // News.findOne
    });//forEach
  });//request
}

var crawlerQqSubscribes = function () {
  qqSubscribes.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    crawlerSubscribe(entry);
  });
}

var crawlerOtherSubscribes = function () {
  otherSubscribes.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    crawlerSubscribe(entry);
  });
}

var crawlerPhotos = function () {
  photoTags.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    crawlerSubscribe(entry);
  });
}

var qqCrawler = function() {
  console.log('Start qqCrawler() at ' + new Date());
  crawlerQqSubscribes();
  crawlerOtherSubscribes();
  crawlerPhotos();
  setTimeout(qqCrawler, 4000 * 60 * 60);
}

var crawlerInit = function() {
  if(process.argv[2] == 1) {
    crawlFlag = 1;
  }
  qqSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
  otherSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
  photoTags.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
}

exports.qqCrawler = qqCrawler;
exports.qqTags = qqSubscribes.concat(otherSubscribes, photoTags);
crawlerInit();
qqCrawler();