/* globals angular */
(function() {

  var Datastore = require('nedb');

  var expandRulesDb = new Datastore({
    filename: './data/auto-expands.db',
    autoload: true
  });

  angular.module('app').service('expandRulesService', ['$q',
    function($q) {
      return {
        getAllRules: function() {

          var deferred = $q.defer();
          expandRulesDb.find().exec(function(err, rules) {
            if (err) {
              deferred.reject(err);
            } else {
              var recipes = [];
              angular.forEach(rules, function(rule) {
                recipes.push({
                  sid: rule.sid,
                  recipe: angular.fromJson(rule.recipe)
                });
              });
              deferred.resolve(recipes);
            }
          });

          return deferred.promise;
        },

        getRecipeForItem: function(sid) {

          var deferred = $q.defer();
          expandRulesDb.findOne({
            sid: sid
          }).exec(function(err, expandRule) {
            if (err || !expandRule) {
              deferred.reject(err);
            } else {
              deferred.resolve(angular.fromJson(expandRule.recipe));
            }
          });

          return deferred.promise;
        },

        addExpandRule: function(sid, recipe) {
          var deferred = $q.defer();
          expandRulesDb.insert({
            sid: sid,
            recipe: angular.toJson(recipe)
          }, function(err, rule) {
            if (err) {
              deferred.reject(err);
            } else {
              deferred.resolve(rule);
            }
          });
          return deferred.promise;
        },

        removeExpandRule: function(sid) {
          var deferred = $q.defer();
          expandRulesDb.remove({
            sid: sid,
          }, function(err) {
            if (err) {
              deferred.reject(err);
            } else {
              deferred.resolve();
            }
          });
          return deferred.promise;
        },

      };
    }
  ]);

})();
