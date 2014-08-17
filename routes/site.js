var async = require('async');
var News = require('../models/news');
var utils = require('../lib/utils')

var index = function (req, res, next) {
  var site = req.params.site;

  var getNewss = function (callback) {
    var page = req.params.page || 1;
    News.page({site: site}, page, function (err, currentPage, pages, result) {
      if (! err) {
        callback(null, {
          currentPage: currentPage,
          pages: pages,
          newss: result
        });
      } else {
        callback(err);
      }
    });
  };

  async.parallel({
    newss: getNewss
  }, function (err, results) {
    if (! err) {
      res.render('site', {
        pageTitle: utils.site2name(site),
        currentPage: results.newss.currentPage,
        pages: results.newss.pages,
        news: results.newss.newss,
        site: site,
        active: site,
        baseUrl: '/site/' + encodeURIComponent(site) + '/page/'
      });
    } else {
      next(new Error(err.message));
    }
  });
};

exports.index = index;
