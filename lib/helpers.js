var moment = require('moment');
var _ = require("lodash");
var hbs = require('express-hbs');
var sinaTags = require('config').Config.sinaTags;
var qqTags = require('config').Config.qqTags;
var mergeDict = require('../lib/utils').mergeDict;
var tt = mergeDict(sinaTags, qqTags);

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

exports.tag2c = function (tag) {
  return tt[tag] || '';
};

exports.tags2sitemap = function (type) {
  var html = '';
  var sitemap = [ // Site Name, Url, Tags
    ["新浪", "/site/sina", sinaTags],
    ["腾讯", "/site/qq", qqTags],
  ];
  var i = 0;

  if(type == "dropdown") {
    for(i=0; i<sitemap.length-2; i++) {
      html += '<li class="dropdown">';
      html += '<a href="#" class="dropdown-toggle" data-toggle="dropdown">' + sitemap[i][0] + '<b class="caret"></b></a>';
      html += '<ul class="dropdown-menu">';
      for(var key in sitemap[i][2]) {
        html += '<li id="'+sitemap[i][2][key]+'"><a href="/tag/'+key+'">'+key+'</a></li>';
      }
      html += '</ul>';
      html += '</li>';
    }
  }
  else {
    for(i=0; i<sitemap.length; i++) {
        html += '<h1><a href="'+sitemap[i][1]+'" target="_blank">'+sitemap[i][0]+'栏目</a></h1>';
        html += '<ul>';
        for(var key in sitemap[i][2]) {
            html += '<li id="'+sitemap[i][2][key]+'"><a href="/tag/'+key+'" target="_blank">'+key+'</a></li>';
        }
        html += '</ul>';
    }
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