var util = require('util');
var request = require('request');
//var fs = require('fs');
//var http = require('http-get');
var Image = require('./models/image');
var encodeDocID = require('./lib/utils').encodeDocID;
var data2Json = require('./lib/utils').data2Json;
var site = "xgmn";
var proxyEnable = 0;
var proxyUrl = 'http://127.0.0.1:7788';

var headers = {
  'Host': 'beautyimage.xicp.net',
  'Connection': 'Keep-Alive'
};

//http://beautyimage.xicp.net/web/beautyimage/APIV1_4_NewPay/Catalogue.php
var categorys = [
  {
  id: "28",
  name: "一日一美女",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_c26ccb01304b173ceba10a9dfa792d13.jpg",
  needCredit: "0",
  validTime: "1",
  maxpage: 5
  },
  {
  id: "1",
  name: "香车美女",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_7be076aa06c2c9c74fde9ad933b68d34.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 15
  },
  {
  id: "2",
  name: "性感美女",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_994ee48c79e8b3ecd3d73a9bc521988e.jpg",
  needCredit: "1",
  validTime: "1",
  maxpage: 27
  },
  {
  id: "3",
  name: "街拍美女",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_ff15eceac4ba45520e71dc3b4d0a6ace.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 24
  },
  {
  id: "4",
  name: "Cosplay",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_4b26448c900d594816f07eedce065b36.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 16
  },
  {
  id: "5",
  name: "农家妹妹",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_b9b60cf480ba2c9ca62c0d6f44a83a98.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 21
  },
  {
  id: "6",
  name: "日韩美女",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_877f501c5c9823de4fe07ca61ebf6702.jpg",
  needCredit: "0",
  validTime: "1",
  maxpage: 22
  },
  {
  id: "7",
  name: "欧美风情",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_9cffee8a7676a004978c681e0a631d2d.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 27
  },
  {
  id: "42",
  name: "古典美女",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_554246f950d2a13fe9f3f414c144b655.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 3
  },
  {
  id: "43",
  name: "动漫美女",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_94157d5075383112f8d68ca6e66a9863.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 4
  },
  {
  id: "9",
  name: "原味妖妖",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_a06bb04c1c2a59bfd444dfb6a99a44b6.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 7
  },
  {
  id: "10",
  name: "丝魅",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_f88865818dc4c93468f46843fdde7ccb.jpg",
  needCredit: "0",
  validTime: "1",
  maxpage: 12
  },
  {
  id: "11",
  name: "Rosi",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_e2e6ba0ea6d0104d5ec7d0b7e4cda1d1.jpg",
  needCredit: "3",
  validTime: "1",
  maxpage: 36
  },
  {
  id: "12",
  name: "风俗娘",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_839ae656ed40f2aba9a518967c477100.jpg",
  needCredit: "3",
  validTime: "1",
  maxpage: 7
  },
  {
  id: "13",
  name: "Beautyleg",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_f0bb732f3c023ba07588db0d56fd0f38.jpg",
  needCredit: "3",
  validTime: "1",
  maxpage: 49
  },
  {
  id: "14",
  name: "DISI第四印象",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_cbad6c01cbac7f661c11ffbb63fb2c85.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 7
  },
  {
  id: "15",
  name: "Leghacker",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_7f20fd0a38e7f0df12fcc215748dc49a.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 1
  },
  {
  id: "16",
  name: "PANS写真",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_490b6dcbfa1cb5faf1c58bfe8bca70bd.jpg",
  needCredit: "3",
  validTime: "1",
  maxpage: 7
  },
  {
  id: "17",
  name: "TPimage",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_93d4b3eeed72da9328e15fcb785197ba.jpg",
  needCredit: "5",
  validTime: "1",
  maxpage: 11
  },
  {
  id: "18",
  name: "波斯猫儿",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_8bcb7027edf76f991de37d0c9e74f768.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 4
  },
  {
  id: "19",
  name: "动感小站",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_5b134d95698168ce00e10aebd70ad332.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 12
  },
  {
  id: "20",
  name: "丝宝",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_0198615d0151038efea9faa3ee796535.jpg",
  needCredit: "0",
  validTime: "1",
  maxpage: 4
  },
  {
  id: "21",
  name: "丝间舞",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_968ed94f501e6210223b8099b48c57ee.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 5
  },
  {
  id: "22",
  name: "柔丝晴晴",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_1f126450e6cc43fe99930daf57da0bfd.jpg",
  needCredit: "0",
  validTime: "1",
  maxpage: 2
  },
  {
  id: "23",
  name: "丝尚Sityle",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_477f949c8b01fa9a33db7f3124b9683a.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 2
  },
  {
  id: "24",
  name: "ligui丽柜",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_6cbe08dd7f7e2e3963d8f806a302de00.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 62
  },
  {
  id: "25",
  name: "showgirl",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_f6304124a1ac3459e8b89d8df287bc22.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 5
  },
  {
  id: "26",
  name: "拍美VIP",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_4891c9ce7d9391cb627f959be22031bb.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 28
  },
  {
  id: "29",
  name: "STG丝图阁",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_18099c5fcb8e962520087a3ad2865042.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 4
  },
  {
  id: "30",
  name: "王朝贵足",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_442fea54d3e271e05788d1257da355bf.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 22
  },
  {
  id: "31",
  name: "上海炫彩时尚摄影沙龙",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_8eb9a16d0c87916ab3f7757c937cd3de.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 18
  },
  {
  id: "32",
  name: "RQ-STAR",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_894ba5fe99de3cb89b48fd71481ff2af.jpg",
  needCredit: "2",
  validTime: "1",
  maxpage: 21
  },
  {
  id: "33",
  name: "Hello! Project Digital Books",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_a26a1c78065eefa13ff22a608002daef.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 22
  },
  {
  id: "34",
  name: "Desktop Gal Collection(DGC)",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_750ec5bc0052cfd25856fd94b1f95f7e.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 21
  },
  {
  id: "35",
  name: "禁忌摄影Taboo-love(TyingArt)",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_0c09ead5af60fe2d47cdee15d0684502.jpg",
  needCredit: "3",
  validTime: "1",
  maxpage: 11
  },
  {
  id: "36",
  name: "NS Eyes",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_695e339f3f5c79fd74be1da57fd17a0b.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 25
  },
  {
  id: "37",
  name: "学院派私拍",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_99adabdac429ca7f9c6fffb0bfc6ee83.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 1
  },
  {
  id: "38",
  name: "For-side",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_9efd91bdaa159ce9153eb25b57cc8b6b.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 4
  },
  {
  id: "39",
  name: "@misty",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_8feb54e157f4e067799d85266ca49ea4.jpg",
  needCredit: "2",
  validTime: "1",
  maxpage: 8
  },
  {
  id: "40",
  name: "4K-STAR",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_c4d4a16d127468f2e0ded3351e347c8e.jpg",
  needCredit: "2",
  validTime: "1",
  maxpage: 2
  },
  {
  id: "41",
  name: "SYY神艺缘",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_caab9f04f8cefd635b8de88d6c890ea6.jpg",
  needCredit: "5",
  validTime: "1",
  maxpage: 6
  },
  {
  id: "44",
  name: "果子MM",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_a26e1a37dc5f9cff26da57dcf9bd4a79.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 5
  },
  {
  id: "45",
  name: "Wanibooks(WBGC)",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_ed53660d76f1835ddd0dc036d4716b4b.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 5
  },
  {
  id: "46",
  name: "YS Web（Young Sunday Visual WEB）",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_fc38e2818f3088a9ae002d8c66af8a33.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 6
  },
  {
  id: "47",
  name: "Bomb.tv",
  icon: "http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/catalogueIcons/_thumb_7ef0fce401c5dd6e137230370a7ed486.jpg",
  needCredit: "0",
  validTime: "0",
  maxpage: 9
  }
];
var crawlerCategory = function (entry) {
  var MAX_PAGE_NUM = 3;
  var page = 1;

  if(entry.first == 1) {
    entry.first = 0;
    MAX_PAGE_NUM = 1 + entry.maxpage;
  }
  for(page=1; page<=MAX_PAGE_NUM; page++) {
    (function(page) {
    //http://beautyimage.xicp.net/web/beautyimage/APIV1_4_NewPay/GetCataloguePictures.php?catalogueId=28&currentPage=1&pageSize=15
    //http://beautyimage.xicp.net/web/beautyimage/APIV1_4_NewPay/GetCataloguePictures.php?catalogueId=28&currentPage=2&pageSize=15
    var url = util.format('http://beautyimage.xicp.net/web/beautyimage/APIV1_4_NewPay/GetCataloguePictures.php?catalogueId=%d&currentPage=%d&pageSize=%d', entry.id, page, entry.pagesize);
    var req = {uri: url, method: "GET", headers: headers};
    if(proxyEnable) {
      req.proxy = proxyUrl;
    }
    request(req, function (err, res, body) {
      var json = data2Json(err, res, body);
      if(!json) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():JSON.parse() error");
        return;
      }
      var imageList = json.returnContent;
      if((!imageList) || (!imageList.length) || (imageList.length <= 0)) {
        console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory():imageList empty in url " + url);
        return;
      }
      imageList.forEach(function(imageEntry) {
        //console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory(), pictureInfo=" + imageEntry.pictureInfo);
        Image.findOne({'site':site, 'id':imageEntry.itemId}, function(err, result) {
          if(err) {
            console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory(), Image.findOne():error " + err);
            return;
          }
          if (result) {
            //console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory(), Image.findOne():exist ");
            return;
          }
          var obj = imageEntry;
          obj.id = imageEntry.itemId;
          obj.imgid = encodeDocID(site, obj.id);
          obj.random = Math.random();
          obj.alt = imageEntry.pictureInfo;
          obj.originalImgs = imageEntry.originImageArray.split('|');//http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/cataloguePicture/0245b6b4175a042dfa39cd7a77b362c9.jpg
          obj.thumbnailImgs = imageEntry.thumbImage.split('|');//http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/cataloguePicture/_thumb_0245b6b4175a042dfa39cd7a77b362c9.jpg
          obj.middleImgs = imageEntry.thumbMiddleImage.split('|');//http://beautyimage.xicp.net/web/data/beautyimage/UploadImages/cataloguePicture/_thumbMiddle_0245b6b4175a042dfa39cd7a77b362c9.jpg
          obj.num = obj.thumbnailImgs.length;
          obj.src = obj.thumbnailImgs[0]; //cover
          obj.site = site;
          obj.tags = entry.name;
          obj.created = new Date();
          obj.page = page;
          obj.time = new Date(Date.parse(imageEntry.time));
          /*var i = 0;
          for(i=0; i<imgs.length; i++) {
            (function(i) {
              var dir = './test/image/'+entry.name;
              var filename = obj.alt+'-'+i+'.jpg';
              var path = dir+'/'+filename;
              console.log('path='+path);
              http.get(imgs[i], path, function (error, result) {
                if (error) {
                  console.error(error);
                } else {
                  console.log('File downloaded at: ' + result.file);
                }
              });
            })(i);
          }
          imgs.forEach(function(img) {
            console.log('<a href="'+img+'" target="_blank"><img src="'+img+'"></a>');
          });*/

          Image.insert(obj, function (err, result) {
            if(err) {
              console.log("hzfdbg file[" + __filename + "]" + " crawlerCategory(), Image.insert():error " + err);
            }
          }); // Image.insert
        }); // Image.findOne
      });//forEach
    });//request
    })(page);
  }//for
};

var initCatalogList = function() {
  var i = 0;
  for(i=0; i<categorys.length; i++) {
    categorys[i].first = 1;
    categorys[i].pagesize = 15;
    //categorys[i].maxpage = 50;
  }
  /*categorys.forEach(function(entry) {
    var dir = './test/image/'+entry.name;
    fs.stat(dir, function(err, stat){
      if(err){
        console.log('initCatalogList(),mkdir:'+dir);
        fs.mkdirSync(dir, 0766);
      }
    })
  });*/
  //var url = 'http://beautyimage.xicp.net/web/beautyimage/APIV1_4_NewPay/Catalogue.php';
  //var req = {uri: url, method: "GET", headers: headers};
  //if(proxyEnable) {
  //  req.proxy = proxyUrl;
  //}
  //request(req, function (err, res, body) {
  //  var json = data2Json(err, res, body);
  //  if(!json || (json.returnMsg != 'sucess')) {
  //    console.log("hzfdbg file[" + __filename + "]" + " initCatalogList():JSON.parse() error");
  //    return;
  //  }
  //  var catalogList = json.returnContent.CataLogList;
  //  if((!catalogList) || (!catalogList.length) || (catalogList.length <= 0)) {
  //    console.log("hzfdbg file[" + __filename + "]" + " initCatalogList():catalogList empty in url " + url);
  //    return;
  //  }
  //  var i = 0;
  //  categorys = [];
  //  for(i=0; i<catalogList.length; i++) {
  //    var e = catalogList[i];
  //    categorys.push({id:e.catalogueId, name:e.catalogueName, icon:e.catalogueIcon, needCredit:e.needCredit, validTime:e.validTime, maxpage:e.maxpage, first:1, pagesize:15, maxpage:10});
  //  }
  //});//request
}

var crawlerAllCategory = function() {
  categorys.forEach(function(entry) {
    crawlerCategory(entry);
  });//forEach

  setTimeout(crawlerAllCategory, 1000 * 60 * 60 * 8); // 8 hours
}

var xgmnCrawler = function() {
  console.log("hzfdbg file[" + __filename + "]" + " xgmnCrawler():Start time="+new Date());
  initCatalogList();
  setTimeout(crawlerAllCategory, 1000 * 5); // delay 5 seconds
}

exports.xgmnCrawler = xgmnCrawler;
xgmnCrawler();