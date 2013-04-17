
/*
 * home page.
 */
var util = require('util');
var RSS = require('rss');

var News = require('../models/news');
var CONFIG = require('config').Config;


var index = function (req, res, next) {
  var feed = new RSS({
    title: CONFIG.siteName,
    description: '看点,精挑细选,必须好看!',
    feed_url: 'http://kandian.huzhifeng.com/rss',
    site_url: 'http://kandian.huzhifeng.com',
    image_url: 'http://kandian.huzhifeng.com/img/kandian.png'
    // author: 'Dylan Greene'
  });

  /* loop over data and add to feed */
  News.findLimit({}, CONFIG.maxRssItems, null, function (err, newss) {
    if (! err) {
      newss.forEach(function (news) {
        var title = news.title;
        var docid = news.docid;
        var digest = util.format('<p><img src="%s" alt="%s" /></p><p>%s ...</p>',
          (news.cover || 'http://kandian.huzhifeng.com/img/noImg.gif'), title, news.digest);
        feed.item({
          title: news.title,
          description: digest,
          url: 'http://kandian.huzhifeng.com/news/' + docid, // link to the item
          date: news.ptime // any format that js Date can parse.
        });
      });

      res.set('Content-Type', 'application/xml');
      return res.send(feed.xml());
    } else {
      next(new Error(err.message));
    }
  });

};

exports.index = index;