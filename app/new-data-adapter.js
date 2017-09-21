"use strict";
var electron_1 = require('electron');
var queue = {};
function generateId() {
    return Math.random().toString(16).slice(2);
}
function generateUid() {
    var id = generateId();
    do {
        id = generateId();
    } while (queue[id]);
    return id;
}
electron_1.ipcRenderer.on('requestedData', function (event, uid, data) {
    var callback = queue[uid];
    if (callback) {
        delete queue[uid];
        callback(data);
    }
});
function requestData(key, params) {
    var uid = generateUid();
    var callback;
    var promise = new Promise(function (resolve, reject) {
        callback = resolve;
    });
    queue[uid] = callback;
    electron_1.ipcRenderer.send('requestData', uid, key, params);
    return promise;
}
exports.requestData = requestData;
//# sourceMappingURL=new-data-adapter.js.map