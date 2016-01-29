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
  //'plans'
];

module.exports = function () {

  databases.forEach(function (dbName) {
    logger.debug('load database', dbName)
    const db = new Datastore({
      filename: './data/' + dbName + '.db',
      autoload: true
    });

    logger.debug(dbName + '-find');
    ipcMain.on(dbName + '-find', function (e, query, options, callback) {
      logger.debug('trigger', dbName + '-find', arguments);

      options = options || {};
      var query = db.find(query);
      if (options.limit) {
        query = query.limit(options.limit);
      }
      query.exec(function (err, recipes) {
        e.returnValue = recipes;
        callback(err, recipes);
      });
    });

    logger.debug(dbName + '-find-one');
    ipcMain.on(dbName + '-find-one', function (e, query) {
      logger.debug('trigger', dbName + '-find-one', arguments);
      db.findOne(query).exec(function (err, recipe) {
        e.returnValue = recipe;
      });
    });

    logger.debug(dbName + '-find-update');
    ipcMain.on(dbName + '-update', function (e, query, data, options) {
      logger.debug('trigger', dbName + '-update', arguments);
      db.update(query, data, options).exec(function (err) {
        e.returnValue = err;
      });
    });
  });

};
