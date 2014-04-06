var crypto = require('crypto');
var _ = require("lodash");
var salt = require('config').Config.salt;
var util = require('util');
var jsdom = require("jsdom").jsdom;

exports.md5 = function (str) {
  return crypto.createHmac('sha1', salt).update(str).digest('hex');
};

function data2Json(err, res, body) {
  var json = {};
  if(err || (res.statusCode != 200) || (!body)) {
    console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():error");
    console.log(err);/*console.log(util.inspect(res));*/console.log(body);
    return 0;
  }
  try {
    json = JSON.parse(body);
  }
  catch (e) {
    console.log("hzfdbg file[" + __filename + "]" + " crawlerSubscribe():JSON.parse() catch error");
    console.log(e);
  }
  return json;
}

exports.tagFilter = function (tags) {
  return _.map(tags.replace('，', ',').split(','), function(tag) {return tag.trim();});
};

function findTagName(buf, entry) {
  var i = 0;
  if(entry.tags.length) {
    for(i=0; i<entry.tags.length; i++) {
      if(buf.indexOf(entry.tags[i]) !== -1) {
        return entry.tags[i];
      }
    }
  }else {
    return entry.tname;
  }
  return '';
}

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

exports.genJwPlayerEmbedCode = function (id, file, image, play) {
  var autostart = play ? "true":"false";
  return util.format('<br/><div id="%s">Loading the player...</div><script type="text/javascript" src="/js/jwplayer/jwplayer.js"></script><script type="text/javascript">jwplayer("%s").setup({file: "%s",image: "%s",autostart: %s});</script><br/>', id, id, file, image, autostart);
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

function timestamp2date(stamp) {
  var d = new Date(parseInt(stamp) * 1000);
  return d.toLocaleString().replace(/年|月/g, "-").replace(/日/g, " ");
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

exports.ascii2HexStr = ascii2HexStr;
exports.hexStr2Ascii = hexStr2Ascii;
exports.data2Json = data2Json;
exports.genFindCmd = genFindCmd;
exports.encodeDocID = encodeDocID;
exports.decodeDocID = decodeDocID;
exports.genDigest = genDigest;
exports.timestamp2date = timestamp2date;
exports.findTagName = findTagName;