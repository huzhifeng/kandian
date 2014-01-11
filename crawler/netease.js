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
var crawlFlag = require('config').Config.crawlFlag; // 0: only one or few pages; 1: all pages

var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': 'NTES Android',
  'Connection': 'Keep-Alive',
  'Host': 'c.m.163.com',
};
var site = "netease";
// http://c.m.163.com/nc/topicset/android/v3/subscribe.html
var neteaseSubscribes = [
  // 头条 // http://c.m.163.com/nc/article/headline/T1348647909107/0-20.html
  {tname:'头条', tid:'T1348647909107', tags:['新闻故事', '一周新闻日历']},
  // 原创
  {tname:'轻松一刻', tid:'T1350383429665', tags:[]},
  {tname:'另一面', tid:'T1348654756909', tags:[]},
  {tname:'今日之声', tid:'T1348654628034', tags:[]},
  {tname:'今日环球侃客', tid:'T1381482353221', tags:[]},
  {tname:'易百科', tid:'T1355887570398', tags:[]},
  {tname:'看客', tid:'T1387970173334', tags:[]},
  {tname:'微历史', tid:'T1376554225976', tags:[]},
  {tname:'科技万有瘾力', tid:'T1359605530115', tags:[], stopped:1}, // 2014-01-07 停止更新
  {tname:'一周军情观察', tid:'T1359613635637', tags:[], stopped:1}, // 专题 2014-01-07 停止更新
  {tname:'一周媒体速递', tid:'T1359605600543', tags:[], stopped:1}, // 2014-01-06 停止更新
  {tname:'娱乐BigBang', tid:'T1359605557219', tags:[]},
  {tname:'独家解读', tid:'T1348654778699', tags:[]},
  {tname:'历史七日谈', tid:'T1359605505216', tags:[], stopped:1}, // 2013-12-05 停止更新
  {tname:'数读', tid:'T1348654813857', tags:[]},
  {tname:'一周人物', tid:'T1385105962170', tags:[], stopped:1}, // 2014-01-07 停止更新
  {tname:'一周车坛囧事', tid:'T1382946585552', tags:[]},
  {tname:'视野', tid:'T1382946778301', tags:['视野'], stopped:1}, // 2013-11-27 停止更新
  {tname:'应用一勺烩', tid:'T1383187051764', tags:[], stopped:1}, // 2013-11-21 停止更新
  // 专栏
  {tname:'新闻杂谈', tid:'T1374655362262', tags:[]},
  {tname:'新闻漫画', tid:'T1374655548448', tags:[]},
  {tname:'军事控', tid:'T1374655601172', tags:[]},
  {tname:'读写客', tid:'T1374655641708', tags:[]},
  //{tname:'8点1氪', tid:'T1374655687362', tags:[]},
  {tname:'科学现场调查', tid:'T1374655737387', tags:[]},
  {tname:'读报', tid:'T1378876118770', tags:[]},
  {tname:'知乎日报', tid:'T1383207786512', tags:[]}, // 专题
  {tname:'每周观察', tid:'T1383207857966', tags:[]},
  //{tname:'隔洋观花', tid:'T1385106187014', tags:[]},
  {tname:'罗辑思维', tid:'T1385106069241', tags:[], stopped:1}, // 2013-11-17 停止更新
  {tname:'打铁记', tid:'T1383639452806', tags:[], stopped:1}, // 2013-11-22 停止更新
  {tname:'爱解析', tid:'T1383639904180', tags:[], stopped:1}, // 2013-12-13 停止更新
  //{tname:'亲历死亡', tid:'T1383640198969', tags:[], stopped:1}, // 2013-12-02 停止更新
  //{tname:'理中客', tid:'T1387349830515', tags:['真话讲堂']},
  //{tname:'大国小民', tid:'T1387350092857', tags:['大国小民']},
  //{tname:'热历史', tid:'T1387350254612', tags:[]},
  //{tname:'你醒醒吧', tid:'T1387350404473', tags:[]},
  //{tname:'亦捂亦拾', tid:'T1387352255521', tags:[]},
  //{tname:'没有回家的士兵', tid:'T1388049232720', tags:[]},
  // 频道
  //{tname:'网易深度', tid:'T1348648233485', tags:[]},
  //{tname:'网易探索', tid:'T1348648165458', tags:[]},
  //{tname:'网易评论', tid:'T1348648327573', tags:[]},
  //{tname:'网易明星', tid:'T1348648624173', tags:[]},
  //{tname:'网易电影', tid:'T1348648650048', tags:[]},
  //{tname:'网易电视', tid:'T1348648673314', tags:[]},
  //{tname:'网易音乐', tid:'T1348648696641', tags:['面对面']},
  //{tname:'网易时尚', tid:'T1348651069938', tags:[]},
  //{tname:'网易美容', tid:'T1348652387145', tags:[]},
];

var otherSubscribes = [
  // 报刊
  {tname:'南都娱乐周刊', tid:'T1374537739895', tags:['年度', '头条人物']},
  {tname:'凤凰周刊', tid:'T1374538012901', tags:[]},
  {tname:'壹读', tid:'T1380165047292', tags:['时政笔记', '壹读百科', '纯干货', '壹读姿势', '数据', '职觉', '边角料']},
  {tname:'商业价值', tid:'T1374538092965', tags:[]},
  {tname:'南方人物周刊', tid:'T1380165663024', tags:[]},
  {tname:'IT时代周刊', tid:'T1374537778882', tags:[]},
  {tname:'互联网周刊', tid:'T1374538770149', tags:[]},
  {tname:'城市画报', tid:'T1374539228305', tags:[]},
  // 资讯
  {tname:'一五一十部落', tid:'T1374480580631', tags:[]},
  {tname:'喷嚏网', tid:'T1380165278983', tags:[]},
  {tname:'没品新闻', tid:'T1380165400636', tags:[]},
  {tname:'麦格时光网', tid:'T1379312559214', tags:[]}, // all
  {tname:'坏新闻', tid:'T1383813385385', tags:[]}, // all
  // 漫画
  {tname:'冷兔', tid:'T1376989764224', tags:[]},
  {tname:'张小盒漫画', tid:'T1374654808952', tags:[]},
  {tname:'蔡志忠漫画', tid:'T1374655157113', tags:[]},
  {tname:'长颈鹿但丁', tid:'T1385975344862', tags:[]},
  {tname:'小破孩', tid:'T1385457660845', tags:[]},
  {tname:'暴走漫画', tid:'T1381825412501', tags:[]},
  {tname:'小丑出品', tid:'T1386300294647', tags:[]},
  {tname:'想太多的猪', tid:'T1374654037531', tags:[]},
  {tname:'罗罗布家族', tid:'T1385977225272', tags:[]},
  // 美女
  {tname:'游戏美女', tid:'T1374483001879', tags:[]},
  {tname:'妹子图', tid:'T1374482883888', tags:[]},
  {tname:'美媛馆', tid:'T1385719108476', tags:[]},
  {tname:'私の写真', tid:'T1383643220558', tags:[]},
  {tname:'Showgirl美女写真馆', tid:'T1383810777853', tags:[]},
  {tname:'天天诱惑·美女', tid:'T1383810866284', tags:[]},
  {tname:'美女·写真·艺术', tid:'T1383818365070', tags:[]},
  {tname:'咔嚓咔嚓', tid:'T1383818583837', tags:[]},
  {tname:'啊噜哈Aluha', tid:'T1388400299205', tags:[]},
  // 生活
  {tname:'煎蛋', tid:'T1374543275708', tags:[]},
  {tname:'惠惠购物锦囊', tid:'T1374543622922', tags:[]},
  {tname:'生活早参考', tid:'T1380447562863', tags:[]},
  {tname:'5TIME语录网', tid:'T1374544255040', tags:[]},
  // 人文
  {tname:'佳人', tid:'T1374488941509', tags:['插画心语']},
  {tname:'美文日赏', tid:'T1374488449712', tags:[]},
  // 历史
  {tname:'民国秘闻', tid:'T1383647115505', tags:[]},
  // 娱乐
  {tname:'我们爱讲冷笑话', tid:'T1376989923762', tags:[]},
  {tname:'如厕ing', tid:'T1374549843906', tags:[]},
  {tname:'糗事百科', tid:'T1374550407902', tags:[]},
  {tname:'笑话精选', tid:'T1374550232723', tags:[]},
  {tname:'冷笑话精选', tid:'T1381732564640', tags:[]},
  {tname:'有意思吧', tid:'T1380448203066', tags:[]},
  {tname:'挖段子冷笑话', tid:'T1376635837979', tags:[]},
  {tname:'涨姿势', tid:'T1376638549337', tags:[]},
  {tname:'爱重口味', tid:'T1376636972612', tags:[]},
  {tname:'掘图志', tid:'T1376637148182', tags:[]},
  {tname:'萝卜网', tid:'T1376637252500', tags:[]},
  {tname:'狂囧网', tid:'T1376637481760', tags:[]},
  {tname:'笑话幽默', tid:'T1376637720014', tags:[]},
  {tname:'鸸鹋动物园', tid:'T1376641060407', tags:[]},
  {tname:'来福岛', tid:'T1376641060418', tags:[]},
  {tname:'囧马热文', tid:'T1376642915530', tags:[]},
  {tname:'笑话集', tid:'T1376643082077', tags:[]},
  {tname:'乐不思蜀', tid:'T1376643174873', tags:[]},
  {tname:'多玩图库', tid:'T1376643423014', tags:[]},
  {tname:'笑话之家', tid:'T1376643747659', tags:[]},
  {tname:'掘精小娘子', tid:'T1383811813773', tags:[]},
  {tname:'剧情神展开', tid:'T1383811980965', tags:[]},
  {tname:'神回复', tid:'T1383817412975', tags:[]},
  {tname:'每日一乐', tid:'T1383817602040', tags:[]},
  {tname:'笑料百科', tid:'T1385541837579', tags:[]},
  {tname:'趣图百科', tid:'T1385542239547', tags:[]},
  {tname:'脑残对话', tid:'T1385542317968', tags:[]},
  {tname:'神吐槽', tid:'T1385542359888', tags:[]},
  // 视觉
  {tname:'猫舍', tid:'T1374483113516', tags:[]},
  // 未知分类
  {tname:'真话', tid:'T1370583240249', tags:[]},
  //{tname:'健康养生', tid:'T1370589182416', tags:[]},
  //{tname:'网易女人', tid:'T1364183816404', tags:[]},
  {tname:'每日钛度', tid:'T1366183190095', tags:[], stopped:1}, // 2013-06-20 停止更新
  {tname:'专业控', tid:'T1348654797196', tags:[], stopped:1}, // 2013-05-16 停止更新
];
var photoTags = [
  // http://c.m.163.com/photo/api/list/0096/54GI0096.json
  {tname:'热点', tid:'54GI0096', tags:['年度']},
  {tname:'独家图集', tid:'54GJ0096', tags:[]},
  //{tname:'明星', tid:'54GK0096', tags:[]},
  //{tname:'体坛', tid:'54GM0096', tags:[]},
  {tname:'精美', tid:'54GN0096', tags:['盘点', '一周外媒动物图片精选']},
];

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

startGetDetail.on('startGetPhotoDetail', function (entry) {
  getPhotoDetail(entry);
});

var getNewsDetail = function(entry) {
  // http://c.m.163.com/nc/article/8GOVEI0L00964JJM/full.html
  var docid = util.format("%s",entry.docid);
  var url = util.format('http://c.m.163.com/nc/article/%s/full.html', docid);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json || !json[docid]) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():json null");
      return;
    }
    var jObj = json[docid];
    var obj = entry;
    News.findOne(genFindCmd(site, docid), function(err, result) {
      if (err || result) {
        return;
      }
      obj.docid = encodeDocID(site, docid);
      obj.site = site;
      obj.body = jObj.body;
      obj.img = jObj.img;
      obj.link = "";
      if(entry.url_3w) {
        obj.link = entry.url_3w; // http://help.3g.163.com/13/0611/08/912V2VCS00963VRO.html
      }else if(entry.url) {
        obj.link = entry.url; // http://3g.163.com/ntes/13/0611/08/912V2VCS00963VRO.html
      }else {
        obj.link = util.format("http://3g.163.com/touch/article.html?docid=%s", docid); // http://3g.163.com/touch/article.html?docid=912V2VCS00963VRO
      }
      obj.title = jObj.title;
      obj.ptime = jObj.ptime; // 2014-01-04 09:47:48
      obj.time = Date.parse(obj.ptime); // 1388800068000
      obj.marked = jObj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.digest = genDigest(obj.body);
      if(entry.imgsrc) {
        obj.cover = entry.imgsrc;
      } else if (obj.img[0]) {
        obj.cover = obj.img[0].src;
      }

      // img lazyloading
      obj.img.forEach(function (img) {
        var imgHtml = genLazyLoadHtml(img.alt, img.src);
        obj.marked = obj.marked.replace(img.ref, imgHtml);
      });
      if(jObj.video) {
        for(var i=0; i<jObj.video.length; i++) {
          var v = jObj.video[i];
          if(!v.alt || !v.cover || !v.url_m3u8 || !v.ref) {
            continue;
          }
          var html = genLazyLoadHtml(v.alt, v.cover);
          html += util.format('<br/><a href="%s" target="_blank">%s</a><br/>', v.url_m3u8, v.alt);
          obj.marked = obj.marked.replace(v.ref, html);
        }
      }

      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
        }
      }); // News.insert
    }); // News.findOne
  });// request
};

function genBodyHtml(obj) {
  var body = "";
  var i = 0;

  if((!obj) || (!obj.photos)) {
    console.log("hzfdbg file[" + __filename + "]" + " genBodyHtml():null");
    return "";
  }

  body = obj.desc + "<br>";

  for(i=0; i<obj.photos.length; i++) {
    body += obj.photos[i].note?obj.photos[i].note: obj.photos[i].imgtitle;
    body += genLazyLoadHtml("", obj.photos[i].imgurl);
  }

  return body;
}

function pickImg(obj) {
  var img = [];
  var i = 0;

  if((!obj) || (!obj.photos)) {
    console.log("hzfdbg file[" + __filename + "]" + " pickImg():null");
    return "";
  }

  for(i=0; i<obj.photos.length; i++) {
    img[i] = obj.photos[i].imgurl;
  }

  return img;
}

var getPhotoDetail = function(entry) {
  var docid = util.format("%s",entry.setid);
  var url = util.format("http://c.m.163.com/photo/api/set/0096/%s.json",entry.setid);
  var req = {uri: url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json) {
      console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail():json null");
      return;
    }
    var jObj = json;
    var obj = entry;
    News.findOne(genFindCmd(site, docid), function(err, result) {
      if (err || result) {
        return;
      }
      obj.docid = encodeDocID(site, docid);
      obj.site = site;
      obj.body = genBodyHtml(jObj);
      obj.img = pickImg(jObj);
      obj.link = "";
      if(jObj.url) {
        obj.link = jObj.url; // http://sports.163.com/photoview/011U0005/99130.html#p=90Q9LN0D4FFF0005
      }
      obj.title = entry.setname ? entry.setname : entry.title;
      obj.ptime = jObj.createdate; // 2014-01-04 09:47:48
      obj.time = Date.parse(obj.ptime); // 1388800068000
      obj.marked = jObj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.marked = obj.body;
      obj.digest = genDigest(obj.body);
      if(entry.clientcover) {
        obj.cover = entry.clientcover;
      } else if (entry.clientcover1){
        obj.cover = entry.clientcover1;
      }else if (obj.img[0]) {
        obj.cover = obj.img[0];
      }

      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getPhotoDetail(), News.insert():error " + err);
        }
      }); // News.insert
    }); // News.findOne
  });// request
};

var crawlerPhotoTag = function(entry) {
  var req = {uri: entry.url, method: "GET", headers: headers};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoTag():JSON.parse() error");
      return;
    }
    var newsList = json;
    if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoTag():newsList empty in url " + entry.url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if(!newsEntry.setid || !newsEntry.setname) {
        return;
      }
      if(entry.tags.length) {
        for(var i=0; i<entry.tags.length; i++) {
          if(newsEntry.setname.indexOf(entry.tags[i]) !== -1) {
            newsEntry.tagName = entry.tags[i];
            break;
          }
        }
      }else {
        newsEntry.tagName = entry.tname;
      }
      if(!newsEntry.tagName) {
        return;
      }
      News.findOne(genFindCmd(site, newsEntry.setid), function(err, result) {
        if(err || result) {
          return;
        }
        console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoTag():["+newsEntry.tagName+"]"+newsEntry.setname+",docid="+newsEntry.setid);
        startGetDetail.emit('startGetPhotoDetail', newsEntry);
      }); // News.findOne
    });//forEach
    if(newsList.length == 10) {
      if(entry.crawlFlag) {
        entry.url = util.format("http://c.m.163.com/photo/api/morelist/0096/%s/%s.json", entry.tid, newsList[9].setid);
        console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoTag(): next page="+entry.url);
        setTimeout(function() {
          crawlerPhotoTag(entry);
        }, 10000); // crawl next page after 10 seconds
      }
    }else {
      console.log("hzfdbg file[" + __filename + "]" + " crawlerPhotoTag(): last page");
      entry.crawlFlag = 0;
    }
  });//request
}

var crawlerPhotoTags = function() {
  photoTags.forEach(function(entry) {
    entry.url = util.format('http://c.m.163.com/photo/api/list/0096/%s.json', entry.tid);
    if(!crawlFlag && entry.stopped) {
      return;
    }
    crawlerPhotoTag(entry);
  });//forEach
}

var crawlerSubscribe = function (entry) {
  var MAX_PAGE_NUM = 1;
  var page = 0;

  if(entry.tid === 'T1348647909107') { // 头条
    MAX_PAGE_NUM = 5;
  }
  if(entry.crawlFlag) {
    MAX_PAGE_NUM = 10;
    entry.crawlFlag = 0;
  }
  for(page=0; page<MAX_PAGE_NUM; page++) {
    (function(page) {
    // http://c.m.163.com/nc/article/headline/T1348647909107/0-20.html
    // http://c.m.163.com/nc/article/list/T1350383429665/0-20.html
    var url = util.format('http://c.m.163.com/nc/article/list/%s/%d-20.html', entry.tid, page*20);
    if(entry.tid === 'T1348647909107') { // 头条
      url = util.format('http://c.m.163.com/nc/article/headline/%s/%d-20.html', entry.tid, page*20);
    }
    var req = {uri: url, method: "GET", headers: headers};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
    request(req, function (err, res, body) {
      var json = data2Json(err, res, body);
      if(!json) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():JSON.parse() error");
        return;
      }
      var newsList = json[entry.tid];
      if((!newsList) || (!newsList.length) || (newsList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():newsList empty in url " + url);
        return;
      }
      newsList.forEach(function(newsEntry) {
        if(!newsEntry.docid || !newsEntry.title) {
          return;
        }
        if(newsEntry.docid == '9815P05N00963VRO') { // 网易新闻客户端栏目迁移公告
          return;
        }
        if(entry.tags.length) {
          for(var i=0; i<entry.tags.length; i++) {
            if(newsEntry.title.indexOf(entry.tags[i]) !== -1) {
              newsEntry.tagName = entry.tags[i];
              break;
            }
          }
        }else {
          newsEntry.tagName = entry.tname;
        }
        if(!newsEntry.tagName) {
          return;
        }
        News.findOne(genFindCmd(site, newsEntry.docid), function(err, result) {
          if(err || result) {
            return;
          }
          if('T1387970173334' == entry.tid) { // 看客
            if(newsEntry.photosetID){
              var l = newsEntry.photosetID.split('|') //photosetID=54GJ0096|33178
              if(l && l.length == 2) {
                newsEntry.setid = l[1]
              }
            }
            if(!newsEntry.setid) {
              return;
            }
            startGetDetail.emit('startGetPhotoDetail', newsEntry);
          }else {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.docid);
            startGetDetail.emit('startGetNewsDetail', newsEntry);
          }
        }); // News.findOne
      });//forEach
    });//request
    })(page);
  }//for
};

var crawlerNeteaseSubscribes = function() {
  neteaseSubscribes.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    crawlerSubscribe(entry);
  });//forEach
}

var crawlerOtherSubscribes = function() {
  otherSubscribes.forEach(function(entry) {
    if(!crawlFlag && entry.stopped) {
      return;
    }
    crawlerSubscribe(entry);
  });//forEach
}

var neteaseCrawler = function() {
  console.log('Start neteaseCrawler() at ' + new Date());
  crawlerPhotoTags();
  crawlerNeteaseSubscribes();
  //crawlerOtherSubscribes();
  setTimeout(neteaseCrawler, 2000 * 60 * 60);
}

var crawlerInit = function() {
  neteaseSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
  otherSubscribes.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
  photoTags.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
}

exports.neteaseCrawler = neteaseCrawler;
exports.neteaseTags = neteaseSubscribes.concat(otherSubscribes, photoTags)
crawlerInit();
neteaseCrawler();