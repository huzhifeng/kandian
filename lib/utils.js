var crypto = require('crypto');
var _ = require("lodash");
var salt = require('config').Config.salt;
var util = require('util');

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
    "qq":"腾讯",
    "ifeng":"凤凰",
  };
  
  if(names[site]) {
    return names[site];
  }
  else {
    return site;
  }
}

exports.mergeDict = function (obj1,obj2) {
  var obj3 = {};
  for(var attrname in obj1) {
    obj3[attrname] = obj1[attrname];
  }
  for(var attrname in obj2) {
    obj3[attrname] = obj2[attrname];
  }
  return obj3;
};

exports.genLazyLoadHtml = function (alt, src) {
  return util.format('<br/><img class="lazy" alt="%s" src="/img/grey.gif" data-original="%s" /><noscript><img alt="%s" src="%s" /></noscript><br/>', alt, src, alt, src);
}
