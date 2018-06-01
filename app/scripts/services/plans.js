/* globals angular */
(function () {

  var getData = require('./data-adapter').requestData;

  angular.module('app').service('plansService', ['$q',
    function ($q) {

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

      var Step = function (stepData) {
        this.result = stepData.result;
        this.recipe = stepData.recipe;
        this.count = stepData.count;

        return angular.extend(this, {
          getId: function () {
            return this.result.sid + '-' + this.recipe._id;
          }
        });
      };

      var State = function () {
        var required = {};

        var addRequired = function (item, count) {
          addToItemMap(required, item, count);
        };
        var addProduced = function (item, count) {
          addToItemMap(required, item, -count);
        };
        var getRequiredCount = function (sid) {
          return required[sid] && required[sid].count > 0 ? required[sid].count : 0;
        };

        var getRequired = function () {
          var _required = [];
          angular.forEach(required, function (info, sid) {
            if (info.count > 0) {
              this.push(info);
            }
          }, _required);

          return _required;
        };

        var getProduced = function () {
          var _produced = [];
          angular.forEach(required, function (info, sid) {
            if (info.count < 0) {
              this.push({
                item: info.item,
                count: -info.count
              });
            }
          }, _produced);

          return _produced;
        };

        return angular.extend(this, {
          addRequired: addRequired,
          addProduced: addProduced,
          getRequiredCount: getRequiredCount,
          getRequired: getRequired,
          getProduced: getProduced,
          applyStep: function (step) {
            var resultSid = step.result.sid;
            var requiredCount = getRequiredCount(resultSid);

            var repeatCount = Math.ceil(requiredCount / step.result.size);
            var resultCount = step.result.size * repeatCount;
            step.count = repeatCount;

            addProduced(step.result, resultCount);

            angular.forEach(step.recipe.ingredients, function (ingredient) {
              var ingredientItem = ingredient[ingredient.activeIndex];

              var requiredCount = repeatCount * ingredientItem.size;

              addRequired(ingredientItem, requiredCount);
            });
          }
        });
      };

      var Dependencies = function (data) {
        this.data = data;

        return angular.extend(this, {
          get: function (source) {
            var deps = [];
            angular.forEach(this.data, function (dep) {
              if (dep.source === source) {
                this.push(dep.target);
              }
            }, deps);

            return deps;
          },
          add: function (source, target) {
            var exists = false;
            angular.forEach(this.data, function (dep) {
              if (dep.source === source && dep.target === target) {
                exists = false;
                return false;
              }
            });

            if (!exists) {
              this.data.push({
                source: source,
                target: target
              });
            }
          },
          remove: function (id) {
            var filtered = [];
            angular.forEach(this.data, function (dep) {
              if (dep.source !== id && dep.target !== id) {
                this.push(dep);
              }
            }, filtered);

            this.data = filtered;
          }
        });
      };

      var plan$ = {
        getGraphData: function () {
          var _self = this;
          var graph = {};

          var nodes = [];
          var links = [];

          var goalsItems = [];
          var craftedItems = [];

          var itemCounts = {};

          var createNode = function (itemSid) {
            if (nodes.indexOf(itemSid) < 0) {
              nodes.push(itemSid);
            }
          };

          var countItem = function (sid, count) {
            if (!itemCounts[sid]) {
              itemCounts[sid] = 0;
            }
            itemCounts[sid] += count;
          };

          angular.forEach(_self.goals, function (goal) {
            createNode(goal.item.sid);
            goalsItems.push(goal.item.sid);
            countItem(goal.item.sid, goal.count);
          });

          var craftable = [];
          var maxLevel = 0;
          var simpleLinks = []

          angular.forEach(_self.craftingSteps, function (step) {
            var resultSid = step.result.sid;
            var resultCount = step.result.size * step.count;

            createNode(step.result.sid);
            craftedItems.push(step.result.sid);

            craftable.push(step.result.sid);

            angular.forEach(step.recipe.ingredients, function (ingredient) {
              var ingredientItem = ingredient[ingredient.activeIndex];

              createNode(ingredientItem.sid);

              var ingredientCount = step.count * ingredientItem.size;
              countItem(ingredientItem.sid, ingredientCount);

              var target = nodes.indexOf(step.result.sid);
              var source = nodes.indexOf(ingredientItem.sid);

              if (target === source) {
                return;
              }

              var sameLink = false;
              angular.forEach(links, function (link) {
                if (link.target === target && link.source === source) {
                  sameLink = link;
                  return false;
                }
              });

              if (sameLink) {
                sameLink.amount += ingredientCount;
              } else {
                links.push({
                  target: target,
                  source: source,
                  amount: ingredientCount,
                  value: 1,
                });
              }

              simpleLinks.push({
                target: step.result.sid,
                source: ingredientItem.sid,
              });

            });
          });

          var nodeLevels = {};

          var updateLevels = function (checkLevel) {
            var updated = false;
            angular.forEach(nodeLevels, function (level, sid) {
              if (checkLevel === level) {

                angular.forEach(simpleLinks, function (link) {
                  if (link.source === sid && link.target !== sid) {
                    nodeLevels[link.target] = level + 1;
                    updated = true;
                  }
                })
              }
            })
            if (updated) {
              updateLevels(checkLevel + 1);
            }
          };

          angular.forEach(nodes, function (sid) {
            if (craftable.indexOf(sid) < 0) {
              nodeLevels[sid] = 0;
            }
          });

          updateLevels(0);

          return {
            nodes: nodes,
            links: links,
            goals: goalsItems,
            crafted: craftedItems,
            nodeLevels: nodeLevels,
            itemCounts: itemCounts,
          };

        },
        recalcRequired: function () {
          var _self = this;

          var state = new State();

          angular.forEach(_self.inventory, function (stack) {
            state.addProduced(stack.item, stack.count);
          });

          angular.forEach(_self.goals, function (stack) {
            state.addRequired(stack.item, stack.count);
          });

          var stepComplete = [];
          var stepOrder = [];

          var stepByIdMap = {};

          angular.forEach(_self.craftingSteps, function (step) {
            stepByIdMap[step.getId()] = step;
          }, stepByIdMap);

          var _processStep = function (step, state) {

            angular.forEach(_self.dependencies.get(step.getId()), function (stepId) {
              processStep(stepId, state);
            });

            state.applyStep(step);
            stepComplete.push(step.getId());
            stepOrder.push(step);
          };

          var processStep = function (stepId, state) {
            if (stepComplete.indexOf(stepId) >= 0) {
              return true;
            }

            var step = stepByIdMap[stepId];
            if (step) {
              _processStep(step, state);
            }
          };

          angular.forEach(_self.craftingSteps, function (step) {
            processStep(step.getId(), state);
          });

          _self.craftingSteps = stepOrder;

          return {
            requiredItems: state.getRequired(),
            sideResults: state.getProduced()
          };
        },
        addStep: function (step) {
          var _self = this;
          var sameStep;

          var newStep = new Step(step);

          angular.forEach(_self.craftingSteps, function (existingStep, index) {
            if (existingStep.getId() === newStep.getId()) {
              sameStep = existingStep;
            }
          });

          if (!sameStep) {
            var ownIngredients = [];
            angular.forEach(step.recipe.ingredients, function (ingredient) {
              var ingredientItem = ingredient[ingredient.activeIndex];
              this.push(ingredientItem.sid);
            }, ownIngredients);

            angular.forEach(_self.craftingSteps, function (step) {

              var ingredientSids = [];
              angular.forEach(step.recipe.ingredients, function (ingredient) {
                var ingredientItem = ingredient[ingredient.activeIndex];
                this.push(ingredientItem.sid);
              }, ingredientSids);

              if (ingredientSids.indexOf(newStep.result.sid) >= 0) {
                _self.dependencies.add(newStep.getId(), step.getId());
              }

              if (ownIngredients.indexOf(step.result.sid) >= 0) {
                _self.dependencies.add(step.getId(), newStep.getId());
              }
            });

            _self.craftingSteps.push(newStep);
          }
        },
        removeStep: function (step) {
          this.craftingSteps.splice(this.craftingSteps.indexOf(step), 1);
          this.dependencies.remove(step.getId());
        },
        addItemToInventory: function (item, count) {
          var _self = this;
          addToItemList(_self.inventory, item, count);
        },
        toData: function () {
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

      var createPlanObject = function (initObject) {
        var steps = []
        angular.forEach(initObject.craftingSteps, function (step) {
          this.push(new Step(step));
        }, steps);

        initObject.craftingSteps = steps;
        initObject.dependencies = new Dependencies(initObject.dependencies || []);
        return angular.extend(Object.create(plan$), initObject);
      };

      return {
        createNewPlan: function () {
          return createPlanObject({
            inventory: [],
            craftingSteps: [],
            goals: [],
            name: 'Untitled Plan',
          });
        },
        getAllPlans: function () {

          var deferred = $q.defer();
          getData('plans-find', {}, function (plans) {
            deferred.resolve(plans);
          });

          return deferred.promise;
        },

        getPlanById: function (id) {

          var deferred = $q.defer();
          getData('plans-find-one', {
            query: {
              _id: id
            }
          }, function (plan) {
            var planData = angular.fromJson(plan.data);
            planData.name = plan.name;
            planData._id = plan._id;
            deferred.resolve(createPlanObject(planData));
          });

          return deferred.promise;
        },

        createPlan: function (plan) {
          var deferred = $q.defer();
          getData('plans-insert', {
            data: plan.toData(),
            options: {}
          }, function (newPlan) {
            plan._id = newPlan._id;
            deferred.resolve(plan);
          });
          return deferred.promise;
        },

        updatePlan: function (id, plan) {
          var deferred = $q.defer();
          getData('plans-update', {
            query: {
              _id: id
            },
            data: plan.toData(),
            options: {}
          }, function () {
            deferred.resolve(plan);
          });
          return deferred.promise;
        },

        savePlan: function (plan) {
          if (!plan._id) {
            return this.createPlan(plan);
          }
          return this.updatePlan(plan._id, plan);
        },

        removePlan: function (id) {
          var deferred = $q.defer();
          getData('plans-remove', {
            query: {
              _id: id,
            }
          }, function () {
            deferred.resolve();
          });
          return deferred.promise;
        },

      };
    }
  ]);

})();
