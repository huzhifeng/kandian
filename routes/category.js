var async = require('async');
var News = require('../models/news');
var hotQty = require('config').Config.hotQty;
var categoryCmd = {
    "hot":{"tags": {"$in":["轻松一刻","今日之声","新闻杂谈","媒体速递","另一面","一周新闻日历","新闻故事","先知道","神吐槽","热辣评","我来说两句","开心一刻","红人红事榜","FUN来了","今日最大声","有报天天读","凤凰知道","凤凰热追踪","今日网言","新观察","笑到抽筋"]}},
    "photo":{"tags": {"$in":["独家图集","图粹","明星旧照","清纯美女","一周图片精选","图话","星妆容红黑榜"]}},
    "manhua":{"tags": {"$in":["新闻漫画","变态辣椒","张小盒漫画","蔡志忠漫画"]}},
    "junshi":{"tags": {"$in":["军情观察","军事控","军情茶馆","讲武堂","军魂100分"]}},
    "wenshi":{"tags": {"$in":["历史七日谈","读写客","微历史","史说新语","史林拍案"]}},
    "yule":{"tags": {"$in":["娱乐BigBang","尖峰娱论","明星皆为微博狂","星大片","谁八卦啊你八卦","穿衣奇葩货","每日时髦不NG","一周穿衣红榜","百部穿影"]}},
    "life":{"tags": {"$in":["易百科","健康养生","达人极品晒","十万个护肤冷知识","女人必知","女人必备"]}},
    "tech":{"tags": {"$in":["科技万有瘾力","8点1氪","每日钛度","科学现场调查","数说IT","创业说","氪周刊","氪月报","今日嗅评","虎嗅早报","大话科技","每日一黑马"]}},
    "default":{},
};

var index = function (req, res, next) {
  var category = req.params.category;
  //console.log("zhutest category="+category);

  var getNewss = function (callback) {
    var page = req.params.page || 1;
    var cmd = categoryCmd[category];
    if(!cmd) {
      //console.log("zhutest no category :"+category);
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
      // console.log(currentPage, pages);
      res.render('category', {pageTitle: category,
        currentPage: results.newss.currentPage, pages: results.newss.pages,
        news: results.newss.newss, category: category, active: category,
        baseUrl: '/category/' + encodeURIComponent(category) + '/page/'});
    } else {
      // console.log(err);
      next(new Error(err.message));
    }
  });
};

exports.index = index;