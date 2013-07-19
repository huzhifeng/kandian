var async = require('async');
var News = require('../models/news');
var hotQty = require('config').Config.hotQty;
var categoryCmd = {
    "fun":{"tags": {"$in":["轻松一刻","神吐槽","热辣评","开心一刻","红人红事榜","FUN来了"]}},
    "news":{"tags": {"$in":["今日之声","新闻杂谈","媒体速递","另一面","一周新闻日历","新闻故事","先知道","热辣评","我来说两句","今日网言","新观察","今日最大声","有报天天读"]}},
    "photo":{"tags": {"$in":["独家图集","图粹","图片故事","清纯美女","一周图片精选","脸谱","图话"]}},
    "manhua":{"tags": {"$in":["新闻漫画","张小盒漫画","蔡志忠漫画","变态辣椒"]}},
    "junshi":{"tags": {"$in":["军事控","军情观察","军情茶馆","讲武堂","军魂100分"]}},
    "wenshi":{"tags": {"$in":["历史七日谈","史林拍案"]}},
    "yule":{"tags": {"$in":["娱乐BigBang","百部穿影"]}},
    "life":{"tags": {"$in":["健康养生","网易女人"]}},
    "tech":{"tags": {"$in":["科技万有瘾力","8点1氪","每日钛度","科学现场调查","数说IT"]}},
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
      cmd = categoryCmd["default"];
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