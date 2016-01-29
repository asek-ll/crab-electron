/* globals angular */
(function () {
  const ipcRenderer = require('electron').ipcRenderer;

  angular.module('app').service('recipeService', ['$q',
    function ($q) {
      return {
        updateRecipe: function (newRecipe) {
          var deferred = $q.defer();

          ipcRenderer.sendSync('recipes-update', newRecipe, {});

          deferred.resolve(newRecipe);

          return deferred.promise;
        },
        getRecipeById: function (id) {
          var deferred = $q.defer();

          var recipe = ipcRenderer.sendSync('recipes-find-one', {
            _id: id
          });

          deferred.resolve(recipe);

          return deferred.promise;
        },
        getRecipes: function (outputSid) {
          var query = {
            'result.items.sid': outputSid
          };

          var deferred = $q.defer();

          var recipes = ipcRenderer.sendSync('recipes-find', query);

          deferred.resolve(recipes);

          return deferred.promise;

        }
      };
    }
  ]);

})();
