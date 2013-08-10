var async = require('async');
var image = require('../models/image');

var index = function (req, res, next) {
  var getImages = function (callback) {
    var page = req.params.page || 1;
    var query = {site:'xgmn'};
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
  var query = {site:'xgmn', id: req.params.id};
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