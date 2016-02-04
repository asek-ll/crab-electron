/* globals angular */
(function () {

  var getData = require('./data-adapter').requestData;

  angular.module('app').service('expandRulesService', ['$q',
    function ($q) {
      return {
        getAllRules: function () {

          var deferred = $q.defer();
          getData('auto-expands-find', {}, function (rules) {
            var recipes = [];
            angular.forEach(rules, function (rule) {
              recipes.push({
                sid: rule.sid,
                recipe: angular.fromJson(rule.recipe)
              });
            });
            deferred.resolve(recipes);
          });

          return deferred.promise;
        },

        getRecipeForItem: function (sid) {

          var deferred = $q.defer();
          getData('auto-expands-find-one', {
            query: {
              sid: sid
            }
          }, function (expandRule) {
            if (expandRule) {
              deferred.resolve(angular.fromJson(expandRule.recipe));
            } else {
              deferred.reject();
            }
          });

          return deferred.promise;
        },

        addExpandRule: function (sid, recipe) {
          var deferred = $q.defer();
          getData('auto-expands-update', {
            query: {
              sid: sid
            },
            data: {
              sid: sid,
              recipe: angular.toJson(recipe)
            },
            options: {
              upsert: true
            }
          }, function (rule) {
            deferred.resolve(rule);
          });
          return deferred.promise;
        },

        removeExpandRule: function (sid) {
          var deferred = $q.defer();
          getData('auto-expands-remove', {
              query: {
                sid: sid
              }
            },
            function () {
              deferred.resolve();
            });
          return deferred.promise;
        },

      };
    }
  ]);

})();
