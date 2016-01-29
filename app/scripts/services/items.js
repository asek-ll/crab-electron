/* globals angular */
(function() {

  var Datastore = require('nedb');

  var itemDb = new Datastore({
    filename: './data/items.db',
    autoload: true
  });

  angular.module('app').service('itemService', ['$q', '$cacheFactory',
    function($q, $cacheFactory) {
      var itemsBySidcache = $cacheFactory('itemCache', {
        capacity: 1000,
      });

      return {
        getItems: function(name) {
          var query = {};
          if (name && name !== '') {
            query.displayName = {
              $regex: new RegExp(name, 'i')
            };
          }

          var deferred = $q.defer();
          itemDb.find(query).limit(50).exec(function(err, items) {
            if (err) {
              deferred.reject(err);
            } else {
              deferred.resolve(items);
            }
          });

          return deferred.promise;
        },

        getItemsBySids: function(sids) {
          var deferred = $q.defer();

          itemDb.find({
            'sid': {
              $in: sids
            }
          }).exec(function(err, items) {
            if (err) {
              deferred.reject(err);
            } else {
              deferred.resolve(items);
            }

          });
          return deferred.promise;
        },
        getItemBySid: function(sid) {
          var idParts = sid.split(':');
          if (parseInt(idParts[2]) > 32000) {
            sid = idParts[0] + ':' + idParts[1] + ':0';
          }

          var deferred = $q.defer();

          var item = itemsBySidcache.get(sid);
          if (item) {
            deferred.resolve(item);
          } else {

            itemDb.findOne({
              'sid': sid
            }).exec(function(err, item) {
              if (err) {
                deferred.reject(err);
              } else {
                itemsBySidcache.put(sid, item);
                deferred.resolve(item);
              }

            });

          }
          return deferred.promise;
        }
      };
    }
  ]);

})();
