var util = require('util');
var _ = require('underscore');
var jsdom = require('jsdom').jsdom;
var logger = require('../logger');

exports.parseJSON = function(err, res, body) {
  var json = null;
  if (err) {
    logger.warn('err: %j', err);
    return null;
  }
  if (res && _.has(res, 'statusCode') && res.statusCode != 200) {
    logger.warn('statusCode: %j', res.statusCode);
    return null;
  }
  if (!body) {
    logger.warn('Invalid body: %j', body);
    return null;
  }
  try {
    json = JSON.parse(body);
  }
  catch (e) {
    logger.warn('catch error: %j', e);
  }
  return json;
}

exports.hasKeys = function(obj, keys) {
  var len = keys.length;
  for (var i = 0; i < len; i++) {
    if (!_.has(obj, keys[i])) {
      logger.log('Key %s is missing', keys[i]);
      return false;
    }
  }
  return true;
}

exports.isAudioVideoExt = function(url) {
  var validExts = ['mp4', 'mp3'];
  var ext = url.split('.').pop();
  if (_.indexOf(validExts, ext) == -1) {
    logger.info('Invalid Audio/Video url: %s', url);
    return false;
  } else {
    return true;
  }
}

exports.findTagName = function(buf, entry) {
  var len = entry.tags.length;
  if (len) {
    for (var i = 0; i < len; i++) {
      if (buf.indexOf(entry.tags[i]) !== -1) {
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
    'netease': '网易',
    'sohu': '搜狐',
    'sina': '新浪',
    'qq': '腾讯',
    'ifeng': '凤凰',
  };

  if (_.has(names, site)) {
    return names[site];
  }
  else {
    return site;
  }
}

function genLazyLoadHtml(alt, src) {
  return util.format('<br/><img class="lazy" alt="%s" src="/img/grey.gif" data-original="%s" />' +
    '<noscript><img alt="%s" src="%s" /></noscript><br/>', alt, src, alt, src);
}
exports.genLazyLoadHtml = genLazyLoadHtml;

exports.html2LazyLoad = function(s) {
  var html = '';
  var pattern = new RegExp('<img.+?src=[\'\"]http(?!http).+?[\'\"].+?\\/>', 'g');

  if (!_.isString(s) || !s.length) {
    logger.log('Invalid input string %j', s);
    return '';
  }

  html = s.replace(pattern, function(img) {
    var document = jsdom(img);
    var e = document.getElementsByTagName('img');
    var src = e[0].getAttribute('src');
    var alt = e[0].getAttribute('alt') || '';
    return genLazyLoadHtml(alt, src);
  });

  return html;
}

exports.genJwPlayerEmbedCode = function (id, file, image, play) {
  var autostart = play ? 'true' : 'false';
  return util.format('<br/><div id="%s">Loading the player...</div>' +
    '<script type="text/javascript" src="/js/jwplayer/jwplayer.js"></script>' +
    '<script type="text/javascript">jwplayer("%s").setup(' +
    '{file: "%s",image: "%s",autostart: %s});' +
    '</script><br/>', id, id, file, image, autostart);
}

exports.genDigest = function(html) {
  //remove all html tag,
  //refer to <<How to remove HTML Tags from a string in Javascript>>
  //http://geekswithblogs.net/aghausman/archive/2008/10/30/how-to-remove-html-tags-from-a-string-in-javascript.aspx
  //and https://github.com/tmpvar/jsdom
  var maxDigest = 300;
  var window = jsdom().createWindow();
  var myDiv = window.document.createElement('div');
  myDiv.innerHTML = html;
  return myDiv.textContent.slice(0, maxDigest);
}

function ascii2HexStr(s) {
  var hexStr = '';
  var code = 0;

  for (var i = 0; i < s.length; i++) {
    code = s.charCodeAt(i);
    hexStr += code.toString(16);
  }

  return hexStr;
}

function hexStr2Ascii(s) {
  var hex = '';
  var asciiStr = '';

  for (var i = 0; i < s.length; i = i + 2) {
    hex = parseInt(s.substr(i, 2), 16);
    asciiStr += String.fromCharCode(hex);
  }

  return asciiStr;
}

function encodeDocID(site, id) {
  return ascii2HexStr(util.format('%s_%s', site, id));
}
exports.encodeDocID = encodeDocID;

exports.decodeDocID = function(id) {
  var sites = [
    'netease',
    'sohu',
    'sina',
    'qq',
    'ifeng',
    'yoka',
    '36kr'
  ];
  var prefix = '';
  var rest = '';
  var newsID = id;

  for (var i = 0; i < sites.length; i++) {
    prefix = ascii2HexStr(sites[i] + '_');
    if (id.indexOf(prefix) === 0) {
      rest = id.substring(prefix.length);
      newsID = hexStr2Ascii(rest);
      break;
    }
  }

  return newsID;
}

exports.genFindCmd = function(site, id) {
  return {
    'docid': {
      '$in': [
        util.format('%s', id),
        encodeDocID(site, id)
      ]
    }
  };
}
