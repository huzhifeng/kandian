var util = require('util');
var request = require('request');
var _ = require('underscore');
var moment = require('moment');
var config = require('../config');
var News = require('../models/news');
var utils = require('../lib/utils')
var logger = require('../logger');
var crawlFlag = config.crawlFlag;
var updateFlag = config.updateFlag;
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';
var headers = {
  'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.1.1; MI 2 MIUI/JLB34.0)',
  'Connection': 'Keep-Alive',
  'Host': 'www.wumii.com',
};
var meizituSubscribes = [
  // 首页
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&ord=TIME_DESC
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&pageMark=1389837304000&ord=TIME_DESC
  {tname:'妹子图', tid: 1, tags:[]},
  // 今日热门
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&ord=HOT_DESC
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=lRlNwXBT&pageMark=16&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=lRlNwXBT
  //{tname:'赤裸美体',   tid:'DZT9477x', tags:[]},
  //{tname:'喷血酥胸',   tid:'4Q4VCwNc', tags:[]},
  //{tname:'细腰美腿',   tid:'k4FzxUiV', tags:[]},
  //{tname:'性感迷人',   tid:'k6b4gfix', tags:[]},
  //{tname:'文艺小清新', tid:'beWc1Oxz', tags:[]},
  //{tname:'可爱萌妹子', tid:'GthH6PBu', tags:[]},
];
var meizicoSubscribes = [
  // 首页
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&ord=TIME_DESC
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&pageMark=1389319532394&ord=TIME_DESC
  {tname:'妹子控', tid: 1, tags:[]},
  // 今日热门
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&ord=HOT_DESC
  // http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3NxAQlet&pageMark=16&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=3NxAQlet
  //{tname:'人像摄影', tid:'5jcdQv34', tags:[]},
  //{tname:'性感美女', tid:'Q8HKvEE9', tags:[]},
  //{tname:'私摄影',   tid:'pmPSFneG', tags:[]},
  //{tname:'清纯妹子', tid:'a0X5mZbW', tags:[]},
  //{tname:'萌妹子',   tid:'czdwAHOY', tags:[]},
  //{tname:'网络妹子', tid:'lRf6YPoG', tags:[]},
  //{tname:'妹子语录', tid:'KPIfaMAy', tags:[]},
  //{tname:'未分类',   tid:'Y2WUdddM', tags:[]},
  //{tname:'微女郎',   tid:'ewa5UNb' , tags:[]},
  //{tname:'淘女郎'    tid:'oYU6BnyD', tags:[]},
];
// 2014/05 停止更新
var zeiniuSubscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=iJBlKweU&ord=TIME_DESC
  {tname:'贼牛网', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=iJBlKweU&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=iJBlKweU
  //{tname:'内涵图片', tid:'1OAvzFT', tags:[]},
  //{tname:'请叫我小纯洁', tid:'aEC0TO1h', tags:[]},
  //{tname:'邪恶漫画', tid:'DXUEjXxC', tags:[]},
  //{tname:'暴走漫画', tid:'1fqJP65H', tags:[]},
  //{tname:'经典网文', tid:'9G5kVx7', tags:[]},
  //{tname:'糗事精选', tid:'E2CtWauT', tags:[]},
  //{tname:'搞笑段子', tid:'4GHDXU', tags:[]},
  //{tname:'微小说', tid:'23kUQF6P', tags:[]},
  //{tname:'无厘网文', tid:'joNOiR5', tags:[]},
  //{tname:'雷人网事', tid:'oYBjB9o6', tags:[]},
  //{tname:'福利', tid:'aHMXG2ZG', tags:[]},
  //{tname:'床边的小混混全集', tid:'4Q2Ixhg', tags:[]},
  //{tname:'搞笑漫画', tid:'DXLzhBSg', tags:[]},
  //{tname:'寡妇三代', tid:'2AZ5slcG', tags:[]},
];
var hexiesheSubscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=Od0ZWlWj&ord=TIME_DESC
  {tname:'和邪社', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=Od0ZWlWj&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=Od0ZWlWj
  //{tname:'新闻资讯', tid:'4ZIEUkmN', tags:[]},
  //{tname:'宅腐文化', tid:'jZ2B2H46', tags:[]},
  //{tname:'和邪福利', tid:'tYk8FGK6', tags:[]},
  //{tname:'投票调查', tid:'FrI8alnq', tags:[]},
  //{tname:'广而告之', tid:'1mGbII3',  tags:[]},
  //{tname:'周边模型', tid:'190wB',    tags:[]},
  //{tname:'活动报道', tid:'p3AImWtO', tags:[]},
  //{tname:'IT数码',   tid:'CIrtenN',  tags:[]},
  //{tname:'音乐',     tid:'1KTe7qJE', tags:[]},
  //{tname:'图毒生灵', tid:'4SnX9Tt',  tags:[]},
  //{tname:'蛋痛囧文', tid:'FdbW3CP8', tags:[]},
  //{tname:'吐槽点评', tid:'Gmxh614',  tags:[]},
  //{tname:'壁纸图集', tid:'4Q2Bl31',  tags:[]},
  //{tname:'成人性趣', tid:'WY1xmx',   tags:[]},
  //{tname:'Cosplay',  tid:'lRAoM',    tags:[]},
  //{tname:'同人创作', tid:'DtntYeZ',  tags:[]},
  //{tname:'摄影写真', tid:'5KU30we',  tags:[]},
  //{tname:'声优',     tid:'jYSDlrwl', tags:[]},
  //{tname:'视频',     tid:'E2CuznV4', tags:[]},
  //{tname:'电影电视', tid:'MoqsY55',  tags:[]},
  //{tname:'话题讨论', tid:'k1jeYbEb', tags:[]},
  //{tname:'游戏',     tid:'2zKrT1Mb', tags:[]},
];
var timetimetimeSubscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=XWE4tnup&ord=TIME_DESC
  {tname:'阅读时间', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=XWE4tnup&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=XWE4tnup
  //{tname:'阅读生活', tid:'2w9C8fXQ', tags:[]},
  //{tname:'人物周刊', tid:'EjxBmlOF', tags:[]},
  //{tname:'另一面',   tid:'p9G85WV7', tags:[]},
  //{tname:'图说',     tid:'bvOdzEJ1', tags:[]},
  //{tname:'经典语录', tid:'2vbfKgWE', tags:[]},
  //{tname:'散文精选', tid:'1fJqrlKk', tags:[]},
  //{tname:'小故事',   tid:'DZ0CWWot', tags:[]},
  //{tname:'读好书',   tid:'9ZwAFMJI', tags:[]},
  //{tname:'生活派'    tid:'4ZJoi3gU', tags:[]},
];
// 无数据
var chaoyouhuoSubscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=rDp9Zfa2&ord=TIME_DESC
  {tname:'超诱惑', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=rDp9Zfa2&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=rDp9Zfa2
  //{tname:'日刊', tid:'beSFsRrq', tags:[]},
  //{tname:'特刊', tid:'DZ07wPlK', tags:[]},
  //{tname:'私房', tid:'uaAlQqQi', tags:[]},
  //{tname:'其他', tid:'do6nnnH', tags:[]},
];
// 2014/05 停止更新
var v7mmSubscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=f694tZZd&ord=TIME_DESC
  {tname:'7v美眉', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=f694tZZd&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=f694tZZd
  //{tname:'精选美女', tid:'vo3GP7es', tags:[]},
];
// 2014/06 停止更新
var showmeiziSubscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=aJqTfv3R&ord=TIME_DESC
  {tname:'Show妹子', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=aJqTfv3R&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=aJqTfv3R
  //{tname:'清纯唯美', tid:'2wtxx3ck', tags:[]},
  //{tname:'丝袜美腿', tid:'EPDN9mT',  tags:[]},
  //{tname:'性感美女', tid:'1rG8ZlMO', tags:[]},
  //{tname:'日韩美女', tid:'5VWzW7Mi', tags:[]},
  //{tname:'街拍美女', tid:'OOCXZUf',  tags:[]},
  //{tname:'动漫美女', tid:'vq08gous', tags:[]},
  //{tname:'美女写真', tid:'jZNbQC0K', tags:[]},
  //{tname:'日韩美女', tid:'lxQEAQK8', tags:[]},
  //{tname:'美女视频', tid:'6hNrL5Mh', tags:[]},
  //{tname:'写真',     tid:'YcmJ2fp',  tags:[]},];
];
var umeiSubscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=cO7x9i7y&ord=TIME_DESC
  {tname:'优美高清', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=cO7x9i7y&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=cO7x9i7y
  //{tname:'港台美女', tid:'iO7CW',    tags:[]},
  //{tname:'日韩美女', tid:'5CvG6ELC', tags:[]},
  //{tname:'国内美女', tid:'GVOSMHqw', tags:[]},
  //{tname:'欧美美女', tid:'2xhE3ioB', tags:[]},
  //{tname:'秀人VIP',  tid:'bvS36ds',  tags:[]},
  //{tname:'╧Здзцюе╝', tid:'6S1MRVLI', tags:[]},
  //{tname:'晩昆胆溺', tid:'XWGfAZgN', tags:[]},
  //{tname:'è?o??à??', tid:'e3LHlt1Q', tags:[]},
  //{tname:'倔繁VIP',  tid:'HMrgO9e',  tags:[]},
];
// 2014/02 停止更新
var mobudeSubscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3wwUfpKo&ord=TIME_DESC
  {tname:'女神来了', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3wwUfpKo&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=3wwUfpKo
  //{tname:'未分类', tid:'ODRShDPq', tags:[]},
  //{tname:'暂时未分类', tid:'5vWoIU44', tags:[]},
];
var wuxianbkSubscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=1rqVGhc&ord=TIME_DESC
  {tname:'无限福利', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=1rqVGhc&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=1rqVGhc
  //{tname:'宅男福利',         tid:'2RVdtOyi', tags:[]},
  //{tname:'国产性感美女图片', tid:'NCFCjRb',  tags:[]},
  //{tname:'日本美女图片',     tid:'3qVRKp9k', tags:[]},
  //{tname:'韩国美女图片',     tid:'6GWbB5r',  tags:[]},
  //{tname:'美女百科',         tid:'E0Dq0UNr', tags:[]},
  //{tname:'美女资讯',         tid:'3a11tQYH', tags:[]},
  //{tname:'娱乐',             tid:'a9ki9Fg9', tags:[]},
  //{tname:'资料夹',           tid:'27T0Gt75', tags:[]},
  //{tname:'日记本',           tid:'7uBsesaV', tags:[]},
];
// 2014/01 停止更新
var yunduoSubscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=FjHtYdHL&ord=TIME_DESC
  {tname:'云朵模特', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=FjHtYdHL&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=FjHtYdHL
  //{tname:'云朵模特', tid:'2yN76adG', tags:[]},
  //{tname:'云朵明星', tid:'tZQT4QTa', tags:[]},
  //{tname:'未分类', tid:'OBfxXryo', tags:[]},
  //{tname:'云朵学生', tid:'CVSgtLS', tags:[]},
];
var ameiSubscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3SvQmov6&ord=TIME_DESC
  {tname:'阿妹高清美女', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=3SvQmov6&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=3SvQmov6
  //{tname:'国内美女', tid:'tZIH77jo', tags:[]},
  //{tname:'日韩美女', tid:'vH5biHCf', tags:[]},
];
var mm33Subscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=GEmukg3G&ord=TIME_DESC
  {tname:'33mm美女图片', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=GEmukg3G&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=GEmukg3G
  //{tname:'清纯靓丽',     tid:'EkbB6nZm', tags:[]},
  //{tname:'丝袜美腿',     tid:'NZHT8XwX', tags:[]},
  //{tname:'唯美风景',     tid:'M7vXfEYe', tags:[]},
  //{tname:'惊艳模特',     tid:'ELw6Md3b', tags:[]},
  //{tname:'美女自拍',     tid:'YjI7np6U', tags:[]},
  //{tname:'明星美女',     tid:'1ftmyS1u', tags:[]},
  //{tname:'日韩美女',     tid:'404KSLil', tags:[]},
  //{tname:'社会百态',     tid:'2bV1o3rk', tags:[]},
  //{tname:'娱乐八卦',     tid:'ktdCPlWV', tags:[]},
  //{tname:'可爱动物',     tid:'4iR4Pp9n', tags:[]},
  //{tname:'美女壁纸',     tid:'JL5xRcMa', tags:[]},
  //{tname:'丝袜腿模套图', tid:'5am1mhn9', tags:[]},
  //{tname:'日韩美女套图', tid:'KhPoZdus', tags:[]},
  //{tname:'美女套图',     tid:'6Vmv6Gyy', tags:[]},
  //{tname:'网友分享',     tid:'7vziCSwV', tags:[]},
];
// 2014/08 请升级官方客户端
var jiecao8Subscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=ewdBdnG&ord=TIME_DESC
  {tname:'节操吧', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=ewdBdnG&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=ewdBdnG
  //{tname:'搞笑段子', tid:'jF3DOJx', tags:[]},
  //{tname:'爆笑GIF', tid:'kawFv2nj', tags:[]},
  //{tname:'吐槽字幕', tid:'4ZIJWQvh', tags:[]},
];
// 2014/02 停止更新
var lequhaSubscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=ExoT7VwB&ord=TIME_DESC
  {tname:'乐趣哈', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=ExoT7VwB&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=ExoT7VwB
  //{tname:'GIF搞笑动画', tid:'57jTfi5S', tags:[]},
  //{tname:'内涵图片', tid:'aLQ35s5Q', tags:[]},
  //{tname:'搞笑图片', tid:'br0qHdrp', tags:[]},
  //{tname:'搞笑漫画', tid:'6KUzm3Qg', tags:[]},
];
// 2014/02 停止更新
var hugao8Subscribes = [
  // 首页 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=PwwmW2tg&ord=TIME_DESC
  {tname:'搞笑吧', tid: 1, tags:[]},
  // 今日热门 http://www.wumii.com/app/mobile/auto/site/items?obSiteId=PwwmW2tg&ord=HOT_DESC
  //{tname:'今日热门', tid: 2, tags:[]},
  // 分类 http://www.wumii.com/app/mobile/auto/site/categories?obSiteId=PwwmW2tg
  //{tname':'搞笑gif',              tid:'lRbiNzth', tags:[]},
  //{tname':'搞笑图片',             tid:'YgiOZEAQ', tags:[]},
  //{tname':'邪恶图片',             tid:'9IqO8ld',  tags:[]},
  //{tname':'内涵漫画',             tid:'p8hwqOeR', tags:[]},
  //{tname':'精选视频',             tid:'1h6Z54Qh', tags:[]},
  //{tname':'雷人图片',             tid:'kSO6NPH',  tags:[]},
  //{tname':'内涵图',               tid:'akjfHXqb', tags:[]},
  //{tname':'搞笑网文',             tid:'1g1qCxq',  tags:[]},
  //{tname':'热门资讯',             tid:'lsQB1B2x', tags:[]},
  //{tname':'内涵笑话',             tid:'1ppv3FzV', tags:[]},
  //{tname':'爆笑图片',             tid:'CWpeXj4',  tags:[]},
  //{tname':'搞笑视频',             tid:'7x05Ev7x', tags:[]},
  //{tname':'恶搞图片',             tid:'mOlvfjut', tags:[]},
  //{tname':'色小组',               tid:'aLVAL6xT', tags:[]},
  //{tname':'找亮点图片',           tid:'jmtpzBv',  tags:[]},
  //{tname':'美女视频',             tid:'D2tBbCG',  tags:[]},
  //{tname':'美女图片',             tid:'YjD8xcR0', tags:[]},
  //{tname':'色系军团',             tid:'3WoaXIFV', tags:[]},
  //{tname':'杂乱无章',             tid:'2uWkDvjU', tags:[]},
  //{tname':'雷人视频',             tid:'7uzZp65J', tags:[]},
  //{tname':'国外视频',             tid:'KcUD2xWG', tags:[]},
  //{tname':'恶搞视频',             tid:'2CLhcZR1', tags:[]},
  //{tname':'柳岩',                 tid:'LuND81bT', tags:[]},
  //{tname':'重口味',               tid:'4ZWScrGA', tags:[]},
  //{tname':'暴走漫画',             tid:'37B8aV8s', tags:[]},
  //{tname':'龚玥菲',               tid:'akCXf1Z',  tags:[]},
  //{tname':'日本惊悚系列',         tid:'XWNj3ZNs', tags:[]},
  //{tname':'七公主漫画全集',       tid:'rD8Nqwmj', tags:[]},
  //{tname':'赵本山小品全集',       tid:'aiSPvZpO', tags:[]},
  //{tname':'陈佩斯朱时茂小品',     tid:'HGzQCTk',  tags:[]},
  //{tname':'冯巩小品全集高清',     tid:'QNeDjUwe', tags:[]},
  //{tname':'宋小宝小品全集',       tid:'MgaTR',    tags:[]},
  //{tname':'郭冬临小品大全',       tid:'2JGlVLU3', tags:[]},
  //{tname':'潘长江小品全集',       tid:'E2CwplwX', tags:[]},
  //{tname':'爆笑视频',             tid:'InlCdG8R', tags:[]},
  //{tname':'小沈阳小品全集',       tid:'a0Yig7G3', tags:[]},
  //{tname':'搞笑gif动态图片',      tid:'7x1VPMoq', tags:[]},
  //{tname':'重口味图片',           tid:'vhx1AQZm', tags:[]},
  //{tname':'国外搞笑视频',         tid:'jGb8vgZ',  tags:[]},
  //{tname':'小品搞笑大全',         tid:'5eRxG6HT', tags:[]},
  //{tname':'暴走大事件',           tid:'DZ0CXqTB', tags:[]},
  //{tname':'一千种死法,1000种死法',tid:'2KQiRVv',  tags:[]},
];
var crawlerSubscribe = function(entry) {
  var url = util.format('http://www.wumii.com/app/mobile/auto/site/items?obSiteId=%s%s&ord=%s%s',
                        entry.obSiteId,
                        entry.page === 0 ? '' : util.format('&pageMark=%s', entry.page),
                        (entry.tid === 2) ? 'HOT_DESC' : 'TIME_DESC',
                        ((entry.tid === 1) || (entry.tid === 2)) ? '' : util.format('&obCateId=%s', entry.tid));
  var req = {
    uri: url,
    method: 'GET',
    headers: headers
  };
  if (proxyEnable) {
    req.proxy = proxyUrl;
  }
  request(req, function (err, res, body) {
    var json = utils.parseJSON(err, res, body);
    if (!json || !_.has(json, 'readerModule') || !utils.hasKeys(json.readerModule, ['itemInfos', 'nextPageMark'])) {
      logger.warn('Invalid json data in %s', url);
      return;
    }
    var newsList = json.readerModule.itemInfos;
    if (!_.isArray(newsList) || _.isEmpty(newsList)) {
      logger.warn('Invalid newsList in %s', url);
      return;
    }
    newsList.forEach(function(newsEntry) {
      if (!utils.hasKeys(newsEntry, ['item', 'displayTime', 'obBigImageIds']) || !utils.hasKeys(newsEntry.item, ['id', 'metadata'])) {
        return;
      }
      if (!_.isArray(newsEntry.obBigImageIds) || _.isEmpty(newsEntry.obBigImageIds)) {
        logger.warn('Invalid body in %s', url);
        return;
      }
      newsEntry.tagName = utils.findTagName(newsEntry.item.metadata, entry);
      if (!newsEntry.tagName) {
        return;
      }
      News.findOne(utils.genFindCmd(entry.site, newsEntry.item.id), function(err, result) {
        if (err) {
          return;
        }
        newsEntry.updateFlag = 0;
        if (result) {
          if (updateFlag) {
            newsEntry.updateFlag = 1;
          } else {
            return;
          }
        }
        var obj = {};
        obj.docid = utils.encodeDocID(entry.site, newsEntry.item.id);
        obj.site = entry.site;
        obj.link = newsEntry.item.name || entry.website;
        obj.title = newsEntry.item.metadata;
        var t1 = moment(parseInt(newsEntry.displayTime, 10) * 1000);
        var t2 = moment(parseInt(newsEntry.item.creationTime, 10) * 1000);
        var ptime = t1.isValid() ? t1 : t2;
        if (!ptime.isValid()) {
          logger.warn('Invalid time in %s', url);
          return;
        }
        obj.time = ptime.toDate();
        obj.created = new Date();
        obj.views = newsEntry.updateFlag ? result.views : 1;
        obj.tags = newsEntry.tagName;
        obj.cover = newsEntry.item.thumbnailUrl;
        if (!obj.cover) {
          if (_.isArray(newsEntry.thumbnailUrls) && !_.isEmpty(newsEntry.thumbnailUrls)) {
            obj.cover = newsEntry.thumbnailUrls[0];
          }
        }
        obj.marked = newsEntry.item.metadata;
        newsEntry.obBigImageIds.forEach(function (imgId) {
          var src = util.format('http://www.wumii.com/app/mobile/image/%s.tmw_720?i=%s', imgId, newsEntry.item.id);
          obj.marked += utils.genLazyLoadHtml(newsEntry.item.metadata, src);
        });
        obj.digest = utils.genDigest(obj.marked);

        logger.log('[%s]%s, docid=[%s]->[%s],updateFlag=%d', obj.tags, obj.title, newsEntry.item.id, obj.docid, newsEntry.updateFlag);
        if (newsEntry.updateFlag) {
          News.update({docid: obj.docid}, obj, function (err, result) {
            if (err || !result) {
              logger.warn('update error: %j', err);
            }
          });
        } else {
          News.insert(obj, function (err, result) {
            if (err) {
              logger.warn('insert error: %j', err);
            }
          });
        }
      });
    });
    if (entry.crawlFlag) {
      if (newsList.length === entry.pageSize && json.readerModule.nextPageMark != -1) {
        entry.page = json.readerModule.nextPageMark;
        logger.info('[%s] next page: %d', entry.tname, entry.page);
        setTimeout(crawlerSubscribe, 3000, entry);
      }else {
        logger.info('[%s] last page: %d', entry.tname, entry.page);
        entry.crawlFlag = 0;
      }
    }
  });
}

var crawlerSubscribes = function() {
  var subscribes = meizituSubscribes.concat(meizicoSubscribes, umeiSubscribes, ameiSubscribes);
  subscribes.forEach(function(entry) {
    if (!crawlFlag && entry.stopped) {
      return;
    }
    entry.page = 0;
    entry.pageSize = 16;
    crawlerSubscribe(entry);
  });
}

var init = function() {
  if (process.argv[2] == 1) {
    crawlFlag = 1;
  }
  wumiiTags.forEach(function(entry) {
    entry.crawlFlag = crawlFlag;
  });
  meizituSubscribes.forEach(function(entry) {
    entry.obSiteId = 'lRlNwXBT';
    entry.site = 'meizitu';
    entry.website = 'http://www.meizitu.com';
  });
  meizicoSubscribes.forEach(function(entry) {
    entry.obSiteId = '3NxAQlet';
    entry.site = 'meizico';
    entry.website = 'http://www.meizico.com';
  });
  zeiniuSubscribes.forEach(function(entry) {
    entry.obSiteId = 'iJBlKweU';
    entry.site = 'zeiniu';
    entry.website = 'http://www.zei6.com';
  });
  hexiesheSubscribes.forEach(function(entry) {
    entry.obSiteId = 'Od0ZWlWj';
    entry.site = 'hexieshe';
    entry.website = 'http://www.hexieshe.com';
  });
  timetimetimeSubscribes.forEach(function(entry) {
    entry.obSiteId = 'XWE4tnup';
    entry.site = 'timetimetime';
    entry.website = 'http://timetimetime.net';
  });
  chaoyouhuoSubscribes.forEach(function(entry) {
    entry.obSiteId = 'rDp9Zfa2';
    entry.site = 'chaoyouhuo';
    entry.website = 'http://www.chaoyouhuo.com';
  });
  v7mmSubscribes.forEach(function(entry) {
    entry.obSiteId = 'f694tZZd';
    entry.site = '7vmm';
    entry.website = 'http://www.7vmm.com';
  });
  showmeiziSubscribes.forEach(function(entry) {
    entry.obSiteId = 'aJqTfv3R';
    entry.site = 'showmeizi';
    entry.website = 'http://www.showmeizi.com/';
  });
  umeiSubscribes.forEach(function(entry) {
    entry.obSiteId = 'cO7x9i7y';
    entry.site = 'umei';
    entry.website = 'http://www.umei.cc/';
  });
  mobudeSubscribes.forEach(function(entry) {
    entry.obSiteId = '3wwUfpKo';
    entry.site = 'mobude';
    entry.website = 'http://mobude.com/';
  });
  wuxianbkSubscribes.forEach(function(entry) {
    entry.obSiteId = '1rqVGhc';
    entry.site = 'wuxianbk';
    entry.website = 'http://wuxianbk.com/';
  });
  yunduoSubscribes.forEach(function(entry) {
    entry.obSiteId = 'FjHtYdHL';
    entry.site = 'yunduo';
    entry.website = 'http://yunduo.cc/';
  });
  ameiSubscribes.forEach(function(entry) {
    entry.obSiteId = '3SvQmov6';
    entry.site = 'amei';
    entry.website = 'http://www.amei.cc/';
  });
  mm33Subscribes.forEach(function(entry) {
    entry.obSiteId = 'GEmukg3G';
    entry.site = '33mm';
    entry.website = 'http://www.33mm.cc/';
  });
  jiecao8Subscribes.forEach(function(entry) {
    entry.obSiteId = 'ewdBdnG';
    entry.site = 'jiecao8';
    entry.website = 'http://jiecao8.net/';
  });
  lequhaSubscribes.forEach(function(entry) {
    entry.obSiteId = 'ExoT7VwB';
    entry.site = 'lequha';
    entry.website = 'http://www.lequha.com/';
  });
  hugao8Subscribes.forEach(function(entry) {
    entry.obSiteId = 'PwwmW2tg';
    entry.site = 'hugao8';
    entry.website = 'http://www.hugao8.com/';
  });
}

var main = function() {
  logger.log('Start');
  crawlerSubscribes();
  setTimeout(main, config.crawlInterval);
}

exports.main = main;
wumiiTags = meizituSubscribes.concat(meizicoSubscribes,zeiniuSubscribes,hexiesheSubscribes,timetimetimeSubscribes,chaoyouhuoSubscribes,v7mmSubscribes,showmeiziSubscribes,umeiSubscribes,mobudeSubscribes,wuxianbkSubscribes,yunduoSubscribes,ameiSubscribes,mm33Subscribes,jiecao8Subscribes,lequhaSubscribes,hugao8Subscribes);
init();
if (require.main === module) {
  main();
}
