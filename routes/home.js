var async = require('async');
var News = require('../models/news');
var Image = require('../models/image');
var utils = require('../lib/utils')

var index = function (req, res, next) {
  var page = req.params.page || 1;
  var getNewss = function (callback) {
    var cmd = {
      tags: {
        '$in': [
          '轻松一刻', '另一面', '今日之声', '今日环球侃客', '易百科', '看客', '娱乐BigBang', '数读', '一周车坛囧事', '深夜畅聊', '胖编怪谈', '真人秀', '街头会易', '每日易说', '易哥新闻', '媒体札记', '读写客', '科学现场调查', '罗辑思维', '真话',
          'FUN来了', '凤凰知道', '今日最大声', '史林拍案', '一周人物', '热追踪', '情感夜话', '洋跟帖',
          '神吐槽',
          '茶娱饭后', '新闻早点', '囧哥说事', '逗妹吐槽', '节操精选', '毒舌美少女',
          '新闻晚8点', '新闻哥', '短史记', '今日话题', '讲武堂', '科技不怕问', 'TMT解码', '所谓娱乐', '骂人宝典', '网络新闻联播',
          '今日看点',
          '碉民早爆',
          '8点1氪',
        ]
      }
    };
    News.page(cmd, page, function (err, currentPage, pages, result) {
      if (! err) {
        callback(null, {currentPage: currentPage, pages: pages, newss: result});
      } else {
        callback(err);
      }
    });
  };

  var getLatestNews = function (callback) {
    News.findLimit({tags: {'$in': ['轻松一刻', '神吐槽', 'FUN来了', '新闻晚8点', '新闻哥']}}, 4, {time: -1}, function (err, result) {
      if (! err) {
        callback(null, {result: result});
      } else {
        callback(err);
      }
    });
  };

  var getLatestBeauties = function (callback) {
    News.findLimit({tags: {'$in': ['妹子图', '妹子控', 'Show妹子']}}, 4, {time: -1}, function (err, result) {
      if (! err) {
        callback(null, {result: result});
      } else {
        callback(err);
      }
    });
  };

  var getLatestGifs = function (callback) {
    News.findLimit({tags: {'$in': ['gif怪兽', '爆笑gif图', '图片.趣图']}}, 4, {time: -1}, function (err, result) {
      if (! err) {
        callback(null, {result: result});
      } else {
        callback(err);
      }
    });
  };

  var getLatestVideos = function (callback) {
    News.findLimit({hasVideo: {$exists: 1}}, 4, {time: -1}, function (err, result) {
      if (! err) {
        callback(null, {result: result});
      } else {
        callback(err);
      }
    });
  };

  var getRandomImages = function (callback) {
    var rand = Math.random();
    var query = {
      site:{'$in': ['xgmn', 'mnbqg']},
      tags: {"$in":['一日一美女', '美空精选', '香车美女', '农家妹妹', '日韩美女', '古典美女', '果子MM']},
      random:{"$gte":rand},
    };
    Image.findLimit(query, 5, function (err, result) {
      if (! err) {
        callback(null, {randomImages: result});
      } else {
        callback(err);
      }
    });
  };

  async.parallel({
    newss: getNewss,
    latestNews: getLatestNews,
    latestBeauties: getLatestBeauties,
    latestGifs: getLatestGifs,
    latestVideos: getLatestVideos,
    //getRandomImages: getRandomImages,
  },
  function (err, results) {
    if (! err) {
      res.render('home', {pageTitle: '看点网---有看点，更精彩！',
        currentPage: results.newss.currentPage, pages: results.newss.pages,
        news: results.newss.newss, baseUrl: '/page/',
        isHomePage: (page == 1),
        latestNews: results.latestNews.result,
        latestBeauties: results.latestBeauties.result,
        latestGifs: results.latestGifs.result,
        latestVideos: results.latestVideos.result,
        //randomImages: results.getRandomImages.randomImages,
      });
    } else {
      next(new Error(err.message));
    }
  });

};

var about = function (req, res, next) {
  res.render('about', {pageTitle: '关于', active: 'about'});
};

var sitemap = function (req, res, next) {
  res.render('sitemap', {pageTitle: '站点地图'});
};

var viewNews = function (req, res, next) {
  var cmd = {"docid": req.params.docid};
  var decode_id = utils.decodeDocID(req.params.docid);
  if (decode_id == req.params.docid) {
    cmd = {
      "docid": {
        "$in": [
          req.params.docid,
          utils.encodeDocID("netease", req.params.docid),
          utils.encodeDocID("sohu", req.params.docid),
          utils.encodeDocID("sina", req.params.docid),
          utils.encodeDocID("qq", req.params.docid),
          utils.encodeDocID("ifeng", req.params.docid),
          utils.encodeDocID("yoka", req.params.docid),
          utils.encodeDocID("36kr", req.params.docid)
        ]
      }
    };
  }else {
    cmd = {
      "docid": {
        "$in": [
          req.params.docid,
          decode_id
        ]
      }
    };
  }
  News.findOne(cmd, function (err, result) {
    if (!err) {
      if (result) {
        News.incViews({docid: result.docid}, {views: 1}, function (err4, result4) {
          if (err4) {
            // next(new Error(err4.message));
          }
        });

        News.findLimit({"site":result.site, "tags":result.tags, time: {$gt: result.time}}, 1, {time: 1}, function (err5, results5) {
          if (! err5) {
            News.findLimit({"site":result.site, "tags":result.tags, time: {$lt: result.time}}, 1, null, function (err6, results6) {
              if (! err6) {
                News.findLimit({"site":result.site, "tags":result.tags, time: {$lt: result.time}}, 4, null, function (err2, results2) {
                if (!err2) {
                  if (results2.length < 1) {
                    News.findLimit({"site":result.site, "tags":result.tags, time: {$gt: result.time}}, 4, null, function (err3, results3) {
                      if (!err3) {
                        res.render('view_news', {pageTitle: result.title, news: result,
                          relatedNews: results3, active: result.tags[0], prevNews: results5, nextNews: results6});
                      } else {
                        next(new Error(err3.message));
                      }
                    });
                  } else {
                    res.render('view_news', {pageTitle: result.title, news: result,
                      relatedNews: results2, active: result.tags[0], prevNews: results5, nextNews: results6});
                  }

                } else {
                  next(new Error(err2.message));
                }
              });
              } else {
                next(new Error(err6.message));
              }
            });
          } else {
            next(new Error(err5.message));
          }
        });
      } else {
        next();
      }
    } else {
      next(new Error(err.message));
    }
  });
};

exports.index = index;
exports.about = about;
exports.sitemap = sitemap;
exports.viewNews = viewNews;
