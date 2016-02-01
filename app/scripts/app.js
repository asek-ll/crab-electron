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

    $routeProvider.when('/plan/:id', {
      templateUrl: templateBase + '/plan.tpl.html',
      controller: 'PlanCtrl',
      controllerAs: 'ctrl',
    });

    $routeProvider.when('/plans', {
      templateUrl: templateBase + '/views/plans-list.tpl.html',
      controller: 'PlansListCtrl',
      controllerAs: 'ctrl',
    });

    $routeProvider.when('/expand-rules', {
      templateUrl: templateBase + '/views/expand-rules.tpl.html',
      controller: 'ExpandRulesCtrl',
      controllerAs: 'ctrl',
    });

    $routeProvider.when('/recipe/:id', {
      templateUrl: templateBase + '/views/recipe.tpl.html',
      controller: 'RecipeCtrl',
      controllerAs: 'ctrl',
    });

    $routeProvider.when('/recipe/new/:itemSid', {
      templateUrl: templateBase + '/views/recipe.tpl.html',
      controller: 'RecipeCtrl',
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

angular.module('app').controller('ItemCtrl', ['$scope', '$routeParams', 'recipeService', 'itemService', 'expandRulesService',
  function ($scope, $routeParams, recipeService, itemService, expandRulesService) {

    $scope.itemSid = $routeParams.sid;
    recipeService.getRecipes($routeParams.sid).then(function (recipes) {
      $scope.recipes = recipes;
    });

    expandRulesService.getRecipeForItem($scope.itemSid).then(function (recipe) {
      $scope.expandRuleRecipe = recipe;
    });

    $scope.clearAutoExpandRule = function (sid) {
      expandRulesService.removeExpandRule(sid).then(function () {
        $scope.expandRuleRecipe = null;
      });
    };

    $scope.setAutoExpandRule = function (sid, recipe) {
      expandRulesService.addExpandRule(sid, recipe).then(function () {
        $scope.expandRuleRecipe = recipe;
      });
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

angular.module('app').controller('PlanCtrl', ['$scope', 'itemService', '$mdDialog', 'plansService', '$routeParams', '$location', 'expandRulesService', '$q',
  function ($scope, itemService, $mdDialog, plansService, $routeParams, $location, expandRulesService, $q) {
    var ctrl = this;

    $scope.requiredItems = {};
    $scope.havingItems = {};
    $scope.isGraphEnabled = false;

    $scope.plan = plansService.createNewPlan();

    if ($routeParams.id) {
      plansService.getPlanById($routeParams.id).then(function (plan) {
        $scope.plan = plan;
      });
    }

    $scope.expandRequired = function (required, event, toggleSave) {

      $mdDialog.show({
          controller: 'RecipeDialogCtrl',
          templateUrl: './templates/recipes-dialog.tpl.html',
          parent: angular.element(document.body),
          targetEvent: event,
          clickOutsideToClose: true,
          fullscreen: false,
          locals: {
            requiredData: {
              required: required,
              toggleSave: !!toggleSave
            }
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

          $scope.plan.addStep(step);
        });

    };

    var autoExpand = function (plan, required) {
      var deferred = $q.defer();
      console.log('AutoExpend', required.item.sid);

      expandRulesService.getRecipeForItem(required.item.sid).then(function (recipe) {
        var targetItem;

        angular.forEach(recipe.result.items, function (item) {
          if (required.item.sid === item.sid) {
            targetItem = item;
          }
        });
        var repeats = Math.ceil(required.count / targetItem.size);
        plan.addStep({
          result: targetItem,
          recipe: recipe,
          count: repeats,
          autoScale: true
        });

        var promises = [];
        angular.forEach(recipe.ingredients, function (ingredient) {
          var ingredientItem = ingredient.items[ingredient.activeIndex];
          promises.push(autoExpand(plan, {
            count: ingredientItem.size * repeats,
            item: ingredientItem
          }));
        }, promises);

        $q.all(promises).then(function () {
          deferred.resolve({
            isSuccessfull: true,
            plan: plan
          });
        });

      }, function () {
        deferred.resolve({
          isSuccessfull: false,
          plan: plan
        });
      });

      return deferred.promise;
    };

    $scope.autoExpand = function (required, event) {
      autoExpand(angular.copy($scope.plan), required).then(function (status) {
        if (status.isSuccessfull) {
          $scope.plan = status.plan;
        } else {
          $scope.expandRequired(required, event, true);
        }
      });
    };

    $scope.refreshPlan = function () {
      var result = $scope.plan.recalcRequired();

      var required = [];
      angular.forEach(result.requiredItems, function (item) {
        this.push(item);
      }, required);
      $scope.requiredItems = required;

      var having = [];
      angular.forEach(result.sideResults, function (item) {
        this.push(item);
      }, having);

      $scope.havingItems = having;
    };

    ctrl.savePlan = function (plan) {
      var oldPlanId = plan._id;
      plansService.savePlan(plan).then(function (plan) {
        if (oldPlanId !== plan._id) {
          $location.path('/plan/' + plan._id);
        }
      });
    };

    $scope.$watch(function () {
      var ids = [];
      angular.forEach($scope.plan.craftingSteps, function (step) {
        this.push(step.result.sid + ':' + step.count);
      }, ids);
      return ids.sort().join('|');
    }, function () {
      $scope.refreshPlan();
    });

    var addToItemList = function (stacks, newItem, count) {
      var exists;
      var index = -1;
      angular.forEach(stacks, function (stack, i) {
        if (stack.item.sid === newItem.sid) {
          exists = stack;
          index = i;
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
        if (exists.count === 0) {
          stacks.splice(index, 1);
        }
      }

    };

    $scope.completeRequired = function (required) {
      $scope.plan.addItemToInventory(required.item, required.count);
      addToItemList($scope.requiredItems, required.item, -required.count);
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

angular.module('app').controller('RecipeDialogCtrl', ['$scope', 'recipeService', 'requiredData', '$mdDialog', 'expandRulesService',
  function ($scope, recipeService, requiredData, $mdDialog, expandRulesService) {
    $scope.saveExpandRule = requiredData.toggleSave;
    var required = requiredData.required;

    recipeService.getRecipes(required.item.sid).then(function (recipes) {
      $scope.recipes = recipes;
    });

    $scope.select = function (recipe) {
      $mdDialog.hide(recipe);
      if ($scope.saveExpandRule) {
        expandRulesService.addExpandRule(required.item.sid, recipe);
      }
    };
  }
]);

angular.module('app').controller('PlansListCtrl', ['$scope', 'plansService',
  function ($scope, plansService) {
    plansService.getAllPlans().then(function (plans) {
      $scope.plans = plans;
    });
    $scope.removePlan = function (plan) {
      plansService.removePlan(plan._id).then(function () {
        var index = $scope.plans.indexOf(plan);
        $scope.plans.splice(index, 1);
      });
    };
  }
]);

angular.module('app').controller('ExpandRulesCtrl', ['$scope', 'expandRulesService',
  function ($scope, expandRulesService) {
    expandRulesService.getAllRules().then(function (rules) {
      $scope.rules = rules;
    });

    $scope.removeRule = function (rule) {
      expandRulesService.removeExpandRule(rule.sid).then(function () {
        var index = $scope.rules.indexOf(rule);
        $scope.rules.splice(index, 1);
      });
    };
  }
]);

angular.module('app').filter('column', [

  function () {
    return function (items, currentIndex, totalCount) {
      var perColumn = Math.ceil(items.length / totalCount);
      return items.slice(currentIndex * perColumn, (currentIndex + 1) * perColumn);
    };
  }
]);

angular.module('app').controller('RecipeCtrl', ['$scope', 'recipeService', '$routeParams',
  function ($scope, recipeService, $routeParams) {
    var transformIngredient2Inventory = function (ingredient) {
      var stacks = [];
      angular.forEach(ingredient.items, function (item) {
        this.push({
          item: item,
          count: item.size
        });
      }, stacks);
      return {
        x: ingredient.x,
        y: ingredient.y,
        stacks: stacks
      };
    };
    var transformIngredients2Inventories = function (ingredients) {
      var inventory = [];
      angular.forEach(ingredients, function (ingredient) {
        this.push(transformIngredient2Inventory(ingredient));
      }, inventory);

      return inventory;
    };

    var transformInventory2Ingredient = function (inventory) {
      var items = [];
      angular.forEach(inventory.stacks, function (stack) {
        this.push({
          sid: stack.item.sid,
          size: stack.count
        });
      }, items);

      return {
        x: inventory.x,
        y: inventory.y,
        items: items
      };

    };

    var transformInventories2Ingredients = function (inventories) {
      var ingredients = [];
      angular.forEach(inventories, function (inventory) {
        var ingredient = transformInventory2Ingredient(inventory);
        if (ingredient.items.length > 0) {
          this.push(ingredient);
        }
      }, ingredients);

      return ingredients;
    };

    var initScope = function (recipe) {
      $scope.recipe = angular.copy(recipe);

      $scope.result = transformIngredient2Inventory(recipe.result);

      var ingredients = transformIngredients2Inventories(recipe.ingredients);

      $scope.ingredients = ingredients;

      $scope.removeIngredient = function (ingredient) {
        $scope.ingredients.splice($scope.ingredients.indexOf(ingredient), 1);
      };

      $scope.addNewIngredient = function () {
        $scope.ingredients.push({
          x: 0,
          y: 0,
          stacks: []
        });
      };

      $scope.saveRecipeIngredients = function (ingredientInventories, resultInventory) {
        recipe.ingredients = transformInventories2Ingredients(ingredientInventories);
        recipe.result = transformInventory2Ingredient(resultInventory);

        if (recipe._id) {
          recipeService.updateRecipe(recipe);
        } else {
          recipeService.createRecipe(recipe).then(function (createdRecipe) {
            recipe = createdRecipe;
          });
        }
      };
    };

    if ($routeParams.id) {
      recipeService.getRecipeById($routeParams.id).then(initScope);
    } else if ($routeParams.itemSid) {
      var recipe = {
        result: {
          x: 0,
          y: 0,
          items: [
            {
              sid: $routeParams.itemSid,
              size: 1
            }
          ]
        },
        ingredients: [],
        others:[],
        handlerName:'Custom Crafting'
      }
      initScope(recipe);
    }

  }
]);
