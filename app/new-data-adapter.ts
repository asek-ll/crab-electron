import { ipcRenderer } from 'electron';

var queue: { [uid: string]: (data: Object) => void } = {};

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

ipcRenderer.on('requestedData', function (event, uid, data) {
  var callback = queue[uid];
  if (callback) {
    delete queue[uid];
    callback(data);
  }
});

export function requestData(key: string, params: Object) {
     var uid = generateUid();
     var callback: (data: Object) => void;
     var promise = new Promise<Object>(function(resolve, reject) {
         callback = resolve;
     } );
     queue[uid] = callback;
     ipcRenderer.send('requestData', uid, key, params);
     return promise;
}