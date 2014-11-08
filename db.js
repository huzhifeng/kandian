var util = require('util');
var mongojs = require('mongojs');
var config = require('./config');

var generateMongoUrl = function(){
  if (config.dbAuth) {
      return util.format('%s:%s@%s:%s/%s?authSource=admin', config.dbUsername, config.dbPassword, config.dbServer, config.dbPort, config.dbName);
  } else {
      return util.format('%s:%s/%s', config.dbServer, config.dbPort, config.dbName);
  }
};

exports.db = mongojs(generateMongoUrl());
