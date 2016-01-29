/* globals angular */
(function() {

  var Datastore = require('nedb');

  var plansDb = new Datastore({
    filename: './data/plans.db',
    autoload: true
  });

  angular.module('app').service('plansService', ['$q',
    function($q) {

      var addToItemMap = function(items, item, count) {
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

      var addToItemList = function(stacks, newItem, count) {
        var exists;
        angular.forEach(stacks, function(stack) {
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

      var plan$ = {
        getGraphData: function () {
          var _self = this;
          var graph = {};

          var nodes = [];
          var links = [];

          var goalsItems = [];
          var craftedItems = [];

          var nodeLevels = {};

          var itemCounts = {};

          var createNode = function (itemSid) {
            if ( nodes.indexOf(itemSid) < 0 ) {
              nodes.push(itemSid);
            }
          };

          var countItem = function (sid, count) {
            if ( !itemCounts[sid] ) {
              itemCounts[sid] = 0;
            }
            itemCounts[sid] += count;
          };

          angular.forEach(_self.goals, function(goal) {
            createNode(goal.item.sid);
            goalsItems.push(goal.item.sid);
            nodeLevels[goal.item.sid] = 1;
            countItem(goal.item.sid, goal.count);
          });

          angular.forEach(_self.craftingSteps, function(step) {
            var resultSid = step.result.sid;
            var resultCount = step.result.size * step.count;

            createNode(step.result.sid);
            craftedItems.push(step.result.sid);

            var newLevel = nodeLevels[step.result.sid] + 1;

            angular.forEach(step.recipe.ingredients, function(ingredient) {
              var ingredientItem = ingredient.items[ingredient.activeIndex];

              createNode(ingredientItem.sid);

              var currentLevel = nodeLevels[ingredientItem.sid] ? nodeLevels[ingredientItem.sid] : newLevel;

              nodeLevels[ingredientItem.sid] = newLevel > currentLevel ? newLevel : currentLevel;

              var ingredientCount = step.count * ingredientItem.size;
              countItem(ingredientItem.sid, ingredientCount);

              links.push({
                target: nodes.indexOf(step.result.sid),
                source: nodes.indexOf(ingredientItem.sid),
                amount: ingredientCount,
              });

            });
          });

          return {
            nodes: nodes,
            links: links,
            goals: goalsItems,
            crafted: craftedItems,
            nodeLevels: nodeLevels,
            itemCounts: itemCounts,
          };

        },
        recalcRequired: function() {
          var _self = this;
          var required = {};
          var having = {};

          angular.forEach(_self.inventory, function(stack) {
            addToItemMap(having, stack.item, stack.count);
          });

          angular.forEach(_self.goals, function(goal) {
            addToItemMap(this, goal.item, goal.count);
          }, required);

          angular.forEach(_self.craftingSteps, function(step) {
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

            angular.forEach(step.recipe.ingredients, function(ingredient) {
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

          return {
            requiredItems: required,
            sideResults: having
          };
        },
        addStep: function(step) {
          console.log('add step', step.result.sid, 'by', step.recipe._id);
          var _self = this;
          var sameStepIndex = -1;
          angular.forEach(_self.craftingSteps, function(existingStep, index) {
            if (existingStep.result.sid === step.result.sid && existingStep.recipe._id === step.recipe._id) {
              sameStepIndex = index;
            }
          });

          if (sameStepIndex >= 0) {
            step.count += _self.craftingSteps[sameStepIndex].count;
            _self.craftingSteps.splice(sameStepIndex, 1);
          }
          _self.craftingSteps.push(step);
        },
        removeStep: function(step) {
          this.craftingSteps.splice(this.craftingSteps.indexOf(step), 1);
        },
        addItemToInventory: function(item, count) {
          var _self = this;
          addToItemList(_self.inventory, item, count);
        },
        toData: function() {
          return {
            name: this.name,
            data: angular.toJson({
              inventory: this.inventory,
              craftingSteps: this.craftingSteps,
              goals: this.goals,
            }),
          };
        }
      };

      return {
        createNewPlan: function() {
          return angular.extend(Object.create(plan$), {
            inventory: [],
            craftingSteps: [],
            goals: [],
            name: 'Untitled Plan',
          });
        },
        getAllPlans: function() {

          var deferred = $q.defer();
          plansDb.find().exec(function(err, plans) {
            if (err) {
              deferred.reject(err);
            } else {
              deferred.resolve(plans);
            }
          });

          return deferred.promise;
        },

        getPlanById: function(id) {

          var deferred = $q.defer();
          plansDb.findOne({
            _id: id
          }).exec(function(err, plan) {
            if (err) {
              deferred.reject(err);
            } else {
              var planData = angular.fromJson(plan.data);
              planData.name = plan.name;
              planData._id = plan._id;
              deferred.resolve(angular.extend(Object.create(plan$), planData));
            }
          });

          return deferred.promise;
        },

        createPlan: function(plan) {
          var deferred = $q.defer();
          plansDb.insert(plan.toData(), function(err, newPlan) {
            if (err) {
              deferred.reject(err);
            } else {
              plan._id = newPlan._id;
              deferred.resolve(plan);
            }
          });
          return deferred.promise;
        },

        updatePlan: function(id, plan) {
          var deferred = $q.defer();
          plansDb.update({
            _id: id
          }, plan.toData(), {}, function(err) {
            if (err) {
              deferred.reject(err);
            } else {
              deferred.resolve(plan);
            }
          });
          return deferred.promise;
        },

        savePlan: function(plan) {
          if (!plan._id) {
            return this.createPlan(plan);
          }
          return this.updatePlan(plan._id, plan);
        },

        removePlan: function(id) {
          var deferred = $q.defer();
          plansDb.remove({
            _id: id,
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
