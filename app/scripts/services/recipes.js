/* globals angular */
(function () {
  var getData = require('./data-adapter').requestData;

  angular.module('app').service('recipeService', ['$q',
    function ($q) {
      return {
        updateRecipe: function (newRecipe) {
          var deferred = $q.defer();

          getData('recipes-update', {
            query: {
              _id: newRecipe._id,
            },
            data: newRecipe,
            options: {}
          }, function () {
            deferred.resolve(newRecipe);
          });

          return deferred.promise;
        },
        createRecipe: function (newRecipe) {
          var deferred = $q.defer();

          getData('recipes-insert', {
            data: newRecipe,
            options: {}
          }, function (createdRecipe) {
            console.log(createdRecipe);
            deferred.resolve(createdRecipe);
          });

          return deferred.promise;
        },
        getRecipeById: function (id) {
          var deferred = $q.defer();

          getData('recipes-find-one', {
            query: {
              _id: id
            }
          }, function (recipe) {
            deferred.resolve(recipe);
          });

          return deferred.promise;
        },
        getRecipes: function (outputSid) {
          var query = {
            'result.sid': outputSid
          };

          var deferred = $q.defer();

          getData('recipes-find', {query: query}, function (recipes) {
            deferred.resolve(recipes);
          });

          return deferred.promise;

        }
      };
    }
  ]);

})();
