module.exports = {
  Config: {
    timezone: 'Asia/Shanghai',
    siteName: '看点网',
    cookieSecret: '#$%nnja5720',
    salt: '#$%%^^^',
    port: 8888,
    interval: 1000 * 60 * 20,
    staticMaxAge: 3600000 * 24 * 1,
    limit: 15,
    hotQty: 4,
    maxRssItems: 50,
    crawlFlag: 0, // 0: only one or few pages; 1: all pages
  },
};