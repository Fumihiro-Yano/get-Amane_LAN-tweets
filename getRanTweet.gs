var driveFolderId = "13RcDnUDxwljds_cXLEdbQjZJLfS5iy1K"
var fileName = "tweet_2.json"

var ss = SpreadsheetApp.getActiveSpreadsheet();
var sheet = ss.getSheetByName('Sheet1');

// ウェブアプリケーションアクセス時に呼ばれる
function doGet() {
  Logger.log('start')
  var file = DriveApp.getFolderById(driveFolderId).getFilesByName(fileName).next()
  var jsonText = file.getBlob().getDataAsString('utf8');
  return ContentService.createTextOutput(jsonText).setMimeType(ContentService.MimeType.JSON)
  Logger.log('end')
}

// 認証用URL取得
function getOAuthURL() {
  Logger.log(getService().authorize());
}

// サービス取得
function getService() {
  return OAuth1.createService('Twitter')
    .setAccessTokenUrl('https://api.twitter.com/oauth/access_token')
    .setRequestTokenUrl('https://api.twitter.com/oauth/request_token')
    .setAuthorizationUrl('https://api.twitter.com/oauth/authorize')
    // 設定した認証情報をセット
    .setConsumerKey(PropertiesService.getScriptProperties().getProperty("CONSUMER_API_KEY"))
    .setConsumerSecret(PropertiesService.getScriptProperties().getProperty("CONSUMER_API_SECRET"))
    .setCallbackFunction('authCallback')
    // 認証情報をプロパティストアにセット（ここで認証解除するまで再認証が不要になる）
    .setPropertyStore(PropertiesService.getUserProperties());
}

//  認証成功時に呼び出される処理
function authCallback(request) {
  var service = getService();
  var authorized = service.handleCallback(request);
  if (authorized) {
    return HtmlService.createHtmlOutput('success!!');
  } else {
    return HtmlService.createHtmlOutput('failed');
  }
}

// タイムライン取得用のAPIを起動
function getTimeLine() {
  var twitterService = getService();

  if (twitterService.hasAccess()) {
    var twMethod = {
      method: "GET"
    };
    var jsonOrigin = twitterService.fetch("https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=amane_lan&count=30&exclude_replies=true&include_rts=false", twMethod);

    var array = JSON.parse(jsonOrigin);      
    setTweet(array);
    
    var data = sheet.getRange('A1:B51').getValues();
    data = dataFilter(data, '#MixBoxなうぷれ');
    var jsonCustom = parseToJson(data);
    createJsonFileToFireStorage(jsonCustom, fileName);
  }
  
  function dataFilter(data, term) {
    // 先頭の[id, text] 配列以外をチェック
    var result = data.filter((value, index) => {
      return index === 0 || value[1].indexOf(term)!== -1
    })    
    return result;
  }

  function setTweet(array) {
    var startRow = 2;
    // var lastRow = sheet.getLastRow() +1;
    var lastId = sheet.getRange("D2").getValue();
  
    for(var i = 0; i <= array.length -1; i++) {
      var int = parseInt(i);
      if(i === 0){
        var recId = array[int]["id"];
        sheet.getRange("D2").setValue(recId);
      }
      var id = array[int]["id"];
      if(id > lastId){
        var time = array[int]["created_at"];
        var text = htmlspecialchars(array[int]["text"]);
        Logger.log(text);
        var hashtags = array[int]["entities"]["hashtags"];
        sheet.getRange(startRow+i,2).setValue(text);
        sheet.getRange(startRow+i,3).setValue(time);
        sheet.getRange(startRow+i,4).setValue(id);
        if(hashtags) {
          for (var j=0; j<hashtags.length;j++){
            sheet.getRange(startRow+i,6+j).setValue(hashtags[j]["text"]); 
          }
        }
      }
      // lastRow = lastRow + 1;
    }
  }
  Logger.log("完了");
}

// 特殊文字変換
function htmlspecialchars(str) {
  return str
    .replace('&amp;','&')
    .replace('&quot;','"')
    .replace('&#039;',"'")
    .replace('&lt;','<')
    .replace('&gt;','>'); 
}

function parseToJson(values) {
  var keys = values.splice(0,1)[0];
  // Logger.log(keys);
  var data = values.map(function(row) {
    var obj = {}
    row.map(function(item, index) {
      obj[keys[index]] = item;
    });
    return obj;
  });
  return JSON.stringify(data);
}

function createJsonFileToFireStorage(jsonData, fileName) {
  const bucketName = "mixbox-stg.appspot.com"  
  const oaTkn = ScriptApp.getOAuthToken()
  const contentType = "application/json"
  const charSet = "UTF-8"
  const blob = Utilities.newBlob("", contentType, fileName).setDataFromString(jsonData, charSet)
  const bytes = blob.getBytes()
  const url = 'https://storage.googleapis.com/upload/storage/v1/b/' + bucketName + '/o?uploadType=media&name=' + fileName  
  const aclUrl = 'https://storage.googleapis.com/storage/v1/b/' + bucketName + '/o/'+ fileName+ '/acl'
  const metaUrl = 'https://storage.googleapis.com/storage/v1/b/' + bucketName + '/o/'+ fileName
  
  
  let op = {
    method: "POST",
    muteHttpExceptions: true,
    contentType: blob.getContentType(),
    cacheControl: "no-store",
    host: bucketName + ".storage.googleapis.com",
    payload: bytes,
    headers: {
      Authorization: 'Bearer ' + oaTkn
    }
  }
  UrlFetchApp.fetch(url, op)
  
  const json = {"entity": "allUsers", "role": "READER"}
  const obj = JSON.stringify(json)
  let aclOp = {
    method: "POST",
    muteHttpExceptions: true,
    contentType: "application/json",
    payload: obj,
    headers: {
      Authorization: 'Bearer ' + oaTkn,
    }
  }
  UrlFetchApp.fetch(aclUrl, aclOp)
  
  const metajson = {"Cache-Control": 'no-cache,max-age=0'}
  const metaobj = JSON.stringify(metajson)
  let metaOpt = {
    method: "PATCH",
    muteHttpExceptions: true,
    payload: metajson,
    headers: {
      contentType: "application/json",
      Authorization: 'Bearer ' + oaTkn
    }
  }
  UrlFetchApp.fetch(metaUrl, metaOpt)
}


//======================================================== json出力のテスト
function test() {
  var data = sheet.getRange('A1:B51').getValues();
  data = dataFilter(data, '#MixBoxなうぷれ');
  var jsonCustom = parseToJson(data);
  // resetJsonFile(driveFolderId, fileName)
  // createJsonFile(jsonCustom, driveFolderId, fileName)
  createJsonFileToFireStorage(jsonCustom, fileName)
  
  function dataFilter(data, term) {
    // 先頭の[id, text] 配列以外をチェック
    var result = data.filter((value, index) => {
      return index === 0 || value[1].indexOf(term)!== -1
    })    
    return result;
  }
}