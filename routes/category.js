var async = require('async');
var News = require('../models/news');
var hotQty = require('config').Config.hotQty;
var categoryCmd = {
    "hot":{"tags": {"$in":["轻松一刻","今日之声","新闻杂谈","媒体速递","另一面","一周新闻日历","新闻故事","先知道","神吐槽","热辣评","我来说两句","开心一刻","红人红事榜","FUN来了","今日最大声","有报天天读","凤凰知道","凤凰热追踪","今日网言","新观察","今日话题"]}},
    "photo":{"tags": {"$in":["看客","独家图集","图粹","盘点","年度","一周外媒动物图片精选","图话","活着","存照","中国人的一天"]}},
    "beauty":{"tags": {"$in":["妹子图", "妹子控", "超诱惑", "7v美眉", "Show妹子", "云朵模特", "女神来了", "优美高清", "阿妹高清美女", "搜狐美女","清纯美女","啊噜哈Aluha","推软妹"]}},
    "manhua":{"tags": {"$in":["新闻漫画","变态辣椒","张小盒漫画","蔡志忠漫画"]}},
    "junshi":{"tags": {"$in":["军情观察","军事控","军情茶馆","讲武堂","军魂100"]}},
    "wenshi":{"tags": {"$in":["历史七日谈","读写客","微历史","史说新语","史林拍案"]}},
    "yule":{"tags": {"$in":["娱乐BigBang","尖峰娱论","明星皆为微博狂","星大片","谁八卦啊你八卦","所谓娱乐"]}},
    "fashion":{"tags": {"$in":["穿衣奇葩货","每日时髦不NG","一周穿衣红榜","星妆容红黑榜","凡人观时尚","时尚有意思"]}},
    "film":{"tags": {"$in":["百部穿影"]}},
    "video":{"tags": {"$in":["新闻晚8点", '夜夜谈', '所谓娱乐', '天天看', '腾讯精品课', '腾讯育儿宝典', '封面秀', '健康每一天', '时尚有意思', '恋爱高手', 'V+视频', '笑来了大姨夫', '生活家', '家有萌宝']}},
    "joke":{"tags": {"$in":["视频.搞笑","冷笑话精选","微博搞笑","我们爱讲冷笑话"]}},
    "life":{"tags": {"$in":["易百科","虎扑健身","健康养生", "健康每一天", "生活家", "吃货大本营", "达人极品晒"]}},
    "tech":{"tags": {"$in":["科技万有瘾力","8点1氪","每日钛度","科学现场调查","数说IT","创业说","氪周刊","氪月报","今日嗅评","虎嗅早报","启示录","TMT解码","科技不怕问"]}},
    "default":{},
};

var index = function (req, res, next) {
  var category = req.params.category;

  var getNewss = function (callback) {
    var page = req.params.page || 1;
    var cmd = categoryCmd[category];
    if(!cmd) {
      cmd = categoryCmd["hot"];
    }
    News.page(cmd, page, function (err, currentPage, pages, result) {
      if (! err) {
        callback(null, {currentPage: currentPage, pages: pages, newss: result});
      } else {
        callback(err);
      }
    });
  };

  async.parallel({
    newss: getNewss
  },
  function (err, results) {
    if (! err) {
      res.render('category', {pageTitle: category,
        currentPage: results.newss.currentPage, pages: results.newss.pages,
        news: results.newss.newss, category: category, active: category,
        baseUrl: '/category/' + encodeURIComponent(category) + '/page/'});
    } else {
      next(new Error(err.message));
    }
  });
};

exports.index = index;