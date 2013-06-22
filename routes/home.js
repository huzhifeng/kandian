var async = require('async');
var News = require('../models/news');
var crawlerAll = require('../netease').crawlerAll;
var neteaseTags = require('config').Config.neteaseTags;
var sohuTags = require('config').Config.sohuTags;
var sinaTags = require('config').Config.sinaTags;
var qqTags = require('config').Config.qqTags;
var ifengTags = require('config').Config.ifengTags;
var hotQty = require('config').Config.hotQty;
var mergeDict = require('../lib/utils').mergeDict;
var decodeDocID = require('../lib/utils').decodeDocID;
var encodeDocID = require('../lib/utils').encodeDocID;

var tt = mergeDict(neteaseTags, sohuTags);
tt = mergeDict(tt, sinaTags);
tt = mergeDict(tt, qqTags);
tt = mergeDict(tt, ifengTags);

var index = function (req, res, next) {
  var getNewss = function (callback) {
    var page = req.params.page || 1;
    var cmd = {
      "$or":
        [
          {"site": {"$in": ["netease", "sohu"]}},
          {
            "site": "ifeng",
            "tags": {"$in":["FUN来了","今日最大声","有报天天读","凤凰知道","史说新语","百部穿影"]},
          }
        ]
    };//{"site":{"$nin":["qq"]}};
    News.page(cmd, page, function (err, currentPage, pages, result) {
      if (! err) {
        callback(null, {currentPage: currentPage, pages: pages, newss: result});
      } else {
        callback(err);
      }
    });
  };

  var getHotNewss = function (callback) {
    News.findLimit({}, hotQty, {views: -1}, function (err, result) {
      if (! err) {
        callback(null, {hotNewss: result});
      } else {
        callback(err);
      }
    });
  };

  async.parallel({
    newss: getNewss
    //hotNewss: getHotNewss
  },
  function (err, results) {
    if (! err) {
      // console.log(currentPage, pages);
      res.render('home', {pageTitle: '看点网---有看点，更精彩！',
        currentPage: results.newss.currentPage, pages: results.newss.pages,
        news: results.newss.newss, baseUrl: '/page/'/*,hotNews: results.hotNewss.hotNewss*/});
    } else {
      // console.log(err);
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

var wx = function (req, res, next) {
  res.render('wx', {pageTitle: '17轻松微信公众平台', active: 'wx'});
};

var get163All = function (req, res, next) {
  crawlerAll();
  res.send('ok');
};

var viewNews = function (req, res, next) {
  //console.log(req.params.docid);
  ///////////////////////
  var cmd = {"docid": req.params.docid};
  var decode_id = decodeDocID(req.params.docid);
  if(decode_id == req.params.docid) {
    cmd = {"docid": {"$in": [req.params.docid, encodeDocID("netease", req.params.docid), encodeDocID("sohu", req.params.docid), encodeDocID("sina", req.params.docid), encodeDocID("qq", req.params.docid), encodeDocID("ifeng", req.params.docid)]}};
  }else {
    cmd = {"docid": {"$in": [req.params.docid, decode_id]}};
  }
  News.findOne(cmd, function (err, result) {
    if (!err) {
      // console.log(result);
      if (result) {
        if (result.views && result.views > 0) {
          result.views += 1;
        } else {
          result.views = 2;
        }
        News.update({docid: result.docid}, {views: result.views}, function (err4, result4) {
          if (err4) {
            // console.log(err4);
            // next(new Error(err4.message));
          }
        });

        /////////////////
        News.findLimit({time: {$gt: result.time}}, 1, {time: 1}, function (err5, results5) {
          if (! err5) {
            News.findLimit({time: {$lt: result.time}}, 1, null, function (err6, results6) {
              if (! err6) {
                News.findLimit({time: {$lt: result.time}}, 4, null, function (err2, results2) {
                if (!err2) {
                  // console.log(results2);
                  if (results2.length < 1) {
                    News.findLimit({time: {$gt: result.time}}, 4, null, function (err3, results3) {
                      if (!err3) {
                        res.render('view_news', {pageTitle: result.title, news: result,
                          relatedNews: results3, active: tt[result.tags[0]], prevNews: results5, nextNews: results6});
                      } else {
                        // console.log(err3);
                        next(new Error(err3.message));
                      }
                    });
                  } else {
                    res.render('view_news', {pageTitle: result.title, news: result,
                      relatedNews: results2, active: tt[result.tags[0]], prevNews: results5, nextNews: results6});
                  }

                } else {
                  // console.log(err2);
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
      // console.log(err);
      next(new Error(err.message));
    }
  });
};

exports.index = index;
exports.about = about;
exports.sitemap = sitemap;
exports.wx = wx;

exports.get163All = get163All;
exports.viewNews = viewNews;
