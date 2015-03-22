var util = require('util');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var _ = require('underscore');
var moment = require('moment');
var cheerio = require('cheerio');
var config = require('../config');
var utils = require('../lib/utils');
var logger = require('../logger');
var db = require('../db').db;
var bdMusic = db.collection('bdMusic');
var crawlFlag = config.crawlFlag;
var updateFlag = config.updateFlag;
var headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.124 Safari/537.36',
  'Host': 'music.baidu.com',
  'Connection': 'Keep-Alive',
};
var site = 'baidumusic';
var subscriptions = [
  //{tname: '军旅歌曲', tid: 'tag', tags: []},
  //{tname: '经典老歌', tid: 'tag', tags: []},
  //{tname: '广场舞', tid: 'tag', tags: []},
  //{tname: '成名曲', tid: 'tag', tags: []},
  //{tname: '酒吧', tid: 'tag', tags: []},
  {tname: '武侠', tid: 'tag', tags: []},
  //{tname: '红歌', tid: 'tag', tags: []},
  //{tname: 'dayhot', tid: 'top', tags: []}, // 热歌榜
  //{tname: 'huayu', tid: 'top', tags: []}, // 华语金曲榜
  //{tname: '新歌榜月榜', tid: 'month', tags: []},
  //{tname: '新歌榜周榜', tid: 'week', tags: []},
  //{tname: '新歌榜日榜', tid: 'day', tags: []},
];

var crawlerEvent = new EventEmitter();
crawlerEvent.on('onDetail', function (entry) {
  fetchDetail(entry);
});

var fetchDetail = function(entry) {
  var ids = entry.ids.join(',');
  var url = util.format('http://play.baidu.com/data/music/songlink?songIds=%s', ids);
  var req = {
    uri: url,
    method: 'GET',
    headers: headers
  };
  if (config.proxyEnable) {
    req.proxy = config.proxyUrl;
  }
  request(req, function (err, res, body) {
    if (!_.isString(body) || _.isEmpty(body)) {
      logger.warn('Invalid body in %s', url);
      return;
    }
    var json = utils.parseJSON(err, res, body);
    if (!json ||
        !utils.hasKeys(json, ['data', 'errorCode']) ||
        (json.errorCode != 22000) ||
        !_.has(json.data, 'songList')) {
      logger.warn('Invalid json data %j in %s', url);
      return;
    }
    var songList = json.data.songList;
    if (!_.isArray(songList) || _.isEmpty(songList)) {
      logger.warn('Invalid songList %j in %s', songList, url);
      return;
    }
    var docs = [];
    _.each(songList, function(element, index, list) {
      if (utils.hasKeys(element, ['songId', 'songName', 'artistName', 'songLink'])) {
        if (!_.isString(element.songLink) || _.isEmpty(element.songLink)) {
          logger.warn('Invalid song %j in %s', element, url);
          return;
        }
        var songLink = element.songLink;
        var end = element.songLink.indexOf('&src=');
        if (end !== -1) {
          songLink = songLink.slice(0, end);
        }
        var songName = util.format('%s-%s.mp3', element.songName, element.artistName);
        if (songName.indexOf(' ') !== -1) {
          songName = util.format('"%s-%s.mp3"', element.songName, element.artistName);
        }
        var downloadMp3 = util.format('wget %s -O %s', songLink, songName);
        console.log(downloadMp3);
        element.downloadMp3 = downloadMp3;
        if (_.isString(element.lrcLink) && !_.isEmpty(element.lrcLink)) {
            element.lrc = element.lrcLink;
            if (element.lrcLink.indexOf('http://') !== 0) {
                element.lrc = 'http://music.baidu.com' + element.lrcLink;
            }
            downloadLrc =  util.format('wget %s -O %s', element.lrc, songName.replace('.mp3', '.lrc'));
            element.downloadLrc = downloadLrc;
            console.log(downloadLrc);
        }
        element.tname = entry.tname;
        docs.push(element);
      } else {
        logger.warn('Invalid song %j in %s', element, url);
        return;
      }
    });

    if (!_.isEmpty(docs)) {
      bdMusic.insert(docs, {ContinueOnError: true}, function(err, result) {
        if (err) {
          logger.warn('Insert error: %j', err);
          return;
        }
      });
    }
  });
};

var fetchSubscription = function (entry) {
  var url = '';
  var now = moment();
  if (entry.tid === 'tag') {
    url = util.format('http://music.baidu.com/tag/%s?start=%d&size=%d', entry.tname, (entry.page - 1) * entry.pageSize, entry.pageSize);
  } else if (entry.tid === 'top') {
    url = util.format('http://music.baidu.com/top/%s', entry.tname);
  } else if (entry.tid === 'month') {
    var t = now.subtract(entry.page, 'months');
    url = util.format('http://music.baidu.com/top/new/month/%s', t.format('YYYY-MM'));
  } else if (entry.tid === 'week') {
    var t = now.subtract(entry.page, 'weeks');
    url = util.format('http://music.baidu.com/top/new/week/%s', t.format('YYYY-WW'));
  } else if (entry.tid === 'day') {
    var t = now.subtract(entry.page, 'days');
    url = util.format('http://music.baidu.com/top/new/day/%s', t.format('YYYY-MM-DD'));
  } else {
    logger.warn('Unsupported');
    return;
  }
  var req = {
    uri: url,
    method: 'GET',
    headers: headers
  };
  if (config.proxyEnable) {
    req.proxy = config.proxyUrl;
  }
  request(req, function (err, res, body) {
    if (!_.isString(body) || _.isEmpty(body)) {
      logger.warn('Invalid body in %s', url);
      return;
    }

    var $ = cheerio.load(body);
    var li = $('.song-item-hook');
    if (_.isEmpty(li)) {
      logger.warn('Invalid song list in %s', url);
      return;
    }
    var ids = [];
    li.each(function(i, element) {
      if (!utils.hasKeys(element, ['type', 'name', 'attribs'])) {
        logger.warn('Invalid song in %s', url);
        return;
      }
      if (element.type !== 'tag' || element.name !== 'li' || !_.has(element.attribs, 'data-songitem')) {
        logger.warn('Invalid song in %s', url);
        return;
      }
      var obj = JSON.parse(element.attribs['data-songitem']);
      if (_.has(obj, 'songItem') && _.has(obj.songItem, 'sid')) {
        ids.push(parseInt(obj.songItem.sid, 10));
      }
    });
    if (!_.isEmpty(ids)) {
      bdMusic.find({songId: {$in: ids}}, {songId: 1, _id: 0}).toArray(function (err, result) {
        if (err) {
          logger.warn('Find error: %j', err);
          return;
        }
        var existIds = _.map(result, function(element) {
          return element.songId;
        });
        var newIds = _.difference(ids, existIds);
        logger.log('Find %j result is %j, existIds is %j, newIds is %j', ids, result, existIds, newIds);
        if (!_.isEmpty(newIds)) {
          crawlerEvent.emit('onDetail', {ids: newIds, tname: entry.tname});
        }
      });
    }
    if (entry.crawlFlag) {
      if (li.length === entry.pageSize) {
        entry.page += 1;
        if (entry.tid === 'tag' || entry.page <= 12) {
          logger.info('[%s] next page: %d', entry.tname, entry.page);
          setTimeout(fetchSubscription, 3000, entry);
        } else {
          entry.crawlFlag = 0;
        }
      }else {
        logger.info('[%s] last page: %d', entry.tname, entry.page);
        entry.crawlFlag = 0;
      }
    }
  });
};

var fetchSubscriptions = function () {
  _.each(subscriptions, function(element, index, list) {
    if (element.stopped && !element.crawlFlag) {
      return;
    }
    element.page = 1;
    if (element.tid === 'tag') {
      element.pageSize = 25;
    } else if (element.tid === 'top') {
      element.pageSize = element.tname === 'dayhot' ? 500 : 100;
      element.crawlFlag = 0;
    } else if (element.tid === 'day') {
      element.pageSize = 100;
    } else {
      element.pageSize = 20;
    }
    setTimeout(fetchSubscription, index * 3000, element);
  });
}

var main = function() {
  logger.log('Start');
  _.each(subscriptions, function(element, index, list) {
    element.crawlFlag = crawlFlag;
  });
  crawlFlag = 0;
  fetchSubscriptions();
  setTimeout(main, config.crawlInterval);
}

if (require.main === module) {
  main();
}

exports.main = main;
exports.subscriptions = subscriptions;
