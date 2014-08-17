var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var SysUrl = require('url');
var _ = require('underscore');
var moment = require('moment');
var config = require('../config');
var News = require('../models/news');
var utils = require('../lib/utils');
var logger = require('../logger');
var crawlFlag = config.crawlFlag;
var updateFlag = config.updateFlag;
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': 'NTES Android',
  'Connection': 'Keep-Alive',
  'Host': 'c.m.163.com',
};
var site = 'netease';
// http://c.m.163.com/nc/topicset/android/v3/subscribe.html
var neteaseSubscribes = [
  // 头条 // http://c.m.163.com/nc/article/headline/T1348647909107/0-20.html
  {tname:'头条', tid:'T1348647909107', tags:['新闻故事', '一周新闻日历', '科学搬主任']},
  // 原创
  //{tname:'原创', tid:'T1367050859308', tags:[]},
  {tname:'轻松一刻', tid:'T1350383429665', tags:[]},
  //{tname:'轻松一刻语音版', tid:'T1379040077136', tags:[]},
  {tname:'另一面', tid:'T1348654756909', tags:[]},
  {tname:'今日之声', tid:'T1348654628034', tags:[]},
  {tname:'今日环球侃客', tid:'T1381482353221', tags:[]},
  {tname:'易百科', tid:'T1355887570398', tags:[]},
  {tname:'看客', tid:'T1387970173334', tags:[]},
  {tname:'微历史', tid:'T1376554225976', tags:[], stopped:1}, // 2014-01-03 停止更新
  {tname:'娱乐BigBang', tid:'T1359605557219', tags:[]},
  //{tname:'娱乐BigBang语音版', tid:'T1394711522757', tags:[]},
  {tname:'独家解读', tid:'T1348654778699', tags:[]},
  {tname:'数读', tid:'T1348654813857', tags:[]},
  {tname:'娱乐连环画', tid:'T1393399130300', tags:[]},
  {tname:'一周车坛囧事', tid:'T1382946585552', tags:[]},
  {tname:'视野', tid:'T1382946778301', tags:['视野'], stopped:1}, // 2013-11-27 停止更新
  {tname:'应用一勺烩', tid:'T1383187051764', tags:[], stopped:1}, // 2013-11-21 停止更新
  {tname:'网易UGC实验室', tid:'T1395385797796', tags:[]},
  {tname:'深夜畅聊', tid:'T1396928569598', tags:[]},
  {tname:'胖编怪谈', tid:'T1396928667862', tags:[]},
  {tname:'真人秀', tid:'T1396928753073', tags:[]},
  {tname:'街头会易', tid:'T1399258893359', tags:[]},
  {tname:'历史七日谈', tid:'T1359605505216', tags:[], stopped:1}, // 2013-12-05 停止更新
  {tname:'科技万有瘾力', tid:'T1359605530115', tags:[], stopped:1}, // 2014-01-07 停止更新
  {tname:'一周媒体速递', tid:'T1359605600543', tags:[], stopped:1}, // 2014-01-06 停止更新
  {tname:'一周军情观察', tid:'T1359613635637', tags:[], stopped:1}, // 专题 2014-01-07 停止更新
  {tname:'一周人物', tid:'T1385105962170', tags:[], stopped:1}, // 2014-01-07 停止更新
  // 专栏
  {tname:'真话', tid:'T1370583240249', tags:[]},
  {tname:'新闻杂谈', tid:'T1374655362262', tags:[]},
  {tname:'新闻漫画', tid:'T1374655548448', tags:[]},
  {tname:'军事控', tid:'T1374655601172', tags:[], stopped:1}, // 2014-01-07 停止更新
  {tname:'读写客', tid:'T1374655641708', tags:[]},
  //{tname:'8点1氪', tid:'T1374655687362', tags:[]},
  {tname:'科学现场调查', tid:'T1374655737387', tags:[]},
  {tname:'读报', tid:'T1378876118770', tags:[]},
  {tname:'知乎日报', tid:'T1383207786512', tags:[], stopped:1}, // 专题 2014-01-07 停止更新
  {tname:'每周观察', tid:'T1383207857966', tags:[], stopped:1}, // 专题 2014-01-20 停止更新
  {tname:'隔洋观花', tid:'T1385106187014', tags:[], stopped:1}, // 2014-01-09 停止更新
  {tname:'罗辑思维', tid:'T1385106069241', tags:[]}, // Video
  //{tname:'罗辑思维', tid:'T1379040133684', tags:[]}, // Audio
  {tname:'打铁记', tid:'T1383639452806', tags:[], stopped:1}, // 2013-11-22 停止更新
  {tname:'爱解析', tid:'T1383639904180', tags:[]},
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
  //{tname:'健康养生', tid:'T1370589182416', tags:[]},
  //{tname:'网易女人', tid:'T1364183816404', tags:[], stopped:1}, // 2013-08-04 停止更新
  // 音频
  //{tname:'有声', tid:'T1394610975770', tags:[]}, // Audio
  //{tname:'清晨时光', tid:'T1394618026933', tags:[]}, // Audio
  //{tname:'历史上的今天', tid:'T1394626686487', tags:[]}, // Audio
  //{tname:'糗事百科音频版', tid:'T1379039985773', tags:[]}, // Audio
  //{tname:'头条新闻', tid:'T1379039891960', tags:[]}, // Audio
  //{tname:'新闻直播间', tid:'T1378713857672', tags:[]}, // Audio
  //{tname:'奇葩一朵朵', tid:'T1394626394234', tags:[]}, // Audio
  //{tname:'大哈讲段子', tid:'T1394626579176', tags:[]}, // Audio
  // 视频
  // http://c.m.163.com/nc/video/list/00850FRB/n/0-10.html
  // http://c.m.163.com/nc/video/detail/V9PJS6H0U.html
  //{tname:'热点', tid:'V9LG4B3A0', tags:[]},
  //{tname:'娱乐', tid:'V9LG4CHOR', tags:[]},
  //{tname:'搞笑', tid:'V9LG4E6VR', tags:[]},
  //{tname:'精品', tid:'00850FRB', tags:['新闻52秒', 'YouTube天天精选', '腐女办公室', '超级颜论', '数码贱男', '飞碟一分钟', '飞碟说', '娱乐快报', '这个历史挺靠谱', '逻辑思维']},
  // 其它订阅
  {tname:'爆笑gif图', tid:'T1395298452550', tags:[]},
  {tname:'gif怪兽', tid:'T1385542280953', tags:[]},
  {tname:'碉民早爆', tid:'T1390457192301', tags:[]},
];

var otherSubscribes = [
  // 报刊
  //{tname:'南都娱乐周刊', tid:'T1374537739895', tags:['年度', '头条人物']},
  //{tname:'凤凰周刊', tid:'T1374538012901', tags:[]},
  //{tname:'壹读', tid:'T1380165047292', tags:['时政笔记', '壹读百科', '纯干货', '壹读姿势', '数据', '职觉', '边角料']},
  //{tname:'商业价值', tid:'T1374538092965', tags:[]},
  //{tname:'南方人物周刊', tid:'T1380165663024', tags:[]},
  //{tname:'IT时代周刊', tid:'T1374537778882', tags:[]},
  //{tname:'互联网周刊', tid:'T1374538770149', tags:[]},
  //{tname:'城市画报', tid:'T1374539228305', tags:[]},
  // 资讯
  //{tname:'一五一十部落', tid:'T1374480580631', tags:[]},
  //{tname:'喷嚏网', tid:'T1380165278983', tags:[]},
  //{tname:'没品新闻', tid:'T1380165400636', tags:[]},
  //{tname:'麦格时光网', tid:'T1379312559214', tags:[]},
  //{tname:'坏新闻', tid:'T1383813385385', tags:[]},
  // 漫画
  //{tname:'冷兔', tid:'T1376989764224', tags:[]}, // 乱码
  //{tname:'张小盒漫画', tid:'T1374654808952', tags:[]},
  //{tname:'蔡志忠漫画', tid:'T1374655157113', tags:[]},
  //{tname:'长颈鹿但丁', tid:'T1385975344862', tags:[]},
  //{tname:'小破孩', tid:'T1385457660845', tags:[]},
  //{tname:'暴走漫画', tid:'T1381825412501', tags:[]},
  //{tname:'小丑出品', tid:'T1386300294647', tags:[]},
  //{tname:'想太多的猪', tid:'T1374654037531', tags:[]},
  //{tname:'罗罗布家族', tid:'T1385977225272', tags:[]},
  // 美女
  //{tname:'游戏美女', tid:'T1374483001879', tags:[]},
  //{tname:'妹子图', tid:'T1374482883888', tags:[]},
  //{tname:'美媛馆', tid:'T1385719108476', tags:[]},
  //{tname:'私の写真', tid:'T1383643220558', tags:[]},
  //{tname:'Showgirl美女写真馆', tid:'T1383810777853', tags:[]},
  //{tname:'天天诱惑·美女', tid:'T1383810866284', tags:[]},
  //{tname:'美女·写真·艺术', tid:'T1383818365070', tags:[]},
  //{tname:'咔嚓咔嚓', tid:'T1383818583837', tags:[]},
  {tname:'啊噜哈Aluha', tid:'T1388400299205', tags:[]},
  // 生活
  //{tname:'煎蛋', tid:'T1374543275708', tags:[]},
  //{tname:'惠惠购物锦囊', tid:'T1374543622922', tags:[]},
  //{tname:'生活早参考', tid:'T1380447562863', tags:[]}, // Video
  //{tname:'5TIME语录网', tid:'T1374544255040', tags:[]},
  // 人文
  //{tname:'佳人', tid:'T1374488941509', tags:['插画心语']},
  //{tname:'美文日赏', tid:'T1374488449712', tags:[]},
  // 历史
  {tname:'民国秘闻', tid:'T1383647115505', tags:[]},
  // 娱乐
  {tname:'我们爱讲冷笑话', tid:'T1376989923762', tags:[]},
  //{tname:'如厕ing', tid:'T1374549843906', tags:[]},
  //{tname:'糗事百科', tid:'T1374550407902', tags:[]},
  //{tname:'笑话精选', tid:'T1374550232723', tags:[]},
  {tname:'冷笑话精选', tid:'T1381732564640', tags:[]},
  {tname:'有意思吧', tid:'T1380448203066', tags:[]},
  //{tname:'挖段子冷笑话', tid:'T1376635837979', tags:[]},
  //{tname:'涨姿势', tid:'T1376638549337', tags:[]},
  //{tname:'爱重口味', tid:'T1376636972612', tags:[]},
  //{tname:'掘图志', tid:'T1376637148182', tags:[]},
  //{tname:'萝卜网', tid:'T1376637252500', tags:[]},
  //{tname:'狂囧网', tid:'T1376637481760', tags:[]},
  {tname:'笑话幽默', tid:'T1376637720014', tags:[]},
  //{tname:'鸸鹋动物园', tid:'T1376641060407', tags:[]},
  //{tname:'来福岛', tid:'T1376641060418', tags:[]},
  //{tname:'囧马热文', tid:'T1376642915530', tags:[]},
  {tname:'笑话集', tid:'T1376643082077', tags:[]},
  //{tname:'乐不思蜀', tid:'T1376643174873', tags:[]},
  {tname:'多玩图库', tid:'T1376643423014', tags:[
    '段子精选',
    '多玩洋葱新闻',
    '无品新闻',
    '日式冷笑话',
    '十万个冷知识',
    '今日囧图',
    '吐槽囧图',
    '全球搞笑GIF',
    '宠物卖萌囧图',
    '暴走漫画',
    '每日美女',
    '奇趣档案',
    '搞笑漫画',
    '一起神回复',
    '明星囧图',
    '异色画报',
  ]},
  {tname:'笑话之家', tid:'T1376643747659', tags:[]},
  //{tname:'掘精小娘子', tid:'T1383811813773', tags:[]},
  //{tname:'剧情神展开', tid:'T1383811980965', tags:[]},
  //{tname:'神回复', tid:'T1383817412975', tags:[]},
  {tname:'每日一乐', tid:'T1383817602040', tags:[]},
  {tname:'笑料百科', tid:'T1385541837579', tags:[]},
  {tname:'趣图百科', tid:'T1385542239547', tags:[]},
  {tname:'脑残对话', tid:'T1385542317968', tags:[]},
  //{tname:'神吐槽', tid:'T1385542359888', tags:[]},
  // 视觉
  //{tname:'猫舍', tid:'T1374483113516', tags:[]},
  // 未知分类
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
  var docid = util.format('%s',entry.docid);
  var url = util.format('http://c.m.163.com/nc/article/%s/full.html', docid);
  var req = {
    uri: url,
    method: 'GET',
    headers: headers
  };
  if (proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = utils.parseJSON(err, res, body);
    if (!json || !_.has(json, docid) || !utils.hasKeys(json[docid], ['docid', 'title', 'body', 'ptime'])) {
      logger.warn('Invalid json data in %s', res ? res.request.href : url);
      return;
    }
    var jObj = json[docid];
    var obj = {};
    News.findOne(utils.genFindCmd(site, docid), function(err, result) {
      if (err) {
        return;
      }
      if (result) {
        if (updateFlag) {
          entry.updateFlag = 1;
        } else {
          return;
        }
      }
      obj.docid = utils.encodeDocID(site, docid);
      obj.site = site;
      obj.link = entry.url_3w || entry.url || util.format('http://3g.163.com/touch/article.html?docid=%s', docid);
      obj.title = jObj.title;
      var t1 = moment(jObj.ptime);
      var t2 = moment(entry.ptime);
      var t3 = moment(entry.lmodify);
      var ptime = t1.isValid() ? t1 : (t2.isValid() ? t2 : t3);
      if (!ptime.isValid()) {
        logger.warn('Invalid time in %s', res ? res.request.href : url);
        return;
      }
      obj.time = ptime.toDate();
      obj.marked = jObj.body;
      obj.created = new Date();
      obj.views = entry.updateFlag ? result.views : 1;
      obj.tags = entry.tagName;
      obj.digest = utils.genDigest(jObj.body);
      obj.cover = entry.imgsrc;
      if (_.isArray(jObj.img) && !_.isEmpty(jObj.img)) {
        _.each(jObj.img, function(img, i, imgs) {
          if (!utils.hasKeys(img, ['src', 'ref'])) {
            logger.info('Invalid img data %j', img);
            return;
          }
          if (!obj.cover) {
            obj.cover = img.src;
          }
          var imgHtml = utils.genLazyLoadHtml(img.alt, img.src);
          obj.marked = obj.marked.replace(img.ref, imgHtml);
        });
      }
      if (_.isArray(jObj.video) && !_.isEmpty(jObj.video)) {
        _.each(jObj.video, function(v, i, videos) {
          if (!utils.hasKeys(v, ['url_m3u8', 'url_mp4', 'cover', 'ref'])) {
            logger.info('Invalid video data %j', v);
            return;
          }
          if (!obj.cover) {
            obj.cover = v.cover;
          }
          var link = v.url_m3u8 || v.url_mp4;
          var html = util.format('<br/><a href="%s" target="_blank">%s</a><br/>', link, v.alt);
          link = link.replace(/&amp;/g, '&');
          var query = SysUrl.parse(decodeURIComponent(link), true).query;
          var url = query.url || link;
          if (utils.isAudioVideoExt(url)) {
            html += utils.genJwPlayerEmbedCode(util.format('vid_%s_%d', jObj.docid, i), url, v.cover, i===0);
          }
          obj.marked = obj.marked.replace(v.ref, html);
          if (!obj.hasVideo) {
            obj.hasVideo = 1;
          }
        });
      }

      logger.log('[%s]%s, docid=[%s]->[%s],updateFlag=%d', obj.tags, obj.title, docid, obj.docid, entry.updateFlag);
      if (entry.updateFlag) {
        News.update({docid: obj.docid}, obj, function (err, result) {
          if (err || !result) {
            logger.warn('update error: %j', err);
          }
        });
      } else {
        News.insert(obj, function (err, result) {
          if (err) {
            logger.warn('insert error: %j', err);
          }
        });
      }
    });
  });
};

var getPhotoDetail = function(entry) {
  var docid = util.format('%s',entry.setid);
  var url = util.format('http://c.m.163.com/photo/api/set/0096/%s.json',entry.setid);
  var req = {
    uri: url,
    method: 'GET',
    headers: headers
  };
  if (proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = utils.parseJSON(err, res, body);
    if (!json || !utils.hasKeys(json, ['photos', 'createdate'])) {
      logger.warn('Invalid json data in %s', res ? res.request.href : url);
      return;
    }
    if (!_.isArray(json['photos']) || _.isEmpty(json['photos'])) {
      logger.warn('Invalid photos in %s', res ? res.request.href : url)
      return;
    }
    var jObj = json;
    var obj = {};
    News.findOne(utils.genFindCmd(site, docid), function(err, result) {
      if (err) {
        return;
      }
      if (result) {
        if (updateFlag) {
          entry.updateFlag = 1;
        } else {
          return;
        }
      }
      obj.docid = utils.encodeDocID(site, docid);
      obj.site = site;
      obj.link = entry.seturl || jObj.url || util.format('http://help.3g.163.com/photoview/%s/%s.html', entry.tid, entry.setid);
      obj.title = entry.setname || jObj.setname || entry.title;
      var t1 = moment(jObj.createdate);
      var t2 = moment(jObj.datatime);
      var t3 = moment(entry.createdate);
      var t4 = moment(entry.datetime);
      var ptime = t1.isValid() ? t1 : (t2.isValid() ? t2 : (t3.isValid() ? t3 : t4));
      if (!ptime.isValid()) {
        logger.warn('Invalid time in %s', res ? res.request.href : url);
        return;
      }
      obj.time = ptime.toDate();
      obj.created = new Date();
      obj.views = entry.updateFlag ? result.views : 1;
      obj.tags = entry.tagName;
      obj.marked = jObj.desc || '';
      obj.cover = jObj.cover || jObj.tcover || jObj.scover ||entry.cover ||  entry.tcover || entry.scover || entry.clientcover || entry.clientcover1;
      _.each(jObj.photos, function (img, i, imgs) {
        if (!_.has(img, 'imgurl')) {
          logger.info('Invalid img data %j', img);
          return;
        }
        if (!obj.cover) {
          obj.cover = img.imgurl;
        }
        obj.marked += img.note ? img.note: img.imgtitle;
        obj.marked += utils.genLazyLoadHtml('', img.imgurl);
      });
      obj.digest = utils.genDigest(obj.marked);

      logger.log('[%s]%s, docid=[%s]->[%s],updateFlag=%d', obj.tags, obj.title, docid, obj.docid, entry.updateFlag);
      if (entry.updateFlag) {
        News.update({docid: obj.docid}, obj, function (err, result) {
          if (err || !result) {
            logger.warn('update error: %j', err);
          }
        });
      } else {
        News.insert(obj, function (err, result) {
          if (err) {
            logger.warn('insert error: %j', err);
          }
        });
      }
    });
  });
};

var crawlerPhotoTag = function(entry) {
  var req = {
    uri: entry.url,
    method: 'GET',
    headers: headers
  };
  if (proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = utils.parseJSON(err, res, body);
    if (!json) {
      logger.warn('Invalid json data in %s', res ? res.request.href : entry.url);
      return;
    }
    var newsList = json;
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', res ? res.request.href : entry.url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['setid', 'setname'])) {
        logger.warn('Invalid newsEntry in %s', res ? res.request.href : entry.url);
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.setname, entry);
      if (!newsEntry.tagName) {
        return;
      }
      newsEntry.tid = entry.tid;
      News.findOne(utils.genFindCmd(site, newsEntry.setid), function(err, result) {
        if (err) {
          return;
        }
        newsEntry.updateFlag = 0;
        if (result) {
          if (updateFlag) {
            newsEntry.updateFlag = 1;
          } else {
            return;
          }
        }
        startGetDetail.emit('startGetPhotoDetail', newsEntry);
      });
    });
    if (entry.crawlFlag) {
      if (newsList.length === 10) {
        entry.url = util.format('http://c.m.163.com/photo/api/morelist/0096/%s/%s.json', entry.tid, newsList[9].setid);
        logger.info('[%s] next page: %s', entry.tname, entry.url);
        setTimeout(crawlerPhotoTag, 3000, entry);
      }else {
        logger.info('[%s] last page: %s', entry.tname, entry.url);
        entry.crawlFlag = 0;
      }
    }
  });
}

var crawlerSubscribe = function (entry) {
  var url = util.format('http://c.m.163.com/nc/article/list/%s/%d-20.html', entry.tid, entry.page * 20);
  if (entry.tid === 'T1348647909107') { // 头条
    url = util.format('http://c.m.163.com/nc/article/headline/%s/%d-20.html', entry.tid, entry.page * 20);
  }
  var req = {
    uri: url,
    method: 'GET',
    headers: headers
  };
  if (proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = utils.parseJSON(err, res, body);
    if (!json || !_.has(json, entry.tid)) {
      logger.warn('Invalid json data in %s', res ? res.request.href : url);
      return;
    }
    var newsList = json[entry.tid];
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', res ? res.request.href : url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['docid', 'title'])) {
        logger.warn('Invalid newsEntry in %s', res ? res.request.href : url);
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.title, entry);
      if (!newsEntry.tagName) {
        return;
      }
      News.findOne(utils.genFindCmd(site, newsEntry.docid), function(err, result) {
        if (err) {
          return;
        }
        newsEntry.updateFlag = 0;
        if (result) {
          if (updateFlag) {
            newsEntry.updateFlag = 1;
          } else {
            return;
          }
        }
        if ('T1387970173334' == entry.tid) { // 看客
          if (newsEntry.photosetID){
            var l = newsEntry.photosetID.split('|') //photosetID=54GJ0096|33178
            if (l && l.length === 2) {
              newsEntry.setid = l[1]
            }
          }
          if (!newsEntry.setid) {
            return;
          }
          startGetDetail.emit('startGetPhotoDetail', newsEntry);
        }else {
          startGetDetail.emit('startGetNewsDetail', newsEntry);
        }
      });
    });
    if (entry.crawlFlag) {
      if (newsList.length === 20) {
        entry.page += 1;
        logger.info('[%s] next page: %d', entry.tname, entry.page);
        setTimeout(crawlerSubscribe, 3000, entry);
      }else {
        logger.info('[%s] last page: %d', entry.tname, entry.page);
        entry.crawlFlag = 0;
      }
    }
  });
};

var crawlerPhotoTags = function() {
  photoTags.forEach(function(entry) {
    if (!crawlFlag && entry.stopped) {
      return;
    }
    entry.url = util.format('http://c.m.163.com/photo/api/list/0096/%s.json', entry.tid);
    crawlerPhotoTag(entry);
  });
}

var crawlerSubscribes = function() {
  var subscribes = neteaseSubscribes;
  subscribes.forEach(function(entry) {
    if (!crawlFlag && entry.stopped) {
      return;
    }
    entry.page = 0;
    crawlerSubscribe(entry);
  });
}

var main = function() {
  logger.log('Start');
  crawlerSubscribes();
  crawlerPhotoTags();
  setTimeout(main, config.crawlInterval);
}

var init = function() {
  if (process.argv[2] == 1) {
    crawlFlag = 1;
  }
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

exports.main = main;
exports.neteaseTags = neteaseSubscribes.concat(photoTags);
init();
main();
