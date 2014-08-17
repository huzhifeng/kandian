var async = require('async');
var News = require('../models/news');

var index = function (req, res, next) {
  var tag = req.params.tag;

  var getNewss = function (callback) {
    var page = req.params.page || 1;
    News.page({tags: tag}, page, function (err, currentPage, pages, result) {
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
    newss: getNewss,
  }, function (err, results) {
    if (! err) {
      res.render('tag', {
        pageTitle: tag,
        currentPage: results.newss.currentPage,
        pages: results.newss.pages,
        news: results.newss.newss,
        tag: tag,
        active: tag,
        baseUrl: '/tag/' + encodeURIComponent(tag) + '/page/'
      });
    } else {
      next(new Error(err.message));
    }
  });
};

exports.index = index;
