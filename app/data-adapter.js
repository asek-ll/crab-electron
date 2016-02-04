const ipcRenderer = require('electron').ipcRenderer;

var queue = {};

var generateId = function () {
  return Math.random().toString(16).slice(2)
};

var generateUid = function () {
  var id = generateId();

  do {
    id = generateId();
  } while (queue[id]);

  return id;
};

ipcRenderer.on('requestedData', function (event, uid, data) {
  var callback = queue[uid];
  if (callback) {
    delete queue[uid];
    callback(data);
  }
});

var requestData = function (key, params, callback) {
  var uid = generateUid();
  ipcRenderer.send('requestData', uid, key, params);
  queue[uid] = callback;
};

module.exports = {
  requestData: requestData
};
