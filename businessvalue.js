var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var News = require('./models/news');
var genLazyLoadHtml = require('./lib/utils').genLazyLoadHtml;
var genFindCmd = require('./lib/utils').genFindCmd;
var encodeDocID = require('./lib/utils').encodeDocID;
var data2Json = require('./lib/utils').data2Json;
var genDigest = require('./lib/utils').genDigest;
var timestamp2date = require('./lib/utils').timestamp2date;
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';

var headers = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Host': 'api.businessvalue.com.cn',
  'Connection': 'Keep-Alive',
  'User-Agent':'Android',
};

var site = "businessvalue";
var categorys = [
  {cateid:0, first:0, label:"首页", bs_key:"AA97FAE9A19E2C73AEF0E54A8A70F07C", pagesize:10, maxpage:250, tags:['今日看点','硅谷观察','营销大爆炸']},
  {cateid:4, first:0, label:"特别策划", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:17},
  {cateid:30, first:0, label:"价值文摘", bs_key:"7E32C1BE34196A11094DB3970BEFA0CD", pagesize:10, maxpage:6},
  {cateid:11, first:0, label:"先锋", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:11},
  {cateid:8, first:0, label:"创新潮流", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:19},
  {cateid:6, first:0, label:"资本动向", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:15},
  {cateid:7, first:0, label:"企业变革", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:18},
  {cateid:10, first:0, label:"焦点行业", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:18},
  {cateid:9, first:0, label:"基本面", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:14},
  {cateid:14, first:0, label:"新视野", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:28},
  {cateid:3, first:0, label:"反潮流", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:2},
  {cateid:5, first:0, label:"对话", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:6},
  {cateid:12, first:0, label:"CSR竞争力", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:10},
  {cateid:13, first:0, label:"关键时候", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:5},
  {cateid:15, first:0, label:"商学院", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:15},
  {cateid:16, first:0, label:"思想速读", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:10},
  {cateid:17, first:0, label:"态度", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:20},
  {cateid:24, first:0, label:"编者的话", bs_key:"177C57B2BD9F7CE4EF6C545C756C9E58", pagesize:10, maxpage:5},
];

function genBodyHtmlAndImg(obj) {
  var body = "";
  var img = [];
  var text = "";
  var i = 0;
  var reg = new RegExp("<img.+?src=[\'\"]http(?!http).+?[\'\"].+?\\/>","g");
  var regrn = new RegExp("\r\n","g");
  var regr = new RegExp("\r","g");
  var regn = new RegExp("\n","g");

  if((!obj) || (!obj.sections)) {
    console.log("hzfdbg file[" + __filename + "]" + " genBodyHtmlAndImg():null");
    return "";
  }
  if(obj.top_image) {
    img.push(obj.top_image);
    body += genLazyLoadHtml(obj.top_image_info, obj.top_image);
  }
  if(obj.snippet1) {
    body += "<h2>浓缩观点</h2>"+obj.snippet1 + "<br />";
  }
  if(obj.snippet2) {
    body += obj.snippet2 + "<br />";
  }
  if(obj.snippet3) {
    body += obj.snippet3 + "<br />";
  }
  if(obj.snippet4) {
    body += obj.snippet4 + "<br />";
  }
  if(obj.snippet5) {
    body += obj.snippet5 + "<br />";
  }
  body += "<h2>正文</h2>"

  var sections = obj.sections;
  for(var key in sections) {
    var section = sections[key];
    body += "<br />";
    if(section.image) {
      img.push(section.image);
      body += genLazyLoadHtml(section.image_info, section.image);
    }
    if(section.section_title) {
      body += "<h3>"+section.section_title+"</h3>";
    }
    if(section.section_body.length) {
      text = section.section_body;
      text = text.replace(reg, function(url){
        var document = jsdom(url);
        var e = document.getElementsByTagName('img');
        url = e[0].getAttribute("src");
        img.push(url);
        return genLazyLoadHtml(obj.title, url);
      });
      text = text.replace(regrn,function(match) {
        return "<br/>";
      });
      text = text.replace(regr,function(match) {
        return "<br/>";
      });
      text = text.replace(regn,function(match) {
        return "<br/>";
      });
      body += text;
    }
  }

  return {"body":body, "img":img};
}

var startGetDetail = new EventEmitter();

startGetDetail.on('startGetNewsDetail', function (entry) {
  getNewsDetail(entry);
});

var getNewsDetail = function(entry) {
  // ACT=43&current_version=android_1.0&android_version=1.4&version=1.6.0&bs_key=3512362EB28C70BF8D8720EB585B1617&via=android&MsgID=articleDetails&entry_id=6492&top_image_width=480&cache=false&load_comments=true&fontType=simple&isHDMode=true
  var pd = {'ACT':'43', 'current_version':'android_1.0', 'android_version':'1.4', 'version':'1.6.0', 'bs_key':'3512362EB28C70BF8D8720EB585B1617', 'via':'android', 'MsgID':'articleDetails', 'entry_id':entry.entry_id, 'top_image_width':'480', 'cache':'false', 'load_comments':'true', 'fontType':'simple', 'isHDMode':'true'};
  if(30 == entry.cateid) {
    pd.bs_key = "79045D343471029727A5606B734AE87F";
    pd.MsgID = "digestDetails";
  }
  var url = 'http://api.businessvalue.com.cn/index.php';
  var req = {uri: url, method: "POST", headers: headers, form: pd};
  if(proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = data2Json(err, res, body);
    if(!json) {
      console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail():json null");
      return;
    }

    News.findOne(genFindCmd(site, entry.entry_id), function(err, result) {
      if(err || result) {
        return;
      }
      var bodyimg = genBodyHtmlAndImg(json);
      var obj = json;
      obj.docid = encodeDocID(site, entry.entry_id);
      obj.site = site;
      obj.body = bodyimg.body;
      obj.img = bodyimg.img;
      obj.link = "";
      if(obj.origin) {
        obj.link = obj.origin; // http://content.businessvalue.com.cn/post/10031.html
      }else if(obj.short_url) {
        obj.link = obj.short_url; // http://bvm.bz/4dn
      }else if(obj.source) {
        obj.link = obj.source; // http://bvm.bz/4dn
      }
      obj.title = entry.title;
      obj.ptime = timestamp2date(entry.entry_date);
      obj.time = new Date(Date.parse(obj.ptime));
      obj.marked = obj.body;
      obj.created = new Date();
      obj.views = 1;
      obj.tags = entry.tagName;
      obj.digest = genDigest(obj.body);
      obj.cover = obj.top_image;
      if (!obj.top_image && obj.img && obj.img[0]) {
        obj.cover = obj.img[0];
      }

      News.insert(obj, function (err, result) {
        if(err) {
          console.log("hzfdbg file[" + __filename + "]" + " getNewsDetail(), News.insert():error " + err);
        }
      }); // News.insert
    }); // News.findOne
  }); // request
};

var crawlerCategory = function (entry) {
  var MAX_PAGE_NUM = entry.maxpage > 3 ? 3 : entry.maxpage;
  var page = 1;

  if(entry.first == 1) {
    entry.first = 0;
    MAX_PAGE_NUM = entry.maxpage;
  }

  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    var url = "http://api.businessvalue.com.cn/index.php";
    // ACT=43&current_version=android_1.0&android_version=1.4&version=1.6.0&bs_key=177C57B2BD9F7CE4EF6C545C756C9E58&via=android&MsgID=getArticleByCategory&offset=0&limit=10&cat_id=14&fontType=simple
    // ACT=43&current_version=android_1.0&android_version=1.4&version=1.6.0&bs_key=177C57B2BD9F7CE4EF6C545C756C9E58&via=android&MsgID=getArticleByCategory&offset=11&limit=10&cat_id=14&fontType=simple
    var pd = {'ACT':'43', 'current_version':'android_1.0', 'android_version':'1.4', 'version':'1.6.0', 'bs_key':entry.bs_key, 'via':'android', 'MsgID':'getArticleByCategory', 'offset':(page-1)*entry.pagesize, 'limit':entry.pagesize, 'cat_id':entry.cateid, 'fontType':'simple'};
    if(1 != page) {
      pd.offset = (page-1)*entry.pagesize + 1;
    }
    if(30 == entry.cateid) {
      pd.MsgID = 'getDigestByCategory';
    }else if(0 == entry.cateid) {
      pd.MsgID = 'articles';
      pd.view_type = 'list';
      pd.sort = 'time';
      delete pd.cat_id;
    }
    var req = {uri: url, method: "POST", headers: headers, form: pd};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
    request(req, function (err, res, body) {
      var json = data2Json(err, res, body);
      if(!json) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():JSON.parse() error");
        return;
      }
      var news_num = (30 == entry.cateid)?json.digests_num:json.articles_num;
      if(parseInt(news_num) <= 0) {
        return;
      }
      var newsList = (30 == entry.cateid)?json.digests:json.articles;
      if(!newsList) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():newsList empty in url " + url);
        return;
      }
      var articles = [];
      for(var k in newsList) {
        articles.push(newsList[k]);
      }
      newsList = articles;
      newsList.forEach(function(newsEntry) {
        if(!newsEntry.title || !newsEntry.entry_id) {
          return;
        }
        newsEntry.tagName = entry.label;
        newsEntry.cateid = entry.cateid;
        newsEntry.pageindex = page;

        if(entry.tags) {
          var flag = 0;
          for(var i=0; i<entry.tags.length; i++) {
            if(newsEntry.title.indexOf(entry.tags[i]) !== -1) {
              flag = 1;
              newsEntry.tagName = entry.tags[i];
              break;
            }
          }
          if(!flag) {
            return;
          }
        }

        News.findOne(genFindCmd(site, newsEntry.entry_id), function(err, result) {
          if(err || result) {
            return;
          }
          console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():["+newsEntry.tagName+"]"+newsEntry.title+",docid="+newsEntry.entry_id);
          startGetDetail.emit('startGetNewsDetail', newsEntry);
        }); // News.findOne
      });//forEach
    });//request
    })(page);
  }//for
};

var businessvalueCrawler = function() {
  categorys.forEach(function(entry) {
    crawlerCategory(entry);
  });

  setTimeout(businessvalueCrawler, 4000 * 60 * 60);
}

exports.businessvalueCrawler = businessvalueCrawler;
businessvalueCrawler();