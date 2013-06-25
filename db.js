var mongojs = require('mongojs');

var generateMongoUrl = function(){
  obj = {};
  var vcap = process.env.VCAP_SERVICES;
  if (vcap) {
      obj = JSON.parse(vcap)['mongodb-1.8'][0]['credentials'];
  }

  obj.hostname = (obj.hostname || 'localhost');
  obj.port = (obj.port || 18888);
  obj.db = (obj.db || 'kandian');
  if (obj.username && obj.password) {
      return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
  } else {
      return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
  }
};

var dbUrl = generateMongoUrl();

exports.dbUrl = dbUrl;
exports.db = mongojs(dbUrl);