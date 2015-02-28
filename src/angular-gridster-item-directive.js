'use strict';

angular.module('gridster')

.directive('gridsterItem', ['$parse', 'GridsterDraggable', 'GridsterResizable',
	function($parse, GridsterDraggable, GridsterResizable) {
		return {
			restrict: 'EA',
			controller: 'GridsterItemCtrl',
			require: ['^gridster', 'gridsterItem'],
			link: function(scope, $el, attrs, controllers) {
				var optionsKey = attrs.gridsterItem,
					options;

				var gridster = controllers[0],
					item = controllers[1];

				// bind the item's position properties
				if (optionsKey) {
					var $optionsGetter = $parse(optionsKey);
					options = $optionsGetter(scope) || {};
					if (!options && $optionsGetter.assign) {
						options = {
							row: item.row,
							col: item.col,
							sizeX: item.sizeX,
							sizeY: item.sizeY,
							minSizeX: 0,
							minSizeY: 0,
							maxSizeX: null,
							maxSizeY: null,
							resizable: false,
							draggable: false
						};
						$optionsGetter.assign(scope, options);
					}
				} else {
					options = attrs;
				}
				if (options.resizable === undefined) {
					options.resizable = gridster.resizable.enabled;
				}
				if (options.draggable === undefined) {
					options.draggable = gridster.draggable.enabled;
				}

				item.init($el, gridster);

				$el.addClass('gridster-item');

				var aspects = ['minSizeX', 'maxSizeX', 'minSizeY', 'maxSizeY', 'sizeX', 'sizeY', 'row', 'col', 'resizable', 'draggable'],
					$getters = {};

				var aspectFn = function(aspect) {
					var key;
					if (typeof options[aspect] === 'string') {
						key = options[aspect];
					} else if (typeof options[aspect.toLowerCase()] === 'string' || typeof options[aspect.toLowerCase()] === 'boolean') {
						key = options[aspect.toLowerCase()];
					} else if (optionsKey) {
						key = $parse(optionsKey + '.' + aspect);
					} else {
						return;
					}
					$getters[aspect] = $parse(key);

					// when the value changes externally, update the internal item object
					scope.$watch(key, function(newVal) {
						newVal = parseInt(newVal, 10);
						if (!isNaN(newVal)) {
							item[aspect] = newVal;
						}
					});

					// initial set
					var val = $getters[aspect](scope);
					if (typeof val === 'number' || typeof val === 'boolean') {
						item[aspect] = val;
					}
				};

				for (var i = 0, l = aspects.length; i < l; ++i) {
					aspectFn(aspects[i]);
				}

				if (item.resizable === undefined) {
					item.resizable = options.resizable === undefined ? gridster.resizable.enabled : options.resizable;
				}
				if (item.draggable === undefined) {
					item.draggable = options.draggable === undefined ? gridster.draggable.enabled : options.draggable;
				}

				scope.$broadcast('gridster-item-initialized', [item.sizeY, item.sizeX, item.getElementSizeY(), item.getElementSizeX()]);

				function positionChanged() {
					// call setPosition so the element and gridster controller are updated
					item.setPosition(item.row, item.col);

					// when internal item position changes, update externally bound values
					if ($getters.row && $getters.row.assign) {
						$getters.row.assign(scope, item.row);
					}
					if ($getters.col && $getters.col.assign) {
						$getters.col.assign(scope, item.col);
					}
				}
				scope.$watch(function() {
					return item.row + ',' + item.col;
				}, positionChanged);

				function sizeChanged() {
					var changedX = item.setSizeX(item.sizeX, true);
					if (changedX && $getters.sizeX && $getters.sizeX.assign) {
						$getters.sizeX.assign(scope, item.sizeX);
					}
					var changedY = item.setSizeY(item.sizeY, true);
					if (changedY && $getters.sizeY && $getters.sizeY.assign) {
						$getters.sizeY.assign(scope, item.sizeY);
					}

					if (changedX || changedY) {
						item.gridster.moveOverlappingItems(item);
						gridster.layoutChanged();
					}
				}
				scope.$watch(function() {
					return item.sizeY + ',' + item.sizeX + '|' + item.minSizeX + ',' + item.maxSizeX + ',' + item.minSizeY + ',' + item.maxSizeY;
				}, sizeChanged);

				var draggable = new GridsterDraggable($el, scope, gridster, item, options);
				var resizable = new GridsterResizable($el, scope, gridster, item, options);

				scope.$on('gridster-draggable-changed', function() {
					draggable.toggle(!gridster.isMobile && gridster.draggable && gridster.draggable.enabled && item.draggable);
				});
				scope.$on('gridster-resizable-changed', function() {
					resizable.toggle(!gridster.isMobile && gridster.resizable && gridster.resizable.enabled && item.resizable);
				});
				scope.$on('gridster-resized', function() {
					resizable.toggle(!gridster.isMobile && gridster.resizable && gridster.resizable.enabled && item.resizable);
				});
				scope.$watch(function() {
					return gridster.isMobile;
				}, function() {
					resizable.toggle(!gridster.isMobile && gridster.resizable && gridster.resizable.enabled && item.resizable);
					draggable.toggle(!gridster.isMobile && gridster.draggable && gridster.draggable.enabled && item.draggable);
				});

				function whichTransitionEvent() {
					var el = document.createElement('div');
					var transitions = {
						'transition': 'transitionend',
						'OTransition': 'oTransitionEnd',
						'MozTransition': 'transitionend',
						'WebkitTransition': 'webkitTransitionEnd'
					};
					for (var t in transitions) {
						if (el.style[t] !== undefined) {
							return transitions[t];
						}
					}
				}

				$el.on(whichTransitionEvent(), function() {
					scope.$apply(function() {
						scope.$broadcast('gridster-item-transition-end');
					});
				});

				return scope.$on('$destroy', function() {
					try {
						resizable.destroy();
						draggable.destroy();
					} catch (e) {}

					try {
						gridster.removeItem(item);
					} catch (e) {}

					try {
						item.destroy();
					} catch (e) {}
				});
			}
		};
	}
]);
