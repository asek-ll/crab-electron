/* globals angular */
(function () {

  var Datastore = require('nedb');

  var recipesDb = new Datastore({
    filename: './data/recipes.db',
    autoload: true
  });

  angular.module('app').service('recipeService', ['$q',
    function ($q) {
      return {
        updateRecipe: function (newRecipe) {
          var deferred = $q.defer();
          recipesDb.update({
            _id: newRecipe._id,
          }, newRecipe, {}, function (err) {
            if (err) {
              deferred.reject(err);
            } else {
              deferred.resolve(newRecipe);
            }
          });

          return deferred.promise;
        },
        getRecipeById: function (id) {
          var deferred = $q.defer();
          recipesDb.findOne({
            _id: id
          }).exec(function (err, recipe) {
            if (err) {
              deferred.reject(err);
            } else {
              deferred.resolve(recipe);
            }
          });

          return deferred.promise;
        },
        getRecipes: function (outputSid) {
          var query = {
            'result.items.sid': outputSid
          };

          var deferred = $q.defer();
          recipesDb.find(query).exec(function (err, recipes) {
            if (err) {
              deferred.reject(err);
            } else {
              deferred.resolve(recipes);
            }
          });

          return deferred.promise;

        }
      };
    }
  ]);

})();
