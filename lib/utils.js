var crypto = require('crypto');

// var _ = require("underscore");
var _ = require("lodash");

// var salt = require('config').config.salt;
var salt = require('config').Config.salt;

exports.md5 = function (str) {
    return crypto.createHmac('sha1', salt).update(str).digest('hex');
};

exports.checkAuth = function (req, res, next) {
  if (!req.session.user) {
    res.redirect('/admin/login');
  } else {
    next();
  }
};

exports.tagFilter = function (tags) {
    return _.map(tags.replace('，', ',').split(','), function(tag) {return tag.trim();});
};

exports.site2name = function (site) {
  var names = {
    "netease":"网易",
    "sohu":"搜狐",
    "sina":"新浪",
  };
  
  if(names[site]) {
    return names[site];
  }
  else {
    return site;
  }
}
