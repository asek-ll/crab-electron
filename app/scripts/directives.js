/* globals angular */
var d3 = require('../bower_components/d3/d3.js');

var getItemIcon = function(item) {
  if (!item) {
    return '';
  }
  var parts = item.sid.split(':');
  var path = parts[0] + '/' + parts[1];
  if (parts.length > 2) {
    path += '_' + parts[2];
  }

  return '../data/icons/' + path + '.png';
};

angular.module('app').directive('ingredient', ['itemService', '$compile',
  function(itemService, $compile) {
    return {
      restrict: 'E',
      scope: {
        ingredient: '=data'
      },
      transclude: true,
      templateUrl: './templates/ingredient.tpl.html',
      link: function(scope, element) {
        scope.itemCount = scope.ingredient.items.length;
        scope.ingredient.activeIndex = scope.ingredient.activeIndex || 0;

        scope.next = function() {
          scope.ingredient.activeIndex = (scope.ingredient.activeIndex + 1) % scope.itemCount;
        };
      },
    };
  }
]);

angular.module('app').directive('itemStack', ['itemService',
  function(itemService) {
    return {
      restrict: 'E',
      scope: {
        item: '=item',
        sid: '=sid',
        size: '=size',
      },
      transclude: true,
      templateUrl: './templates/directives/item-stack.tpl.html',
      link: function(scope, element) {
        scope.$watchGroup(['sid', 'item'], function () {
          var item = scope.item;
          var sid = scope.sid;

          scope.itemIcon = getItemIcon;

          if (item) {
            scope.item = item;
          } else if (sid) {
            itemService.getItemBySid(sid).then(function(item) {
              scope.item = item;
            });
          }
        });
      },
    };
  }
]);

angular.module('app').directive('recipe', ['itemService',
  function() {
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
  function() {
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
  function() {
    return {
      restrict: 'E',
      transclude: true,
      scope: {
        inventory: '=model',
        onInventoryChanged: '&callback',
      },
      controllerAs: 'ctrl',
      templateUrl: './templates/directives/inventory.tpl.html',
      link: function($scope) {
        $scope.inventory = $scope.inventory || [];

        $scope.removeInventoryItem = function(stack) {
          var stacks = $scope.inventory;
          stacks.splice(stacks.indexOf(stack), 1);
        };

        $scope.$on('itemAdded', function(event, item) {
          if (item) {
            $scope.inventory.push({
              item: item,
              count: 1
            });
          }
        });

        $scope.$watch(function() {

          var res = [];
          angular.forEach($scope.inventory, function(stack) {
            this.push(stack.item.sid + '-' + stack.count);
          }, res);
          return res.join('|');

        }, function() {
          $scope.onInventoryChanged({
            inventory: $scope.inventory
          });
        });
      }
    };
  }
]);

angular.module('app').directive('craftGraph', ['itemService', '$q',

  function(itemService, $q) {
    return {
      restrict: 'E',
      scope: {
        plan: '=',
        enabled: '=',
      },
      //transclude: true,
      //templateUrl: './templates/ingredient.tpl.html',
      link: function(scope, element) {

        var width = 800;
        var height = 1000;

        var container;

        var zoom = d3.behavior.zoom()
          .scaleExtent([0.1, 1])
          .on("zoom", function() {
            container.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
          });

        var svg = d3.select(element[0])
          .append('svg')
          .attr('width', "100%")
          .attr('height', height)
          .call(zoom);

        container = svg.append("g");

        var color = d3.scale.category20();

        var updateGraph = function() {

          var graphData = scope.plan.getGraphData();

          var itemPromises = [];

          var posOnLevel = {};

          angular.forEach(graphData.nodes, function(sid) {
            var deferred = $q.defer();

            itemService.getItemBySid(sid).then(function(item) {
              var isGoal = graphData.goals.indexOf(sid) >= 0;

              var level = graphData.nodeLevels[sid];
              var pos = posOnLevel[level] ? posOnLevel[level] : 0;
              posOnLevel[level] = pos + 1;

              deferred.resolve({
                item: item,
                id: sid,
                //fixed: isGoal,
                fixed: true,
                x: pos * 100,
                y: level * 100,
                count: graphData.itemCounts[sid]
              });
            });

            this.push(deferred.promise);
          }, itemPromises);

          var nodeIsLeaf = function(node) {
            return graphData.goals.indexOf(node.id) < 0 && graphData.crafted.indexOf(node.id) < 0;
          };

          $q.all(itemPromises).then(function(nodes) {
            container.selectAll('*').remove();

            var force = d3.layout.force()
              .gravity(0)
              .charge(function(node) {
                return nodeIsLeaf(node) ? -2000 : -200;
              })
              .linkDistance(200)
              .gravity(0)
              .linkStrength(0.5)
              .size([width, height]);

            force
              .nodes(nodes)
              .links(graphData.links)
              .start();

            var node = container.selectAll('.node')
              .data(nodes)
              .enter().append('g')
              .attr('class', function(d) {
                return 'node' + (nodeIsLeaf(d) ? ' node-leaf' : '');
              })
              .attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
              })
              .on('mouseover', function(d) {
                d.isHovered = true;
                onTick();
              })
              .on('mouseout', function(d) {
                d.isHovered = false;
                onTick();
              })
              .call(force.drag);

            node.append("title")
              .text(function(d) {
                return d.item.displayName;
              });

            node.append("image")
              .attr("xlink:href", function(d) {
                return getItemIcon(d.item);
              })
              .attr('x', '-24px')
              .attr('y', '-24px')
              .attr('width', '48px')
              .attr('height', '48px');

            node.append('text')
              .attr('dx', 28)
              .attr('dy', 4)
              .text(function(d) {
                return d.count;
              });

            var linkEl = container.selectAll('.link')
              .data(graphData.links)
              .enter();

            var link = linkEl.append('line')
              .attr('class', 'link');

            var linkText = linkEl.append('text');

            linkText.attr('x', function(d) {
                return (d.target.x + d.source.x) / 2;
              })
              .attr('y', function(d) {
                return (d.target.y + d.source.y) / 2;
              })
              .style('visibility', function(d) {
                if (d.source.isHovered || d.target.isHovered) {
                  return 'visible';
                }
                return 'hidden';
              })
              .text(function(d) {
                return d.amount;
              });

            var onTick = function() {
              link.attr("x1", function(d) {
                  var delta = 0;
                  if (d.target.x !== d.source.x) {
                    delta = 24;
                  }
                  if (d.target.x < d.source.x) {
                    delta *= -1;
                  }
                  return d.source.x + delta;
                })
                .attr("y1", function(d) {
                  var delta = 0;
                  if (d.target.y !== d.source.y) {
                    delta = 24;
                  }
                  if (d.target.y < d.source.y) {
                    delta *= -1;
                  }
                  return d.source.y + delta;
                })
                .attr("x2", function(d) {
                  var delta = 0;
                  if (d.target.x !== d.source.x) {
                    delta = 24;
                  }
                  if (d.target.x > d.source.x) {
                    delta *= -1;
                  }
                  return d.target.x + delta;
                })
                .attr("y2", function(d) {
                  var delta = 0;
                  if (d.target.y !== d.source.y) {
                    delta = 24;
                  }
                  if (d.target.y > d.source.y) {
                    delta *= -1;
                  }
                  return d.target.y + delta;
                })
                .style("stroke", function(d) {
                  if (d.source.isHovered) {
                    return 'red';
                  }
                  if (d.target.isHovered) {
                    return 'green';
                  }
                  return '#999';
                })
                .style("stroke-width", function(d) {
                  if (d.source.isHovered || d.target.isHovered) {
                    return 6;
                  }
                  return 1;
                });

              node
                .attr("transform", function(d) {
                  return "translate(" + d.x + "," + d.y + ")";
                });
            };

            force.on("tick", onTick);

          });

        };

        scope.$watch(function() {
          var ids = [];
          angular.forEach(scope.plan.craftingSteps, function(step) {
            this.push(step.result.sid + ':' + step.count);
          }, ids);
          return ids.sort().join('|');
        }, function() {
          if (scope.enabled) {
            updateGraph();
          }

        });

        scope.$watch('enabled', function() {
          if (scope.enabled) {
            updateGraph();
          }
        });

      },
    };
  }
]);
