// Refer to https://github.com/dylang/node-rss
var util = require('util');
var RSS = require('rss');

var News = require('../models/news');
var CONFIG = require('config').Config;

var index = function (req, res, next) {
  var feed = new RSS({
    title: CONFIG.siteName,
    description: '看点---有看点，更精彩！网罗手机客户端精品栏目',
    feed_url: 'http://huzhifeng.com/rss',
    site_url: 'http://huzhifeng.com',
    image_url: 'http://huzhifeng.com/kandian.png',
    author: 'huzhifeng'
  });

  /* loop over data and add to feed */
  News.findLimit({}, CONFIG.maxRssItems, null, function (err, newss) {
    if (! err) {
      newss.forEach(function (news) {
        var title = news.title;
        var docid = news.docid;
        var digest = util.format('<p><img src="%s" alt="%s" /></p><p>%s ...</p>',
          (news.cover || 'http://huzhifeng.com/img/noImg.gif'), title, news.digest);
        feed.item({
          title: news.title,
          description: digest,
          url: 'http://huzhifeng.com/news/' + docid, // link to the item
          author: 'huzhifeng',
          date: news.ptime // any format that js Date can parse.
        });
      });//forEach

      res.set('Content-Type', 'application/xml');
      return res.send(feed.xml());
    } else {
      next(new Error(err.message));
    }
  });//News.findLimit
};

exports.index = index;