var db = require('../db').db;
var limit = require('../config').limit;
var news = db.collection('news');
var fields = {"title":1, "docid":1, "cover":1, "time":1, "tags":1, "views":1, "digest":1};

exports.page = function (query, page, callback) {
  news.count(query, function (err, count) {
    if (!err) {
      var maxPage = Math.ceil(count / limit);
      if (maxPage === 0) {
        callback(null, null, null, []);
        return;
      }

      var currentPage = parseInt(Number(page) || 1, 10);
      currentPage = currentPage  < 1 ? 1 : currentPage;
      currentPage = currentPage > maxPage ? maxPage : currentPage;

      var skipFrom = (currentPage - 1) * limit;

      news.find(query, fields).sort({time: -1}).skip(skipFrom).limit(limit).toArray(function (err, result) {
        if (!err) {
          callback(err, currentPage, maxPage, result);
        } else {
          callback(err, null, null, []);
        }
      });
    } else {
      callback(err, null, null, []);
    }
  });
};

exports.insert = function (obj, callback) {
  news.insert(obj, function (err, result) {
    callback(err, null);
  });
};

exports.get = function (id, callback) {
  news.findById(id, function (err, result) {
    callback(err, result);
  });
};

exports.findOne = function (query, callback) {
  news.findOne(query, function (err, result) {
    callback(err, result);
  });
};

exports.findLimit = function (query, limit, sort, callback) {
  sort = sort ? sort : {time: -1};
  news.find(query, fields).sort(sort).limit(limit).toArray(function (err, result) {
    callback(err, result);
  });
};


exports.all = function (callback) {
  news.find().sort({time: -1}).toArray(function (err, result) {
    callback(err, result);
  });
};

exports.update = function (query, doc, callback) {
  news.update(query, doc, function (err, result) {
    callback(err, result);
  });
};

exports.incViews = function (query, doc, callback) {
  news.update(query, {$inc: doc}, function (err, result) {
    callback(err, result);
  });
};

exports.del = function (query, callback) {
  news.remove(query, function (err, result) {
      callback(err, result);
  });
};
