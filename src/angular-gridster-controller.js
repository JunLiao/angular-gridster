'use strict';

angular.module('gridster')

.controller('GridsterCtrl', ['gridsterConfig', '$timeout',
	function(gridsterConfig, $timeout) {

		var gridster = this;

		/**
		 * Create options from gridsterConfig constant
		 */
		angular.extend(this, gridsterConfig);

		this.resizable = angular.extend({}, gridsterConfig.resizable || {});
		this.draggable = angular.extend({}, gridsterConfig.draggable || {});

		var flag = false;
		this.layoutChanged = function() {
			if (flag) {
				return;
			}
			flag = true;
			$timeout(function() {
				flag = false;
				if (gridster.loaded) {
					gridster.floatItemsUp();
				}
				gridster.updateHeight(gridster.movingItem ? gridster.movingItem.sizeY : 0);
			});
		};

		/**
		 * A positional array of the items in the grid
		 */
		this.grid = [];

		/**
		 * Clean up after yourself
		 */
		this.destroy = function() {
			if (this.grid) {
				this.grid.length = 0;
				this.grid = null;
			}
		};

		/**
		 * Overrides default options
		 *
		 * @param {object} options The options to override
		 */
		this.setOptions = function(options) {
			if (!options) {
				return;
			}

			options = angular.extend({}, options);

			// all this to avoid using jQuery...
			if (options.draggable) {
				angular.extend(this.draggable, options.draggable);
				delete(options.draggable);
			}
			if (options.resizable) {
				angular.extend(this.resizable, options.resizable);
				delete(options.resizable);
			}

			angular.extend(this, options);

			if (!this.margins || this.margins.length !== 2) {
				this.margins = [0, 0];
			} else {
				for (var x = 0, l = this.margins.length; x < l; ++x) {
					this.margins[x] = parseInt(this.margins[x], 10);
					if (isNaN(this.margins[x])) {
						this.margins[x] = 0;
					}
				}
			}
		};

		/**
		 * Check if item can occupy a specified position in the grid
		 *
		 * @param {object} item The item in question
		 * @param {number} row The row index
		 * @param {number} column The column index
		 * @returns {boolean} True if if item fits
		 */
		this.canItemOccupy = function(item, row, column) {
			return row > -1 && column > -1 && item.sizeX + column <= this.columns && item.sizeY + row <= this.maxRows;
		};

		/**
		 * Set the item in the first suitable position
		 *
		 * @param {object} item The item to insert
		 */
		this.autoSetItemPosition = function(item) {
			// walk through each row and column looking for a place it will fit
			for (var rowIndex = 0; rowIndex < this.maxRows; ++rowIndex) {
				for (var colIndex = 0; colIndex < this.columns; ++colIndex) {
					// only insert if position is not already taken and it can fit
					var items = this.getItems(rowIndex, colIndex, item.sizeX, item.sizeY, item);
					if (items.length === 0 && this.canItemOccupy(item, rowIndex, colIndex)) {
						this.putItem(item, rowIndex, colIndex);
						return;
					}
				}
			}
			throw new Error('Unable to place item!');
		};

		/**
		 * Gets items at a specific coordinate
		 *
		 * @param {number} row
		 * @param {number} column
		 * @param {number} sizeX
		 * @param {number} sizeY
		 * @param {array} excludeItems An array of items to exclude from selection
		 * @returns {array} Items that match the criteria
		 */
		this.getItems = function(row, column, sizeX, sizeY, excludeItems) {
			var items = [];
			if (!sizeX || !sizeY) {
				sizeX = sizeY = 1;
			}
			if (excludeItems && !(excludeItems instanceof Array)) {
				excludeItems = [excludeItems];
			}
			for (var h = 0; h < sizeY; ++h) {
				for (var w = 0; w < sizeX; ++w) {
					var item = this.getItem(row + h, column + w, excludeItems);
					if (item && (!excludeItems || excludeItems.indexOf(item) === -1) && items.indexOf(item) === -1) {
						items.push(item);
					}
				}
			}
			return items;
		};

		this.getBoundingBox = function(items) {

			if (items.length === 0) {
				return null;
			}
			if (items.length === 1) {
				return {
					row: items[0].row,
					col: items[0].col,
					sizeY: items[0].sizeY,
					sizeX: items[0].sizeX
				};
			}

			var maxRow = 0;
			var maxCol = 0;
			var minRow = 9999;
			var minCol = 9999;

			for (var i = 0, l = items.length; i < l; ++i) {
				var item = items[i];
				minRow = Math.min(item.row, minRow);
				minCol = Math.min(item.col, minCol);
				maxRow = Math.max(item.row + item.sizeY, maxRow);
				maxCol = Math.max(item.col + item.sizeX, maxCol);
			}

			return {
				row: minRow,
				col: minCol,
				sizeY: maxRow - minRow,
				sizeX: maxCol - minCol
			};
		};


		/**
		 * Removes an item from the grid
		 *
		 * @param {object} item
		 */
		this.removeItem = function(item) {
			for (var rowIndex = 0, l = this.grid.length; rowIndex < l; ++rowIndex) {
				var columns = this.grid[rowIndex];
				if (!columns) {
					continue;
				}
				var index = columns.indexOf(item);
				if (index !== -1) {
					columns[index] = null;
					break;
				}
			}
			this.layoutChanged();
		};

		/**
		 * Returns the item at a specified coordinate
		 *
		 * @param {number} row
		 * @param {number} column
		 * @param {array} excludeitems Items to exclude from selection
		 * @returns {object} The matched item or null
		 */
		this.getItem = function(row, column, excludeItems) {
			if (excludeItems && !(excludeItems instanceof Array)) {
				excludeItems = [excludeItems];
			}
			var sizeY = 1;
			while (row > -1) {
				var sizeX = 1,
					col = column;
				while (col > -1) {
					var items = this.grid[row];
					if (items) {
						var item = items[col];
						if (item && (!excludeItems || excludeItems.indexOf(item) === -1) && item.sizeX >= sizeX && item.sizeY >= sizeY) {
							return item;
						}
					}
					++sizeX;
					--col;
				}
				--row;
				++sizeY;
			}
			return null;
		};

		/**
		 * Insert an array of items into the grid
		 *
		 * @param {array} items An array of items to insert
		 */
		this.putItems = function(items) {
			for (var i = 0, l = items.length; i < l; ++i) {
				this.putItem(items[i]);
			}
		};

		/**
		 * Insert a single item into the grid
		 *
		 * @param {object} item The item to insert
		 * @param {number} row (Optional) Specifies the items row index
		 * @param {number} column (Optional) Specifies the items column index
		 * @param {array} ignoreItems
		 */
		this.putItem = function(item, row, column, ignoreItems) {
			if (typeof row === 'undefined' || row === null) {
				row = item.row;
				column = item.col;
				if (typeof row === 'undefined' || row === null) {
					this.autoSetItemPosition(item);
					return;
				}
			}
			if (!this.canItemOccupy(item, row, column)) {
				column = Math.min(this.columns - item.sizeX, Math.max(0, column));
				row = Math.min(this.maxRows - item.sizeY, Math.max(0, row));
			}

			if (item.oldRow !== null && typeof item.oldRow !== 'undefined') {
				var samePosition = item.oldRow === row && item.oldColumn === column;
				var inGrid = this.grid[row] && this.grid[row][column] === item;
				if (samePosition && inGrid) {
					item.row = row;
					item.col = column;
					return;
				} else {
					// remove from old position
					var oldRow = this.grid[item.oldRow];
					if (oldRow && oldRow[item.oldColumn] === item) {
						delete oldRow[item.oldColumn];
					}
				}
			}

			item.oldRow = item.row = row;
			item.oldColumn = item.col = column;

			this.moveOverlappingItems(item, ignoreItems);

			if (!this.grid[row]) {
				this.grid[row] = [];
			}
			this.grid[row][column] = item;

			if (this.movingItem === item) {
				this.floatItemLeft(item);
				this.floatItemUp(item);
			}
			this.layoutChanged();
		};

		/**
		 * Trade row and column if item1 with item2
		 *
		 * @param {object} item1
		 * @param {object} item2
		 */
		this.swapItems = function(item1, item2) {
			this.grid[item1.row][item1.col] = item2;
			this.grid[item2.row][item2.col] = item1;

			var item1Row = item1.row;
			var item1Col = item1.col;
			item1.row = item2.row;
			item1.col = item2.col;
			item2.row = item1Row;
			item2.col = item1Col;
		};

		/**
		 * Prevents items from being overlapped
		 *
		 * @param {object} item The item that should remain
		 * @param {array} ignoreItems
		 */
		this.moveOverlappingItems = function(item, ignoreItems) {
			if (ignoreItems) {
				if (ignoreItems.indexOf(item) === -1) {
					ignoreItems = ignoreItems.slice(0);
					ignoreItems.push(item);
				}
			} else {
				ignoreItems = [item];
			}
			var overlappingItems = this.getItems(
				item.row,
				item.col,
				item.sizeX,
				item.sizeY,
				ignoreItems
			);
			this.moveItemsDown(overlappingItems, item.row + item.sizeY, ignoreItems);
		};

		/**
		 * Moves an array of items to a specified row
		 *
		 * @param {array} items The items to move
		 * @param {number} newRow The target row
		 * @param {array} ignoreItems
		 */
		this.moveItemsDown = function(items, newRow, ignoreItems) {
			if (!items || items.length === 0) {
				return;
			}
			items.sort(function(a, b) {
				return a.row - b.row;
			});
			ignoreItems = ignoreItems ? ignoreItems.slice(0) : [];
			var topRows = {},
				item, i, l;
			// calculate the top rows in each column
			for (i = 0, l = items.length; i < l; ++i) {
				item = items[i];
				var topRow = topRows[item.col];
				if (typeof topRow === 'undefined' || item.row < topRow) {
					topRows[item.col] = item.row;
				}
			}
			// move each item down from the top row in its column to the row
			for (i = 0, l = items.length; i < l; ++i) {
				item = items[i];
				var rowsToMove = newRow - topRows[item.col];
				this.moveItemDown(item, item.row + rowsToMove, ignoreItems);
				ignoreItems.push(item);
			}
		};

		this.moveItemDown = function(item, newRow, ignoreItems) {
			if (item.row >= newRow) {
				return;
			}
			while (item.row < newRow) {
				++item.row;
				this.moveOverlappingItems(item, ignoreItems);
			}
			this.putItem(item, item.row, item.col, ignoreItems);
		};

		/**
		 * Moves all items up as much as possible
		 */
		this.floatItemsUp = function() {
			if (this.floating === false) {
				return;
			}
			for (var rowIndex = 0, l = this.grid.length; rowIndex < l; ++rowIndex) {
				var columns = this.grid[rowIndex];
				if (!columns) {
					continue;
				}
				for (var colIndex = 0, len = columns.length; colIndex < len; ++colIndex) {
					var item = columns[colIndex];
					if (item) {
						this.floatItemUp(item);
					}
				}
			}
		};

		/**
		 * Float an item up to the most suitable row
		 *
		 * @param {object} item The item to move
		 */
		this.floatItemUp = function(item) {
			if (this.floating === false) {
				return;
			}
			var colIndex = item.col,
				sizeY = item.sizeY,
				sizeX = item.sizeX,
				bestRow = null,
				bestColumn = null,
				rowIndex = item.row - 1;
			var items;

			while (rowIndex > -1) {
				items = this.getItems(rowIndex, colIndex, sizeX, sizeY, item);
				if (items.length !== 0) {
					break;
				}
				bestRow = rowIndex;
				bestColumn = colIndex;
				--rowIndex;
			}
			if (bestRow !== null) {
				this.putItem(item, bestRow, bestColumn);
			}
		};

		/**
		 * Update gridsters height
		 *
		 * @param {number} plus (Optional) Additional height to add
		 */
		this.updateHeight = function(plus) {
			var maxHeight = this.minRows;
			plus = plus || 0;
			for (var rowIndex = this.grid.length; rowIndex >= 0; --rowIndex) {
				var columns = this.grid[rowIndex];
				if (!columns) {
					continue;
				}
				for (var colIndex = 0, len = columns.length; colIndex < len; ++colIndex) {
					if (columns[colIndex]) {
						maxHeight = Math.max(maxHeight, rowIndex + plus + columns[colIndex].sizeY);
					}
				}
			}
			this.gridHeight = this.maxRows - maxHeight > 0 ? Math.min(this.maxRows, maxHeight) : Math.max(this.maxRows, maxHeight);
		};

		/**
		 * Returns the number of rows that will fit in given amount of pixels
		 *
		 * @param {number} pixels
		 * @param {boolean} ceilOrFloor (Optional) Determines rounding method
		 */
		this.pixelsToRows = function(pixels, ceilOrFloor) {
			if (ceilOrFloor === true) {
				return Math.ceil(pixels / this.curRowHeight);
			} else if (ceilOrFloor === false) {
				return Math.floor(pixels / this.curRowHeight);
			}

			return Math.round(pixels / this.curRowHeight);
		};

		/**
		 * Returns the number of columns that will fit in a given amount of pixels
		 *
		 * @param {number} pixels
		 * @param {boolean} ceilOrFloor (Optional) Determines rounding method
		 * @returns {number} The number of columns
		 */
		this.pixelsToColumns = function(pixels, ceilOrFloor) {
			if (ceilOrFloor === true) {
				return Math.ceil(pixels / this.curColWidth);
			} else if (ceilOrFloor === false) {
				return Math.floor(pixels / this.curColWidth);
			}

			return Math.round(pixels / this.curColWidth);
		};

		// unified input handling
		// adopted from a msdn blogs sample
		this.unifiedInput = function(target, startEvent, moveEvent, endEvent) {
			var lastXYById = {};

			//  Opera doesn't have Object.keys so we use this wrapper
			var numberOfKeys = function(theObject) {
				if (Object.keys) {
					return Object.keys(theObject).length;
				}

				var n = 0,
					key;
				for (key in theObject) {
					++n;
				}

				return n;
			};

			//  this calculates the delta needed to convert pageX/Y to offsetX/Y because offsetX/Y don't exist in the TouchEvent object or in Firefox's MouseEvent object
			var computeDocumentToElementDelta = function(theElement) {
				var elementLeft = 0;
				var elementTop = 0;
				var oldIEUserAgent = navigator.userAgent.match(/\bMSIE\b/);

				for (var offsetElement = theElement; offsetElement != null; offsetElement = offsetElement.offsetParent) {
					//  the following is a major hack for versions of IE less than 8 to avoid an apparent problem on the IEBlog with double-counting the offsets
					//  this may not be a general solution to IE7's problem with offsetLeft/offsetParent
					if (oldIEUserAgent &&
						(!document.documentMode || document.documentMode < 8) &&
						offsetElement.currentStyle.position === 'relative' && offsetElement.offsetParent && offsetElement.offsetParent.currentStyle.position === 'relative' && offsetElement.offsetLeft === offsetElement.offsetParent.offsetLeft) {
						// add only the top
						elementTop += offsetElement.offsetTop;
					} else {
						elementLeft += offsetElement.offsetLeft;
						elementTop += offsetElement.offsetTop;
					}
				}

				return {
					x: elementLeft,
					y: elementTop
				};
			};

			//  cache the delta from the document to our event target (reinitialized each mousedown/MSPointerDown/touchstart)
			var documentToTargetDelta = computeDocumentToElementDelta(target);

			//  common event handler for the mouse/pointer/touch models and their down/start, move, up/end, and cancel events
			var doEvent = function(theEvtObj) {

				if (theEvtObj.type === 'mousemove' && numberOfKeys(lastXYById) === 0) {
					return;
				}

				var prevent = true;

				var pointerList = theEvtObj.changedTouches ? theEvtObj.changedTouches : [theEvtObj];
				for (var i = 0; i < pointerList.length; ++i) {
					var pointerObj = pointerList[i];
					var pointerId = (typeof pointerObj.identifier !== 'undefined') ? pointerObj.identifier : (typeof pointerObj.pointerId !== 'undefined') ? pointerObj.pointerId : 1;

					//  use the pageX/Y coordinates to compute target-relative coordinates when we have them (in ie < 9, we need to do a little work to put them there)
					if (typeof pointerObj.pageX === 'undefined') {
						//  initialize assuming our source element is our target
						pointerObj.pageX = pointerObj.offsetX + documentToTargetDelta.x;
						pointerObj.pageY = pointerObj.offsetY + documentToTargetDelta.y;

						if (pointerObj.srcElement.offsetParent === target && document.documentMode && document.documentMode === 8 && pointerObj.type === 'mousedown') {
							//  source element is a child piece of VML, we're in IE8, and we've not called setCapture yet - add the origin of the source element
							pointerObj.pageX += pointerObj.srcElement.offsetLeft;
							pointerObj.pageY += pointerObj.srcElement.offsetTop;
						} else if (pointerObj.srcElement !== target && !document.documentMode || document.documentMode < 8) {
							//  source element isn't the target (most likely it's a child piece of VML) and we're in a version of IE before IE8 -
							//  the offsetX/Y values are unpredictable so use the clientX/Y values and adjust by the scroll offsets of its parents
							//  to get the document-relative coordinates (the same as pageX/Y)
							var sx = -2,
								sy = -2; // adjust for old IE's 2-pixel border
							for (var scrollElement = pointerObj.srcElement; scrollElement !== null; scrollElement = scrollElement.parentNode) {
								sx += scrollElement.scrollLeft ? scrollElement.scrollLeft : 0;
								sy += scrollElement.scrollTop ? scrollElement.scrollTop : 0;
							}

							pointerObj.pageX = pointerObj.clientX + sx;
							pointerObj.pageY = pointerObj.clientY + sy;
						}
					}


					var pageX = pointerObj.pageX;
					var pageY = pointerObj.pageY;

					if (theEvtObj.type.match(/(start|down)$/i)) {
						//  clause for processing MSPointerDown, touchstart, and mousedown

						//  refresh the document-to-target delta on start in case the target has moved relative to document
						documentToTargetDelta = computeDocumentToElementDelta(target);

						//  protect against failing to get an up or end on this pointerId
						if (lastXYById[pointerId]) {
							if (endEvent) {
								endEvent({
									target: theEvtObj.target,
									which: theEvtObj.which,
									pointerId: pointerId,
									pageX: pageX,
									pageY: pageY
								});
							}

							delete lastXYById[pointerId];
						}

						if (startEvent) {
							if (prevent) {
								prevent = startEvent({
									target: theEvtObj.target,
									which: theEvtObj.which,
									pointerId: pointerId,
									pageX: pageX,
									pageY: pageY
								});
							}
						}

						//  init last page positions for this pointer
						lastXYById[pointerId] = {
							x: pageX,
							y: pageY
						};

						// IE pointer model
						if (target.msSetPointerCapture) {
							target.msSetPointerCapture(pointerId);
						} else if (theEvtObj.type === 'mousedown' && numberOfKeys(lastXYById) === 1) {
							if (useSetReleaseCapture) {
								target.setCapture(true);
							} else {
								document.addEventListener('mousemove', doEvent, false);
								document.addEventListener('mouseup', doEvent, false);
							}
						}
					} else if (theEvtObj.type.match(/move$/i)) {
						//  clause handles mousemove, MSPointerMove, and touchmove

						if (lastXYById[pointerId] && !(lastXYById[pointerId].x === pageX && lastXYById[pointerId].y === pageY)) {
							//  only extend if the pointer is down and it's not the same as the last point

							if (moveEvent && prevent) {
								prevent = moveEvent({
									target: theEvtObj.target,
									which: theEvtObj.which,
									pointerId: pointerId,
									pageX: pageX,
									pageY: pageY
								});
							}

							//  update last page positions for this pointer
							lastXYById[pointerId].x = pageX;
							lastXYById[pointerId].y = pageY;
						}
					} else if (lastXYById[pointerId] && theEvtObj.type.match(/(up|end|cancel)$/i)) {
						//  clause handles up/end/cancel

						if (endEvent && prevent) {
							prevent = endEvent({
								target: theEvtObj.target,
								which: theEvtObj.which,
								pointerId: pointerId,
								pageX: pageX,
								pageY: pageY
							});
						}

						//  delete last page positions for this pointer
						delete lastXYById[pointerId];

						//  in the Microsoft pointer model, release the capture for this pointer
						//  in the mouse model, release the capture or remove document-level event handlers if there are no down points
						//  nothing is required for the iOS touch model because capture is implied on touchstart
						if (target.msReleasePointerCapture) {
							target.msReleasePointerCapture(pointerId);
						} else if (theEvtObj.type === 'mouseup' && numberOfKeys(lastXYById) === 0) {
							if (useSetReleaseCapture) {
								target.releaseCapture();
							} else {
								document.removeEventListener('mousemove', doEvent, false);
								document.removeEventListener('mouseup', doEvent, false);
							}
						}
					}
				}

				if (prevent) {
					if (theEvtObj.preventDefault) {
						theEvtObj.preventDefault();
					}

					if (theEvtObj.preventManipulation) {
						theEvtObj.preventManipulation();
					}

					if (theEvtObj.preventMouseEvent) {
						theEvtObj.preventMouseEvent();
					}
				}
			};

			var useSetReleaseCapture = false;
			// saving the settings for contentZooming and touchaction before activation
			var contentZooming, msTouchAction;

			this.enable = function() {

				if (window.navigator.msPointerEnabled) {
					//  Microsoft pointer model
					target.addEventListener('MSPointerDown', doEvent, false);
					target.addEventListener('MSPointerMove', doEvent, false);
					target.addEventListener('MSPointerUp', doEvent, false);
					target.addEventListener('MSPointerCancel', doEvent, false);

					//  css way to prevent panning in our target area
					if (typeof target.style.msContentZooming !== 'undefined') {
						contentZooming = target.style.msContentZooming;
						target.style.msContentZooming = 'none';
					}

					//  new in Windows Consumer Preview: css way to prevent all built-in touch actions on our target
					//  without this, you cannot touch draw on the element because IE will intercept the touch events
					if (typeof target.style.msTouchAction !== 'undefined') {
						msTouchAction = target.style.msTouchAction;
						target.style.msTouchAction = 'none';
					}
				} else if (target.addEventListener) {
					//  iOS touch model
					target.addEventListener('touchstart', doEvent, false);
					target.addEventListener('touchmove', doEvent, false);
					target.addEventListener('touchend', doEvent, false);
					target.addEventListener('touchcancel', doEvent, false);

					//  mouse model
					target.addEventListener('mousedown', doEvent, false);

					//  mouse model with capture
					//  rejecting gecko because, unlike ie, firefox does not send events to target when the mouse is outside target
					if (target.setCapture && !window.navigator.userAgent.match(/\bGecko\b/)) {
						useSetReleaseCapture = true;

						target.addEventListener('mousemove', doEvent, false);
						target.addEventListener('mouseup', doEvent, false);
					}
				} else if (target.attachEvent && target.setCapture) {
					//  legacy IE mode - mouse with capture
					useSetReleaseCapture = true;
					target.attachEvent('onmousedown', function() {
						doEvent(window.event);
						window.event.returnValue = false;
						return false;
					});
					target.attachEvent('onmousemove', function() {
						doEvent(window.event);
						window.event.returnValue = false;
						return false;
					});
					target.attachEvent('onmouseup', function() {
						doEvent(window.event);
						window.event.returnValue = false;
						return false;
					});
				}
			};

			this.disable = function() {
				if (window.navigator.msPointerEnabled) {
					//  Microsoft pointer model
					target.removeEventListener('MSPointerDown', doEvent, false);
					target.removeEventListener('MSPointerMove', doEvent, false);
					target.removeEventListener('MSPointerUp', doEvent, false);
					target.removeEventListener('MSPointerCancel', doEvent, false);

					//  reset zooming to saved value
					if (contentZooming) {
						target.style.msContentZooming = contentZooming;
					}

					// reset touch action setting
					if (msTouchAction) {
						target.style.msTouchAction = msTouchAction;
					}
				} else if (target.removeEventListener) {
					//  iOS touch model
					target.removeEventListener('touchstart', doEvent, false);
					target.removeEventListener('touchmove', doEvent, false);
					target.removeEventListener('touchend', doEvent, false);
					target.removeEventListener('touchcancel', doEvent, false);

					//  mouse model
					target.removeEventListener('mousedown', doEvent, false);

					//  mouse model with capture
					//  rejecting gecko because, unlike ie, firefox does not send events to target when the mouse is outside target
					if (target.setCapture && !window.navigator.userAgent.match(/\bGecko\b/)) {
						useSetReleaseCapture = true;

						target.removeEventListener('mousemove', doEvent, false);
						target.removeEventListener('mouseup', doEvent, false);
					}
				} else if (target.detachEvent && target.setCapture) {
					//  legacy IE mode - mouse with capture
					useSetReleaseCapture = true;
					target.detachEvent('onmousedown');
					target.detachEvent('onmousemove');
					target.detachEvent('onmouseup');
				}
			};

			return this;
		};

	}
]);
