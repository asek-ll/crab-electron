var _ = require('underscore');
var Datastore = require('nedb');

var itemDb = new Datastore({
  filename: './items.db',
  autoload: true
});

var items = require('./items_dump.json');

_.each(items, function (item) {
  itemDb.insert(item);
});

var recipesDb = new Datastore({
  filename: './recipes.db',
  autoload: true
});

var handlers = require('./recipes.json');

_.each(handlers, function (handler) {
  var handlerName = handler.name;
  _.each(handler.recipes, function (recipe) {
    recipe.handlerName = handlerName;
    recipesDb.insert(recipe);
  });
});
