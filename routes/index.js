var home = require('./home');
var tag = require('./tag');
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
  app.get('/tag/:tag', tag.index);
  app.get('/tag/:tag/page/:page', tag.index);
  app.get('/site/:site', site.index);
  app.get('/site/:site/page/:page', site.index);
  app.get('/category/:category', category.index);
  app.get('/category/:category/page/:page', category.index);
  app.get('/image/', rt_image.index);
  app.get('/image/page/:page', rt_image.index);
  app.get('/image/:id', rt_image.viewImage);
};