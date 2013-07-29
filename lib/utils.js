var crypto = require('crypto');
var _ = require("lodash");
var salt = require('config').Config.salt;
var util = require('util');
var jsdom = require("jsdom").jsdom;

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
  return util.format('<br/><a href="%s" target="_blank"><img class="lazy" alt="%s" src="/img/grey.gif" data-original="%s" /></a><noscript><img alt="%s" src="%s" /></noscript><br/>', src, alt, src, alt, src);
}

function genDigest(html) {
  //remove all html tag,
  //refer to <<How to remove HTML Tags from a string in Javascript>>
  //http://geekswithblogs.net/aghausman/archive/2008/10/30/how-to-remove-html-tags-from-a-string-in-javascript.aspx
  //and https://github.com/tmpvar/jsdom
  var maxDigest = 300;
  var window = jsdom().createWindow();
  var mydiv = window.document.createElement("div");
  mydiv.innerHTML = html;
  return mydiv.textContent.slice(0,maxDigest);
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
    "ifeng",
    "yoka",
    "36kr"
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

function qqSetTitle(summary) {
  if((!summary) || (!summary['tagName']) || (!summary['title'])) {
    return "";
  }

  if(summary['title'].indexOf(summary['tagName']) != -1) {
    return summary['title'];
  }else {
    return ("[" + summary['tagName'] + "]" + summary['title'])
  }
}

function genQqFindCmd(site, entry) {
  return {
    "$or":
      [
        {"docid": {"$in": [util.format("%s", entry['id']), encodeDocID(site, entry['id'])]}},
        {
          "tags": entry['tagName'],
          "title": entry['title'],
          "ptime": entry['time']
          //"link": {"$in": [entry["url"], entry["surl"], util.format("http://view.inews.qq.com/a/%s", entry['id'])]}
        }
      ]
  };
}

exports.ascii2HexStr = ascii2HexStr;
exports.hexStr2Ascii = hexStr2Ascii;
exports.genFindCmd = genFindCmd;
exports.genQqFindCmd = genQqFindCmd;
exports.encodeDocID = encodeDocID;
exports.decodeDocID = decodeDocID;
exports.genDigest = genDigest;