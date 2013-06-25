var util = require('util');
var db = require('./db').db;
var to_db = db.collection('news');
var from_db = db.collection('local0623');
var genFindCmd = require('./lib/utils').genFindCmd;

var mergeCollection = function(src, des) {
  src.find({}, function(err, result) {
    if(err) {
      console.log("mergeCollection():find in src error:"+err);
      return;
    }
    result.forEach(function(x) {
      //console.log("mergeCollection():forEach x="+util.inspect(x));
      des.findOne(genFindCmd(x.site, x.docid), function(err, result) {
        if(err) {
          console.log("mergeCollection():find in des error:"+err);
          return;
        }
        if(!result) {
          console.log(util.format("mergeCollection():need to be insert:site=%s,docid=%s,title=%s", x.site, x.docid, x.title));
          des.insert(x, function(err, result) {
            if(err) {
              console.log("mergeCollection():insert into des error:"+err);
              return;
            }
          });
        }else {
          console.log(util.format("mergeCollection():already exist:site=%s,docid=%s,title=%s", result.site, result.docid, result.title));
        }
      });
    });
  });
}

mergeCollection(from_db, to_db);


