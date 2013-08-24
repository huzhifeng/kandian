var async = require('async');
var image = require('../models/image');

var index = function (req, res, next) {
  var getImages = function (callback) {
    var page = req.params.page || 1;
    var query = {
      site:{'$in': ['xgmn', 'mnbqg']},
      tags: {"$in":['一日一美女', '美空精选', '香车美女', '农家妹妹', '日韩美女', '古典美女', '果子MM']},
    };
    image.page(query, page, function (err, currentPage, maxPage, result) {
      if (! err) {
        callback(null, {currentPage: currentPage, maxPage: maxPage, images: result});
      } else {
        callback(err);
      }
    });
  };

  async.parallel({
    getImagesResult: getImages
  },
  function (err, results) {
    if (! err) {
      res.render('image', {pageTitle: '美图-看点网',
        currentPage: results.getImagesResult.currentPage, pages: results.getImagesResult.maxPage,
        images: results.getImagesResult.images, baseUrl: '/image/page/'});
    } else {
      console.log("hzfdbg file[" + __filename + "]" + " index().parallel() err=" + err);
      next(new Error(err.message));
    }
  });
};

var viewImage = function (req, res, next) {
  var query = {site:{'$in': ['xgmn', 'mnbqg']}, imgid: req.params.id};
  image.findOne(query, function (err, result) {
    if (err) {
      console.log("hzfdbg file[" + __filename + "]" + " viewImage().findOne() err=" + err);
      next(new Error(err.message));
    }
    if (!result) {
      next();
    }else {
      res.render('view_image', {imageEntry:result});
    }
  }); // image.findOne
};

exports.index = index;
exports.viewImage = viewImage;