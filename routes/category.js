var async = require('async');
var News = require('../models/news');
var categoryTags = {
  'hot': [
    '轻松一刻',
    '今日之声',
    '新闻杂谈',
    '另一面',
    '先知道',
    '神吐槽',
    '热辣评',
    'FUN来了',
    '今日最大声',
    '有报天天读',
    '凤凰知道',
    '神最右',
    '新闻晚8点',
    '新闻哥',
    '今日话题',
  ],
  'photo': [
    '看客',
    '独家图集',
    '图粹',
    '图话',
    '活着',
    '存照',
    '中国人的一天',
  ],
  'beauty': [
    '妹子图',
    '妹子控',
    '超诱惑',
    '7v美眉',
    'Show妹子',
    '云朵模特',
    '女神来了',
    '阿妹高清美女',
    '搜狐美女',
    '清纯美女',
    '推软妹',
  ],
  'manhua': [
    '新闻漫画',
    '变态辣椒',
  ],
  'junshi': [
    '军情观察',
    '军事控',
    '军情茶馆',
    '讲武堂',
    '军魂100分',
  ],
  'wenshi': [
    '历史七日谈',
    '读写客',
    '微历史',
    '史说新语',
    '史林拍案',
  ],
  'yule': [
    '娱乐BigBang',
    '尖峰娱论',
    '明星皆为微博狂',
    '星大片',
    '谁八卦啊你八卦',
    '所谓娱乐',
  ],
  'fashion': [
    '穿衣奇葩货',
    '每日时髦不NG',
    '一周穿衣红榜',
    '星妆容红黑榜',
    '凡人观时尚',
    '时尚有意思',
  ],
  'film': [
    '百部穿影',
  ],
  'joke': [
    '视频.搞笑',
    '冷笑话精选',
    '微博搞笑',
    '我们爱讲冷笑话',
  ],
  'life': [
    '易百科',
    '健康365',
    '健康养生',
    '健康每一天',
    '生活家',
    '吃货大本营',
    '达人极品晒',
  ],
  'tech': [
    '科技万有瘾力',
    '8点1氪',
    '每日钛度',
    '科学现场调查',
    '数说IT',
    '创业说',
    '氪周刊',
    '氪月报',
    '今日嗅评',
    '虎嗅早报',
    '启示录',
    'TMT解码',
    '科技不怕问',
  ],
};

var index = function (req, res, next) {
  var category = req.params.category || 'hot';

  var getNewss = function (callback) {
    var page = req.params.page || 1;
    var query = {
      'tags': {
        '$in': categoryTags[category] || []
      }
    };
    if (category === 'video') {
      query = {hasVideo: {$exists: 1}};
    }
    News.page(query, page, function (err, currentPage, pages, result) {
      if (! err) {
        callback(null, {
          currentPage: currentPage,
          pages: pages,
          newss: result
        });
      } else {
        callback(err);
      }
    });
  };

  async.parallel({
    newss: getNewss
  }, function (err, results) {
    if (! err) {
      res.render('category', {
        pageTitle: category,
        currentPage: results.newss.currentPage,
        pages: results.newss.pages,
        news: results.newss.newss,
        category: category,
        active: category,
        baseUrl: '/category/' + encodeURIComponent(category) + '/page/'
      });
    } else {
      next(new Error(err.message));
    }
  });
};

exports.index = index;
