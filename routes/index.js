var home = require('./home');
var node = require('./node');
var site = require('./site');
var category = require('./category');
var rss = require('./rss');
var rt_image = require('./rt_image');


exports = module.exports = function(app) {
  app.get('/', home.index);
  app.get('/rss', rss.index);
  app.get('/about', home.about);
  app.get('/sitemap', home.sitemap);
  app.get('/page/:page', home.index);
  app.get('/news', home.index);
  app.get('/news/:docid', home.viewNews);
  app.get('/tag/:tag', node.index);
  app.get('/tag/:tag/page/:page', node.index);
  app.get('/site/:site', site.index);
  app.get('/site/:site/page/:page', site.index);
  app.get('/category/:category', category.index);
  app.get('/category/:category/page/:page', category.index);
  app.get('/image/', rt_image.index);
  app.get('/image/page/:page', rt_image.index);
  app.get('/image/:id', rt_image.viewImage);
};