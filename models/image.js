var image = require('../db').db.collection('image');
var limit = 10;
var needInitIndex = 1;

var createEnsureIndex = function(sort) {
  console.log("hzfdbg file[" + __filename + "]" + " createEnsureIndex()");
  image.ensureIndex(sort, function(err, result) {
    if(err) {
      console.log("hzfdbg file[" + __filename + "]" + " createEnsureIndex().ensureIndex() err=" + err);
      return;
    }
  });
}

exports.findOne = function (query, callback) {
  image.findOne(query, function (err, result) {
    callback(err, result);
  });
};

exports.findLimit = function (query, limit, callback) {
  image.find(query).limit(limit).toArray(function (err, result) {
    callback(err, result);
  });
};

exports.insert = function (obj, callback) {
  image.insert(obj, function (err, result) {
    callback(err, null);
  });
};

exports.page = function (query, page, callback) {
  if(needInitIndex) {
    createEnsureIndex({time:1});
    needInitIndex = 0;
  }
  image.count (query, function(err, count) {
    if (err) {
      console.log("hzfdbg file[" + __filename + "]" + " page().count() err=" + err);
      callback(err, null, null, []);
      return;
    }
    var maxPage = Math.ceil(count / limit);

    if (maxPage === 0) {
      console.log("hzfdbg file[" + __filename + "]" + " page() maxPage=0");
      callback(null, null, null, []);
      return;
    }

    var currentPage = parseInt(Number(page) || 1);
    currentPage = currentPage  < 1 ? 1 : currentPage;
    currentPage = currentPage > maxPage ? maxPage : currentPage;

    var skipNum = (currentPage - 1) * limit;
    var fields = {"imgid":1, "id":1, "src":1, "alt":1, "num":1, "time":1, "tags":1};

    image.find(query, fields).sort({time:1}).skip(skipNum).limit(limit).toArray(function (err, result) {
      if (!err) {
        callback(err, currentPage, maxPage, result);
      } else {
        console.log("hzfdbg file[" + __filename + "]" + " page().count().find() err=" + err);
        callback(err, null, null, []);
      }
    }); // image.find
  }); // image.count
};