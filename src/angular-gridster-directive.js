'use strict';

angular.module('gridster')

.directive('gridster', ['$timeout', '$rootScope', '$window',
	function($timeout, $rootScope, $window) {
		return {
			restrict: 'EAC',
			// without transclude, some child items may lose their parent scope
			transclude: true,
			replace: true,
			template: '<div ng-class="gridsterClass()"><div ng-style="previewStyle()" class="gridster-item gridster-preview-holder"></div><div class="gridster-content" ng-transclude></div></div>',
			controller: 'GridsterCtrl',
			controllerAs: 'gridster',
			scope: {
				config: '=?gridster'
			},
			compile: function() {

				return function(scope, $elem, attrs, gridster) {
					gridster.loaded = false;

					scope.gridsterClass = function() {
						return {
							gridster: true,
							'gridster-desktop': !gridster.isMobile,
							'gridster-mobile': gridster.isMobile,
							'gridster-loaded': gridster.loaded
						};
					};

					/**
					 * @returns {Object} style object for preview element
					 */
					scope.previewStyle = function() {
						if (!gridster.movingItem) {
							return {
								display: 'none'
							};
						}

						return {
							display: 'block',
							height: (gridster.movingItem.sizeY * gridster.curRowHeight - gridster.margins[0]) + 'px',
							width: (gridster.movingItem.sizeX * gridster.curColWidth - gridster.margins[1]) + 'px',
							top: (gridster.movingItem.row * gridster.curRowHeight + (gridster.outerMargin ? gridster.margins[0] : 0)) + 'px',
							left: (gridster.movingItem.col * gridster.curColWidth + (gridster.outerMargin ? gridster.margins[1] : 0)) + 'px'
						};
					};

					var refresh = function() {
						gridster.setOptions(scope.config);

						// resolve "auto" & "match" values
						if (gridster.width === 'auto') {
							gridster.curWidth = $elem[0].offsetWidth || parseInt($elem.css('width'), 10);
						} else {
							gridster.curWidth = gridster.width;
						}

						if (gridster.colWidth === 'auto') {
							gridster.curColWidth = (gridster.curWidth + (gridster.outerMargin ? -gridster.margins[1] : gridster.margins[1])) / gridster.columns;
						} else {
							gridster.curColWidth = gridster.colWidth;
						}

						gridster.curRowHeight = gridster.rowHeight;
						if (typeof gridster.rowHeight === 'string') {
							if (gridster.rowHeight === 'match') {
								gridster.curRowHeight = Math.round(gridster.curColWidth);
							} else if (gridster.rowHeight.indexOf('*') !== -1) {
								gridster.curRowHeight = Math.round(gridster.curColWidth * gridster.rowHeight.replace('*', '').replace(' ', ''));
							} else if (gridster.rowHeight.indexOf('/') !== -1) {
								gridster.curRowHeight = Math.round(gridster.curColWidth / gridster.rowHeight.replace('/', '').replace(' ', ''));
							}
						}

						gridster.isMobile = gridster.mobileModeEnabled && gridster.curWidth <= gridster.mobileBreakPoint;

						// loop through all items and reset their CSS
						for (var rowIndex = 0, l = gridster.grid.length; rowIndex < l; ++rowIndex) {
							var columns = gridster.grid[rowIndex];
							if (!columns) {
								continue;
							}

							for (var colIndex = 0, len = columns.length; colIndex < len; ++colIndex) {
								if (columns[colIndex]) {
									var item = columns[colIndex];
									item.setElementPosition();
									item.setElementSizeY();
									item.setElementSizeX();
								}
							}
						}

						updateHeight();
					};

					// update grid items on config changes
					scope.$watch('config', refresh, true);

					scope.$watch('config.draggable', function() {
						$rootScope.$broadcast('gridster-draggable-changed');
					}, true);

					scope.$watch('config.resizable', function() {
						$rootScope.$broadcast('gridster-resizable-changed');
					}, true);

					var updateHeight = function() {
						$elem.css('height', (gridster.gridHeight * gridster.curRowHeight) + (gridster.outerMargin ? gridster.margins[0] : -gridster.margins[0]) + 'px');
					};

					scope.$watch('gridster.gridHeight', updateHeight);

					scope.$watch('gridster.movingItem', function() {
						gridster.updateHeight(gridster.movingItem ? gridster.movingItem.sizeY : 0);
					});

					var prevWidth = $elem[0].offsetWidth || parseInt($elem.css('width'), 10);

					function resize() {
						var width = $elem[0].offsetWidth || parseInt($elem.css('width'), 10);

						if (!width || width === prevWidth || gridster.movingItem) {
							return;
						}
						prevWidth = width;

						if (gridster.loaded) {
							$elem.removeClass('gridster-loaded');
						}

						refresh();

						if (gridster.loaded) {
							$elem.addClass('gridster-loaded');
						}

						scope.$parent.$broadcast('gridster-resized', [width, $elem[0].offsetHeight]);
					}

					// track element width changes any way we can
					function onResize() {
						resize();
						$timeout(function() {
							scope.$apply();
						});
					}
					if (typeof $elem.resize === 'function') {
						$elem.resize(onResize);
					}
					var $win = angular.element($window);
					$win.on('resize', onResize);

					scope.$watch(function() {
						return $elem[0].offsetWidth || parseInt($elem.css('width'), 10);
					}, resize);

					// be sure to cleanup
					scope.$on('$destroy', function() {
						gridster.destroy();
						$win.off('resize', onResize);
					});

					// allow a little time to place items before floating up
					$timeout(function() {
						scope.$watch('gridster.floating', function() {
							gridster.floatItems();
						});
						gridster.loaded = true;
					}, 100);
				};
			}
		};
	}
]);
