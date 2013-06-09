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

function ascii2HexStr(s) {
  var hexStr = "";
  var i = 0;
  var code = 0;

  for(i=0; i<s.length; i++) {
    code = s.charCodeAt(i);
    hexStr += code.toString(16);
  }

  return hexStr;
}

function hexStr2Ascii(s) {
  var i = 0;
  var hex = "";
  var ascii_str = "";

  for(i=0; i<s.length; i=i+2) {
    hex = parseInt(s.substr(i,2), 16);
    ascii_str += String.fromCharCode(hex);
  }

  return ascii_str;
}

function encodeDocID(site, id) {
  return ascii2HexStr(util.format("%s_%s", site, id));
}

function decodeDocID(id) {
  var sites = [
    "netease",
    "sohu",
    "sina",
    "qq",
    "ifeng"
  ];
  var i = 0;
  var prefix = "";
  var rest = "";
  var new_id = id;
  
  for(i=0; i<sites.length; i++) {
    prefix = ascii2HexStr(sites[i]+"_");
    if(id.indexOf(prefix) == 0) { // match successfully
      rest = id.substring(prefix.length);
      new_id = hexStr2Ascii(rest);
      break;
    }
  }
  
  return new_id;
}

function genFindCmd(site, id) {
  return {"docid": {"$in": [util.format("%s", id), encodeDocID(site, id)]}};
}

exports.ascii2HexStr = ascii2HexStr;
exports.hexStr2Ascii = hexStr2Ascii;
exports.genFindCmd = genFindCmd;
exports.encodeDocID = encodeDocID;
exports.decodeDocID = decodeDocID;
