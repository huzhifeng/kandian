var async = require('async');
var News = require('../models/news');
var hotQty = require('config').Config.hotQty;
var site2name = require('../lib/utils').site2name;

var index = function (req, res, next) {
  var site = req.params.site;

  var getNewss = function (callback) {
    var page = req.params.page || 1;
    News.page({site: site}, page, function (err, currentPage, pages, result) {
      if (! err) {
        callback(null, {currentPage: currentPage, pages: pages, newss: result});
      } else {
        callback(err);
      }
    });
  };
  var getHotNewss = function (callback) {
    News.findLimit({site: site}, hotQty, {views: -1}, function (err, result) {
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
      res.render('site', {pageTitle: site2name(site),
        currentPage: results.newss.currentPage, pages: results.newss.pages,
        news: results.newss.newss, site: site, active: site,
        baseUrl: '/site/' + encodeURIComponent(site) + '/page/'});
    } else {
      next(new Error(err.message));
    }
  });
};

exports.index = index;