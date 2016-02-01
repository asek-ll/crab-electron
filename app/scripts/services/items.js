/* globals angular */
(function () {
  var getData = require('./data-transfer').requestData;

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

          getData('items-find', {
            query: query,
            limit: 50,
          }, function (items) {
            deferred.resolve(items);
          });

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

            getData('items-find-one', {
              query: {
                'sid': sid
              }
            }, function (item) {
              itemsBySidcache.put(sid, item);
              deferred.resolve(item);
            });
          }
          return deferred.promise;
        }
      };
    }
  ]);

})();
