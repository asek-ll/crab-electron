const ipcMain = require('electron').ipcMain;
const log4js = require('log4js');

const Datastore = require('nedb');

log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file('logs/info.log'), 'info');

var logger = log4js.getLogger('info');
logger.setLevel('TRACE');

const databases = [
  'recipes',
  'items',
  'plans',
  'auto-expands',
];

module.exports = function () {

  var handlers = {};

  var registerHandler = function (requestKey, handler) {
    handlers[requestKey] = handler;
  };

  ipcMain.on('requestData', function (event, uid, key, data) {
    var handler = handlers[key];
    if (handler) {

      handler(data, function (err, result) {
        event.sender.send('requestedData', uid, result);
      });

    } else {
      event.sender.send('requestedData', uid);
    }
  });

  databases.forEach(function (dbName) {
    logger.debug('load database', dbName)
    const db = new Datastore({
      filename: './data/' + dbName + '.db',
      autoload: true
    });

    registerHandler(dbName + '-find', function (data, callback) {
      logger.debug('trigger', dbName + '-find', data);

      data.options = data.options || {};

      if (data.name && data.name !== '') {
        data.query.displayName = {
          $regex: new RegExp(data.name, 'i')
        };
      }

      var query = db.find(data.query);

      if (data.limit) {
        query = query.limit(data.limit);
      }
      query.exec(callback);
    });

    logger.debug(dbName + '-find-one');
    registerHandler(dbName + '-find-one', function (data, callback) {
      logger.debug('trigger', dbName + '-find-one', data);
      db.findOne(data.query).exec(callback);
    });

    logger.debug(dbName + '-update');
    registerHandler(dbName + '-update', function (data, callback) {
      logger.debug('trigger', dbName + '-update', data);
      db.update(data.query, data.data, data.options, callback);
    });

    logger.debug(dbName + '-insert');
    registerHandler(dbName + '-insert', function (data, callback) {
      logger.debug('trigger', dbName + '-update', data);
      db.insert(data.data, callback);
    });

    logger.debug(dbName + '-remove');
    registerHandler(dbName + '-remove', function (data, callback) {
      logger.debug('trigger', dbName + '-update', data);
      db.remove(data.query, callback);
    });
  });

};
