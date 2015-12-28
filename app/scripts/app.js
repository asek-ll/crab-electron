/* globals angular */
angular.module('app', ['ngRoute', 'ngMaterial', 'ngAnimate']);

angular.module('app').config(['$routeProvider',
  function ($routeProvider) {
    var templateBase = './templates';

    $routeProvider.when('/', {
      templateUrl: templateBase + '/items-list.tpl.html',
      controller: 'ItemsListCtrl',
    });

    $routeProvider.when('/item/:sid', {
      templateUrl: templateBase + '/item.tpl.html',
      controller: 'ItemCtrl',
    });

    $routeProvider.when('/plan', {
      templateUrl: templateBase + '/plan.tpl.html',
      controller: 'PlanCtrl',
      controllerAs: 'ctrl',
    });

    $routeProvider.otherwise({
      redirectTo: '/'
    });
  }
]);

angular.module('app').controller('ItemsListCtrl', ['$scope', 'itemService',

  function ($scope, itemService) {

    $scope.$watch('filter.query', function (query) {
      itemService.getItems(query).then(function (items) {
        $scope.items = items;
      });
    });

    $scope.getItemIcon = function (item) {
      var nameParts = item.name.split(':');
      var modName = nameParts[0].replace('|', '_');
      return '../data/icons/' + modName + '/' + item.id + '_' + item.meta + '.png';
    };
  }
]);

angular.module('app').controller('ItemCtrl', ['$scope', '$routeParams', 'recipeService', 'itemService',
  function ($scope, $routeParams, recipeService, itemService) {

    recipeService.getRecipes($routeParams.sid).then(function (recipes) {
      $scope.recipes = recipes;
    });
  }
]);

angular.module('app').directive('ingredient', ['itemService', '$compile',
  function (itemService, $compile) {
    return {
      restrict: 'E',
      scope: {
        ingredient: '=data'
      },
      transclude: true,
      templateUrl: './templates/ingredient.tpl.html',
      link: function (scope, element) {
        scope.itemCount = scope.ingredient.items.length;
        scope.ingredient.activeIndex = scope.ingredient.activeIndex || 0;

        scope.next = function () {
          scope.ingredient.activeIndex = (scope.ingredient.activeIndex + 1) % scope.itemCount;
        };
      },
    };
  }
]);

angular.module('app').directive('itemStack', ['itemService',
  function (itemService) {
    return {
      restrict: 'E',
      scope: {
        item: '=item',
        sid: '=sid',
        size: '=size',
      },
      transclude: true,
      templateUrl: './templates/directives/item-stack.tpl.html',
      link: function (scope, element) {
        var item = scope.item;
        var sid = scope.sid;

        scope.itemIcon = function (item) {
          if (!item) {
            return '';
          }
          var nameParts = item.name.split(':');
          var modName = nameParts[0].replace('|', '_');
          return '../data/icons/' + modName + '/' + item.id + '_' + item.meta + '.png';
        };

        if (item) {
          scope.item = item;
        } else if (sid) {
          itemService.getItemBySid(sid).then(function (item) {
            scope.item = item;
          });
        }
      },
    };
  }
]);

angular.module('app').controller('ToolbarCtrl', ['$scope', '$window',
  function ($scope, $window) {
    $scope.goBack = function () {
      $window.history.back();
    };
  }
]);

angular.module('app').controller('PlanCtrl', ['$scope', 'itemService', '$mdDialog',
  function ($scope, itemService, $mdDialog) {
    $scope.requiredItems = {};
    $scope.havingItems = {};
    $scope.craftingSteps = [];

    $scope.goals = [];
    $scope.inventory = [];

    var addToItemMap = function (items, item, count) {
      if (count === 0) {
        return;
      }
      var exists = items[item.sid];
      if (!exists) {
        items[item.sid] = {
          item: item,
          count: count
        };
      } else {
        exists.count += count;
        if (exists.count === 0) {
          delete items[item.sid];
        }
      }
    };

    var addToItemList = function (stacks, newItem, count) {
      var exists;
      angular.forEach(stacks, function (stack) {
        if (stack.item.sid === newItem.sid) {
          exists = stack;
          return false;
        }
      });
      if (!exists) {
        stacks.push({
          item: newItem,
          count: count
        });
      } else {
        exists.count += count;
      }

    };

    var recalcRequired = function () {
      var required = {};
      var having = {};

      angular.forEach($scope.inventory, function (stack) {
        addToItemMap(having, stack.item, stack.count);
      });

      angular.forEach($scope.goals, function (goal) {
        addToItemMap(this, goal.item, goal.count);
      }, required);

      angular.forEach($scope.craftingSteps, function (step) {
        var resultSid = step.result.sid;
        var requiredCount = required[resultSid] ? required[resultSid].count : 0;

        if (step.autoScale) {
          step.count = Math.ceil(requiredCount / step.result.size);
        }

        var resultCount = step.result.size * step.count;

        var delta = resultCount - requiredCount;

        if (delta >= 0) {
          delete required[resultSid];
          addToItemMap(having, step.result, delta);
        } else {
          addToItemMap(required, step.result, -resultCount);
        }

        angular.forEach(step.recipe.ingredients, function (ingredient) {
          var ingredientItem = ingredient.items[ingredient.activeIndex];

          var alreadyHaving = having[ingredientItem.sid];

          var requiredCount = step.count * ingredientItem.size;

          if (alreadyHaving) {
            var countFromHaving = Math.min(requiredCount, alreadyHaving.count);
            addToItemMap(having, ingredientItem, -countFromHaving);
            requiredCount -= countFromHaving;
          }

          addToItemMap(required, ingredientItem, requiredCount);
        });

      });

      $scope.requiredItems = required;
      $scope.havingItems = having;
    };

    var addStep = function (step) {
      var sameStepIndex = -1;
      angular.forEach($scope.craftingSteps, function (existingStep, index) {
        if (existingStep.result.sid === step.result.sid && existingStep.recipe._id === step.recipe._id) {
          sameStepIndex = index;
        }
      });

      if (sameStepIndex >= 0) {
        step.count += $scope.craftingSteps[sameStepIndex].count;
        $scope.craftingSteps.splice(sameStepIndex, 1);
      }

      $scope.craftingSteps.push(step);

    };

    $scope.removeCraftingStep = function (step) {
      $scope.craftingSteps.splice($scope.craftingSteps.indexOf(step), 1);
      recalcRequired();
    };

    $scope.completeCraftingStep = function (step) {
      $scope.craftingSteps.splice($scope.craftingSteps.indexOf(step), 1);
      addToItemList($scope.inventory, step.result, step.count * step.result.size);
    };

    $scope.expandRequired = function (required, event) {

      $mdDialog.show({
          controller: 'RecipeDialogCtrl',
          templateUrl: './templates/recipes-dialog.tpl.html',
          parent: angular.element(document.body),
          targetEvent: event,
          clickOutsideToClose: true,
          fullscreen: false,
          locals: {
            requiredData: required
          }
        })
        .then(function (recipe) {
          var targetItem;

          angular.forEach(recipe.result.items, function (item) {
            if (required.item.sid === item.sid) {
              targetItem = item;
            }
          });

          recipe.result.items = [targetItem];

          var step = {
            result: targetItem,
            recipe: recipe,
            count: Math.ceil(required.count / targetItem.size),
            autoScale: true,
          };

          addStep(step);

          recalcRequired();
        });

    };

    $scope.onChangedInventory = function (stacks) {
      recalcRequired();
    };

    $scope.onChangedGoals = function (goals) {
      recalcRequired();
    };
  }
]);

angular.module('app').controller('ItemSelectorCtrl', ['$scope', 'itemService',
  function ($scope, itemService) {
    var self = this;
    self.simulateQuery = false;
    self.isDisabled = false;

    self.querySearch = function (query) {
      return itemService.getItems(query);
    };

    self.selectedItemChange = function (item) {
      self.searchText = '';
      $scope.$emit('itemAdded', item);
    };
  }
]);

angular.module('app').controller('PlanStepsCtrl', ['$scope',
  function ($scope) {}
]);

angular.module('app').controller('PlanRequirementCtrl', ['$scope',
  function ($scope) {}
]);

angular.module('app').controller('RecipeDialogCtrl', ['$scope', 'recipeService', 'itemService', 'requiredData', '$mdDialog',
  function ($scope, recipeService, itemService, required, $mdDialog) {
    recipeService.getRecipes(required.item.sid).then(function (recipes) {
      $scope.recipes = recipes;
    });

    $scope.select = function (recipe) {
      $mdDialog.hide(recipe);
    };
  }
]);

angular.module('app').directive('recipe', ['itemService',
  function () {
    return {
      restrict: 'E',
      scope: {
        recipe: '=data'
      },
      transclude: true,
      templateUrl: './templates/directives/recipe.tpl.html',
    };
  }
]);

angular.module('app').directive('itemSelector', ['itemService',
  function () {
    return {
      restrict: 'E',
      transclude: true,
      controller: 'ItemSelectorCtrl',
      controllerAs: 'ctrl',
      templateUrl: './templates/directives/item-selector.tpl.html',
    };
  }
]);

angular.module('app').directive('inventory', ['itemService',
  function () {
    return {
      restrict: 'E',
      transclude: true,
      scope: {
        inventory: '=model',
        onInventoryChanged: '&callback',
      },
      controllerAs: 'ctrl',
      templateUrl: './templates/directives/inventory.tpl.html',
      link: function ($scope) {
        $scope.inventory = $scope.inventory || [];

        $scope.removeInventoryItem = function (stack) {
          var stacks = $scope.inventory;
          stacks.splice(stacks.indexOf(stack), 1);
        };

        $scope.$on('itemAdded', function (event, item) {
          if (item) {
            $scope.inventory.push({
              item: item,
              count: 1
            });
          }
        });

        $scope.$watch(function () {

          var res = [];
          angular.forEach($scope.inventory, function (stack) {
            this.push(stack.item.sid + '-' + stack.count);
          }, res);
          return res.join('|');

        }, function () {
          $scope.onInventoryChanged({
            inventory: $scope.inventory
          });
        });
      }
    };
  }
]);
