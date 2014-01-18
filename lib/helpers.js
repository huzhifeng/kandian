var moment = require('moment');
var _ = require("lodash");
var hbs = require('express-hbs');

exports.dateFormat = function(d) {
  if(!d) {
    return "Unknown"
  }
  return moment(d).format('YYYY-MM-DD');
};

exports.timeFormat = function(d) {
  if(!d) {
    return "Unknown"
  }
  return moment(d).format('YYYY-MM-DD HH:mm:ss');
};

exports.miniImg = function (link, size) {
  var s = typeof size === 'string' ? size : '170x220';
  if (link) {
    return 'http://s.cimg.163.com/i/' + link.replace('http://', '') + '.' + s + '.auto.jpg';
  } else {
    return '/img/noImg.gif';
  }
};

exports.newsDigest = function(s) {
  return s.slice(0, 80);
};

exports.imageEntry2Html = function(obj) {
  var html = '';
  var i = 0;
  html += '<div class="page-header"><h2>'+obj.alt+' [共'+obj.num+'张]</h2></div>';
  for(i=0; i<obj.num; i++) {
    html += '<a href="'+obj.originalImgs[i]+'" target="_blank">';
    html += '<img class="lazy" src="/img/grey.gif" data-original="'+obj.middleImgs[i]+'" alt="'+obj.alt+'" title="猛戳查看高清大图">';
    html += '</a>';
  }
  return new hbs.SafeString(html);
};

exports.urlEncode = function (q) {
  return encodeURIComponent(q);
};

exports.tags2sitemap = function (type) {
  var html = '';
  var neteaseTags = require('../crawler/netease').neteaseTags
  var sohuTags = require('../crawler/sohu').sohuTags
  var ifengTags = require('../crawler/ifeng').ifengTags
  var sinaTags = require('../crawler/sina').sinaTags
  var qqTags = require('../crawler/qq').qqTags
  var sitemap = [ // Site Name, Url, Tags
    ["网易", "/site/netease", neteaseTags],
    ["搜狐", "/site/sohu", sohuTags],
    ["凤凰", "/site/ifeng", ifengTags],
    ["新浪", "/site/sina", sinaTags],
    ["腾讯", "/site/qq", qqTags],
  ];
  var i = 0, j = 0, k = 0;

  for(i=0; i<sitemap.length; i++) {
    html += '<h1><a href="'+sitemap[i][1]+'" target="_blank">'+sitemap[i][0]+'栏目</a></h1>';
    html += '<ul>';
    for(j=0; j<sitemap[i][2].length; j++) {
      var entry = sitemap[i][2][j];
      if(entry.tags.length) {
        for(k=0; k<entry.tags.length; k++) {
          html += '<li><a href="/tag/'+entry.tags[k]+'" target="_blank">'+entry.tags[k]+'</a></li>';
        }
      }else {
        html += '<li><a href="/tag/'+entry.tname+'" target="_blank">'+entry.tname+'</a></li>';
      }
    }
    html += '</ul>';
  }

  return new hbs.SafeString(html);
};

exports.pagination = function (baseUrl, p, tp) {
  if (tp > 1 && p <= tp) {
    var pStart = p - 2 > 0 ? p - 2 : 1;
    var pEnd = pStart + 4 >= tp ? tp : pStart + 4;
    var ret = '<ul>';
    ret += p === 1 ? '<li class="disabled"><a>«</a></li>' : '<li><a href="' + baseUrl + '1">«</a></li>';
    if (pStart > 1) {
      ret += '<li><a>...</a></li>';
    }
    ret += _.map(_.range(pStart, pEnd + 1), function (i) {
      if (p === i) {
        return '<li class="active"><a href="#">' + i + '</a></li>';
      } else {
        return '<li><a href="' + baseUrl + i + '">' + i + '</a></li>';
      }

    }).join("\n");
    if (pEnd < tp) {
      ret += '<li><a>...</a></li>';
    }
    ret += p === tp ? '<li class="disabled"><a>»</a></li>' : '<li><a href="' + baseUrl + tp + '">»</a></li>';
    return ret + '</ul>';
  } else {
    return '';
  }
};