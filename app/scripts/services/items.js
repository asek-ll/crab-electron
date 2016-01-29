/* globals angular */
(function () {
  const ipcRenderer = require('electron').ipcRenderer;

  angular.module('app').service('itemService', ['$q', '$cacheFactory',
    function ($q, $cacheFactory) {
      var itemsBySidcache = $cacheFactory('itemCache', {
        capacity: 1000,
      });

      return {
        getItems: function (name) {
          var query = {};
          if (name && name !== '') {
            query.displayName = {
              $regex: new RegExp(name, 'i')
            };
          }

          var deferred = $q.defer();

          const items = ipcRenderer.sendSync('items-find', query, {
            limit: 50
          }, function () {
            console.log('callback test');
          });

          deferred.resolve(items);

          return deferred.promise;
        },

        getItemsBySids: function (sids) {
          var deferred = $q.defer();

          const items = ipcRenderer.sendSync('items-find', {
            'sid': {
              $in: sids
            }
          });
          deferred.resolve(items);

          return deferred.promise;
        },
        getItemBySid: function (sid) {
          var idParts = sid.split(':');
          if (parseInt(idParts[2]) > 32000) {
            sid = idParts[0] + ':' + idParts[1] + ':0';
          }

          var deferred = $q.defer();

          var item = itemsBySidcache.get(sid);
          if (item) {
            deferred.resolve(item);
          } else {

            item = ipcRenderer.sendSync('items-find-one', {
              'sid': sid
            });
            itemsBySidcache.put(sid, item);
            deferred.resolve(item);
          }
          return deferred.promise;
        }
      };
    }
  ]);

})();
