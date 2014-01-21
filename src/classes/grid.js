﻿/// <reference path="../../lib/knockout-latest.debug.js" />
/// <reference path="../../lib/knockout-2.2.0.js" />
/// <reference path="footer.js" />
/// <reference path="../../lib/jquery-1.8.2.min" />
/// <reference path="../../lib/angular.js" />
/// <reference path="../constants.js"/>
/// <reference path="../namespace.js" />
/// <reference path="../navigation.js"/>
/// <reference path="../utils.js"/>
window.kg.Grid = function (options) {
    var defaults = {
            rowHeight: 30,
            columnWidth: 100,
            headerRowHeight: 30,
            footerRowHeight: 55,
            footerVisible: true,			
            displayFooter: undefined,
            canSelectRows: true,
            selectAllState: ko.observable(false),
            data: ko.observableArray([]),
            columnDefs: undefined,
            selectedItems: ko.observableArray([]), // array, if multi turned off will have only one item in array
            displaySelectionCheckbox: true, //toggles whether row selection check boxes appear
            selectWithCheckboxOnly: false,
            useExternalSorting: false,
            sortInfo: ko.observable(undefined), // similar to filterInfo
            multiSelect: true,
            tabIndex: -1,
            enableColumnResize: true,
            enableColumnDragAndDrop: true,
            enableSorting: true,
            maintainColumnRatios: undefined,
            beforeSelectionChange: function () { return true;},
            afterSelectionChange: function () { return true;},
            columnsChanged: function() { },
            rowTemplate: undefined,
            headerRowTemplate: undefined,
            footerRowTemplate: undefined,
            topSummaryRowTemplate: undefined,
            aggregateRowTemplate: undefined,
            jqueryUITheme: false,
            jqueryUIDraggable: false,
            plugins: [],
            keepLastSelected: true,
            groups: [],
            showGroupPanel: false,
            showTopSummary: false,
            showAggregateSummary: false,
            enableRowReordering: false,
            showColumnMenu: true,
            showFilter: true,
			searchColumn: undefined,
            disableTextSelection: true,
            filterOptions: {
                filterText: ko.observable(""),
                useExternalFilter: false
            },
            //Paging 
            enablePaging: false,
            pagingOptions: {
                pageSizes: ko.observableArray([250, 500, 1000]), //page Sizes
                pageSize: ko.observable(250), //Size of Paging data
                totalServerItems: ko.observable(0), //how many items are on the server (for paging)
                currentPage: ko.observable(1) //what page they are currently on
            }
        },
        self = this;
    
    self.maxCanvasHt = ko.observable(0);
    //self vars
    self.config = $.extend(defaults, options);
    self.config.columnDefs = ko.utils.unwrapObservable(options.columnDefs);
    if(self.config.columnDefs) self.config.columnDefs = self.config.columnDefs.slice(0,self.config.columnDefs.length);
    self.gridId = "ng" + window.kg.utils.newId();
    self.$root = null; //this is the root element that is passed in with the binding handler
	self.$groupPanel = null;
    self.$topPanel = null;
    self.$headerContainer = null;
    self.$topSummaryContainer = null;
    self.$headerScroller = null;
    self.$headers = null;
    self.$viewport = null;
    self.$canvas = null;
    self.rootDim = self.config.gridDim;
    self.sortInfo = ko.isObservable(self.config.sortInfo) ? self.config.sortInfo : ko.observable(self.config.sortInfo);
    self.sortedData = self.config.data;
    self.lateBindColumns = false;
    self.filteredData = ko.observableArray([]);
    self.lastSortedColumn = undefined;
    self.showFilter = self.config.showFilter;
    self.filterText = self.config.filterOptions.filterText;
    self.disableTextSelection = ko.observable(self.config.disableTextSelection);
    self.calcMaxCanvasHeight = function() {
        return (self.configGroups().length > 0) ? (self.rowFactory.parsedData.filter(function (e) {
            return e[KG_HIDDEN] === false;
        }).length * self.config.rowHeight) : (self.filteredData().length * self.config.rowHeight);
    };
    self.elementDims = {
        scrollW: 0,
        scrollH: 0,
        rowIndexCellW: 25,
        rowSelectedCellW: 25,
        rootMaxW: 0,
        rootMaxH: 0
    };
    //self funcs
    self.setRenderedRows = function (newRows) {
        self.renderedRows(newRows);
        self.refreshDomSizes();
    };
    self.minRowsToRender = function () {
        var viewportH = self.viewportDimHeight() || 1;
        return Math.floor(viewportH / self.config.rowHeight);
    };
    self.refreshDomSizes = function () {
        self.rootDim.outerWidth(self.elementDims.rootMaxW);
        self.rootDim.outerHeight(self.elementDims.rootMaxH);
        self.maxCanvasHt(self.calcMaxCanvasHeight());
    };
    self.buildColumnDefsFromData = function () {
        var sd = self.sortedData();
        if (!self.config.columnDefs) {
            self.config.columnDefs = [];
        }
        if (!sd || !sd[0]) {
            self.lateBoundColumns = true;
            return;
        }
        var item;
        item = sd[0];

        window.kg.utils.forIn(item, function (prop, propName) {
            if (propName != SELECTED_PROP) {
                self.config.columnDefs.push({
                    field: propName
                });
            }
        });
    };
    self.buildColumns = function () {
        var columnDefs = self.config.columnDefs,
            cols = [];

        if (!columnDefs) {
            self.buildColumnDefsFromData();
            columnDefs = self.config.columnDefs;
        }
        if (self.config.displaySelectionCheckbox && self.config.canSelectRows) {
            columnDefs.splice(0, 0, {
                field: '\u2714',
                width: self.elementDims.rowSelectedCellW,
                sortable: false,
                resizable: false,
                headerCellTemplate: '<input class="kgSelectionHeader" type="checkbox" data-bind="visible: $grid.multiSelect, checked: $grid.allSelected"/>',
                topSummaryCellTemplate: '<div class="kgSelectionTopSummary"></div>',
                cellTemplate: '<div class="kgSelectionCell"><input class="kgSelectionCheckbox" type="checkbox" data-bind="checked: $parent.selected" /></div>'
            });
        }
        columnDefs.sort(function (a, b) {return a.index - b.index;});
        if (columnDefs.length > 0) {
            self.configGroups([]);
            var configGroups = [];
            $.each(columnDefs, function (i, colDef) {
                var index = i;
                var column = new window.kg.Column({
                    colDef: colDef,
                    // This is likely causing our bug, we need to clean the index vield to ensure that all the indexes are valid.
                    index: index,
                    headerRowHeight: self.config.headerRowHeight,
                    sortCallback: self.sortData, 
                    resizeOnDataCallback: self.resizeOnData,
                    enableResize: self.config.enableColumnResize,
                    enableSort: self.config.enableSorting,
					isGroupable: self.config.isGroupable
                }, self);
                cols.push(column);
                var indx = self.config.groups.indexOf(colDef.field);
                if (indx != -1) {
                    indx = colDef.groupIndex ? colDef.groupIndex - 1 : indx;
                    configGroups.splice(indx, 0, column);
                    column.isGroupedBy(true);
                } else if (colDef.groupIndex) {
                    //self.config.groups.splice(colDef.groupIndex - 1, 0, colDef.field);
                    configGroups.splice(colDef.groupIndex - 1, 0, column);
                    column.isGroupedBy(true);
                }
            });
            cols.sort(function (a, b) {return a.index - b.index;});
            var gindex = [];
            $.each(cols, function (index, item) {
                var idx = item.groupIndex();
                if (idx) {
                    while(gindex[idx]) {
                        idx++;
                    }
                    item.groupIndex(idx);
                    gindex[idx] = item;
                }
            });
            configGroups.sort(function (a, b) {return a.groupIndex() - b.groupIndex();});
            var groups = [];
            $.each(configGroups, function (index, item) {
                groups.push(item.field);
            });
            self.config.groups = groups;
            self.columns(cols);
            self.configGroups(configGroups);
            self.fixGroupIndexes();
        }
    };
    self.configureColumnWidths = function() {
        var cols = self.config.columnDefs;
        var asterisksArray = [],
            percentArray = [],
            asteriskNum = 0,
            totalWidth = 0;
        var columns = self.columns();
        var nonAggColums = [];
        var numOfCols = columns.length;
    	
    	//Field is empty only for "aggregating" columns. All aggregating columns are at the front of the array
	    for (var ind = 0; ind < columns.length; ind++) {
	    	if (columns[ind].field == '') { // Checking if its an aggregating column
	    		totalWidth += columns[ind].width;
	    	}
			else {
	    		nonAggColums.push(columns[ind]);
	    	}
	    }

        var aggColOffset = self.columns().length - self.nonAggColumns().length;
        $.each(columns, function(i, column) {
            var col;
            $.each(cols, function (index, c) {
                if (c.field == column.field) {
                    col = c;
                }
            });
            col = col ? {width: col.width, index: i} : {width: column.width, index: i};        // });
        // $.each(cols, function (i, col) {
            if (column.visible === false) {
                return;
            }
            var isPercent = false, t;
            //if width is not defined, set it to a single star
            if (window.kg.utils.isNullOrUndefined(col.width)) {
                col.width = "*";
            } else { // get column width
                isPercent = isNaN(col.width) ? window.kg.utils.endsWith(col.width, "%") : false;
                t = isPercent ? col.width : parseInt(col.width, 10);
            }
            // check if it is a number
            if (isNaN(t)) {
                t = col.width;
                // figure out if the width is defined or if we need to calculate it
                if (t == 'auto') { // set it for now until we have data and subscribe when it changes so we can set the width.
                    nonAggColums[i].width = nonAggColums[i].minWidth;
                    var temp = nonAggColums[i];
                    $(document).ready(function() { self.resizeOnData(temp, true); });
                    return;
                } else if (t.indexOf("*") != -1) {
                        asteriskNum += t.length;
                        asterisksArray.push({width: col.width, index: i});
                        return;
                } else if (isPercent) { // If the width is a percentage, save it until the very last.

                    percentArray.push({width: col.width, index: i});
                    return;
                } else { // we can't parse the width so lets throw an error.
                    throw "unable to parse column width, use percentage (\"10%\",\"20%\", etc...) or \"*\" to use remaining width of grid";
                }
            } else {
            	totalWidth += nonAggColums[i].width = parseInt(col.width, 10);
            }
        });
        // check if we saved any asterisk columns for calculating later
        if (asterisksArray.length > 0) {
            self.config.maintainColumnRatios === false ? $.noop() : self.config.maintainColumnRatios = true;
            // get the remaining width
            var remainingWidth = self.rootDim.outerWidth() - totalWidth;
          
			var offset = 2; //We're going to remove 2 px so we won't overflow the viewport by default
            // calculate the weight of each asterisk rounded down
            if (self.maxCanvasHt() > self.viewportDimHeight()) {
                //compensate for scrollbar
                offset += window.kg.domUtilityService.ScrollW;
            }
			
            remainingWidth -= offset;
            if (remainingWidth < 0) remainingWidth = 0;
            // calculate the weight of each asterisk rounded down
            var asteriskVal = Math.floor(remainingWidth / asteriskNum);
            // set the width of each column based on the number of stars
            if (asteriskVal < 1) {
                asteriskVal = 1;
            }

            $.each(asterisksArray, function (i, col) {              
                var t = col.width.length;
                //var column = columns[col.index];
				var column = nonAggColums[col.index];
                column.width = asteriskVal * t;
                if (column.width < column.minWidth) {
                    column.width = column.minWidth;
                }
				//check if we are on the last column
                //if (col.index + 1 == numOfCols) {
				//	nonAggColums[col.index].width -= offset;
				//}
                totalWidth += columns[col.index].width;
            });
        }
        // Now we check if we saved any percentage columns for calculating last
        if (percentArray.length > 0) {
            // do the math
            var remainingWidth = self.rootDim.outerWidth() - totalWidth;

            $.each(percentArray, function (i, col) {
                var t = col.width;
                nonAggColums[col.index].width = Math.floor(remainingWidth * (parseInt(t.slice(0, -1), 10) / 100));
            });
        }
        self.columns(columns);
        window.kg.domUtilityService.BuildStyles(self);
    };
	self.columnByField = function (field) {
		if(field) {
			var column;
			$.each(self.columns(), function (i, c) {
				if(field == c.field) {
					 column = c;
					 return false;
				}
			});
			return column;
		}
	}
	self.init = function () {
        //factories and services
	    
        self.selectionService = new window.kg.SelectionService(self);
        self.rowFactory = new window.kg.RowFactory(self);
        self.selectionService.Initialize(self.rowFactory);
        self.buildColumns();
        self.searchProvider = new window.kg.SearchProvider(self);
        self.styleProvider = new window.kg.StyleProvider(self);
		var sortingProperties = self.sortInfo.peek();
		if(sortingProperties) {
			var col = self.columnByField(sortingProperties.column.field);
			if(col) {
				col.sortDirection(sortingProperties.direction === ASC ? DESC : ASC);
				col.sort();
			}
		}
        window.kg.sortService.columns = self.columns;
	    


        self.configGroups.subscribe(function (a) {
            if (!a) {
                return;
            }
            var tempArr = [];
            $.each(a, function (i, item) {
				if(item){
					tempArr.push(item.field || item);
				}
            });
            self.config.groups = tempArr;
            self.rowFactory.filteredDataChanged();
        });
        self.filteredData.subscribe(function () {
            if (self.$$selectionPhase) {
                return;
            } 
			self.maxCanvasHt(self.calcMaxCanvasHeight());
			if (!self.isSorting) {
			    self.configureColumnWidths();
			} 
		});
        self.maxCanvasHt(self.calcMaxCanvasHeight());
        self.searchProvider.evalFilter();
	    

        self.refreshDomSizes();
	    
    };
    self.prevScrollTop = 0;
    self.prevScrollIndex = 0;
    self.adjustScrollTop = function (scrollTop, force) {
        if (self.prevScrollTop === scrollTop && !force) { return; }
        var rowIndex = Math.floor(scrollTop / self.config.rowHeight);
        // Have we hit the threshold going down?
        if (self.prevScrollTop < scrollTop && rowIndex < self.prevScrollIndex + SCROLL_THRESHOLD) {
            return;
        }
        //Have we hit the threshold going up?
        if (self.prevScrollTop > scrollTop && rowIndex > self.prevScrollIndex - SCROLL_THRESHOLD) {
            return;
        } 
        self.prevScrollTop = scrollTop;
        self.rowFactory.UpdateViewableRange(new window.kg.Range(Math.max(0, rowIndex - EXCESS_ROWS), rowIndex + self.minRowsToRender() + EXCESS_ROWS));
        self.prevScrollIndex = rowIndex;
    };
    self.adjustScrollLeft = function (scrollLeft) {
        if (self.$headerContainer) {
            self.$headerContainer.scrollLeft(scrollLeft);
        }
        if(self.$topSummaryContainer) {
            self.$topSummaryContainer.scrollLeft(scrollLeft);
        }
    };
    self.resizeOnData = function (col) {
        // we calculate the longest data.
        var longest = col.minWidth;
        var arr = window.kg.utils.getElementsByClassName('col' + col.index);
        $.each(arr, function (index, elem) {
            var i;
            if (index === 0) {
                var kgHeaderText = $(elem).find('.kgHeaderText');
                i = window.kg.utils.visualLength(kgHeaderText) + 10;// +10 some margin
            }
            else if (index == 1 && self.config.showTopSummary) {
            	var tsCellText = $(elem).find('.kgTopSummaryText');
            	i = window.kg.utils.visualLength(tsCellText) + 10; // +10 some margin
            }
            else {
                var ngCellText = $(elem).find('.kgCellText');
                i = window.kg.utils.visualLength(ngCellText) + 10; // +10 some margin
            }
            if (i > longest) {
                longest = i;
            }
        });
        col.width = longest = Math.min(col.maxWidth, longest + 7); // + 7 px to make it look decent.
        window.kg.domUtilityService.BuildStyles(self);
    };
    self.sortData = function (col, direction) {
        // if external sorting is being used, do nothing.
        self.isSorting = true;
        self.sortInfo({
            column: col,
            direction: direction
        });
        self.clearSortingData(col);
        if(!self.config.useExternalSorting){
            window.kg.sortService.Sort(self.sortInfo.peek(), self.sortedData);
        } else {
            self.config.sortInfo(self.sortInfo.peek());
        }
        self.lastSortedColumn = col;
        self.isSorting = false;
    };
    self.clearSortingData = function (col) {
        if (!col) {
            $.each(self.columns(), function (i, c) {
                c.sortDirection("");
            });
        } else if (self.lastSortedColumn && col != self.lastSortedColumn) {
            self.lastSortedColumn.sortDirection("");
        }
    };
    self.fixColumnIndexes = function () {
        self.$$indexPhase = true;
        //fix column indexes
        var cols = self.columns.peek();
        $.each(cols, function (i, col) {
            col.index = i;
        });
        self.$$indexPhase = false;
    };
    //self vars
    self.elementsNeedMeasuring = true;
    self.columns = ko.observableArray([]);
    self.columns.subscribe(function(newCols) {
        self.config.columnsChanged(newCols);
    });
    self.renderedRows = ko.observableArray([]);
    self.headerRow = null;
    self.rowHeight = self.config.rowHeight;
	self.jqueryUITheme = ko.observable(self.config.jqueryUITheme);
    self.footer = null;
    self.selectedItems = self.config.selectedItems;
    self.multiSelect = self.config.multiSelect;
    self.footerVisible = window.kg.utils.isNullOrUndefined(self.config.displayFooter) ? self.config.footerVisible : self.config.displayFooter;
    self.config.footerRowHeight = self.footerVisible ? self.config.footerRowHeight : 0;
	self.showColumnMenu = self.config.showColumnMenu;
    self.showMenu = ko.observable(false);
    self.configGroups = ko.observableArray([]);

    //Paging
    self.enablePaging = self.config.enablePaging;
    self.pagingOptions = self.config.pagingOptions;
    //Templates
    self.rowTemplate = self.config.rowTemplate || window.kg.defaultRowTemplate();
    self.headerRowTemplate = self.config.headerRowTemplate || window.kg.defaultHeaderRowTemplate();
    self.footerRowTemplate = self.config.footerRowTemplate || window.kg.defaultFooterRowTemplate();
    self.topSummaryRowTemplate = self.config.topSummaryRowTemplate || window.kg.defaultTopSummaryRowTemplate();
    self.aggregateRowTemplate = self.config.aggregateRowTemplate || (self.config.showAggregateSummary ? window.kg.aggregateSummaryTemplate() : window.kg.aggregateTemplate());
	
    if (self.config.rowTemplate && !TEMPLATE_REGEXP.test(self.config.rowTemplate)) {
        self.rowTemplate = window.kg.utils.getTemplatePromise(self.config.rowTemplate);
    }
    if (self.config.headerRowTemplate && !TEMPLATE_REGEXP.test(self.config.headerRowTemplate)) {
        self.headerRowTemplate = window.kg.utils.getTemplatePromise(self.config.headerRowTemplate);
    }
	if (self.config.footerRowTemplate && !TEMPLATE_REGEXP.test(self.config.footerRowTemplate)) {
        self.footerRowTemplate = window.kg.utils.getTemplatePromise(self.config.footerRowTemplate);
    }
    if (self.config.topSummaryRowTemplate && !TEMPLATE_REGEXP.test(self.config.topSummaryRowTemplate)) {
    	self.topSummaryRowTemplate = window.kg.utils.getTemplatePromise(self.config.topSummaryRowTemplate);
    }
    if (self.config.aggregateRowTemplate && !TEMPLATE_REGEXP.test(self.config.aggregateRowTemplate)) {
    	self.aggregateRowTemplate = window.kg.utils.getTemplatePromise(self.config.aggregateRowTemplate);
    }
    //scope funcs
    self.visibleColumns = ko.computed(function () {
        var cols = self.columns();
        return cols.filter(function (col) {
            var isVis = col.visible();
            return isVis;
        });
    });
	self.groupableByCol = ko.computed(function () {
		return self.columns().filter(function (col) {
			return col.isGroupable;
		});
	});
    self.nonAggColumns = ko.computed(function () {
        return self.columns().filter(function (col) {
            return !col.isAggCol;
        });
    });
	self.aggColumns = ko.computed(function () {
        return self.columns().filter(function (col) {
            return col.isAggCol;
        });
    });
    self.nonAggAndCheckboxVisibleColumns = ko.computed(function () {
    	var cols = self.nonAggColumns();
    	return cols.filter(function (col) {
    		var isVis = col.visible();
    		return isVis && col.field != '\u2714';
    	});
    });
    self.aggregateRowColumns = ko.computed(function () {
    	return self.nonAggAndCheckboxVisibleColumns().slice(1);
    });
    self.anyAggregateRowColumn = ko.computed(function () {
    	return self.nonAggAndCheckboxVisibleColumns().length > 0;
    });
    // For aggreagate row with summary
    self.firstRealColumnIndex = ko.computed(function () {
    	return self.visibleColumns().length - self.nonAggAndCheckboxVisibleColumns().length;
    });
    self.toggleShowMenu = function () {
        self.showMenu(!self.showMenu());
    };
    self.allSelected = self.config.selectAllState;
    self.allSelected.subscribe(function (state) {
        if (self.config.beforeSelectionChange(self.sortedData.peek(), this)) {
            self.selectionService.toggleSelectAll(state);
            self.config.afterSelectionChange(self.selectedItems.peek(), this);
        }
    });
    self.totalFilteredItemsLength = ko.computed(function () {
        return self.filteredData().length;
    });
	self.showGroupPanel = ko.computed(function(){
		return self.config.showGroupPanel;
	});
	self.showTopSummary = ko.computed(function () {
		return self.config.showTopSummary;
	});
	self.showAggregateSummary = ko.computed(function () {
		return self.config.showAggregateSummary;
	});

	self.topPanelHeight = ko.observable( self.config.showGroupPanel && self.config.showTopSummary ? (self.config.headerRowHeight * 3)
										: self.config.showGroupPanel || self.config.showTopSummary ? (self.config.headerRowHeight * 2) : self.config.headerRowHeight);
	self.viewportDimHeight = ko.computed(function () {
        return Math.max(0, self.rootDim.outerHeight() - self.topPanelHeight() - self.config.footerRowHeight - 2);
    });
	self.groupBy = function (col) {
	    //Taranyan on 2013/09/15: 
	    //For initial column grouping. Commented out because this was breaking grouping
	    //in case when we have initial grouping and the grid is initially empty or its data is
	    //being loaded asynchronously
		
	    //if (self.sortedData().length < 1) {
	    //    return;
	    //}
        var indx = self.configGroups().indexOf(col);
        if (indx == -1) {
			col.isGroupedBy(true);
            self.configGroups.push(col);
			col.groupIndex(self.configGroups().length);
        } else {
			self.removeGroup(indx);
        }
        window.kg.domUtilityService.BuildStyles(self);
    };
    self.removeGroup = function(index) {
		var col = self.columns().filter(function(item){ 
			return item.groupIndex() == (index + 1);
		})[0];
		col.isGroupedBy(false);
		col.groupIndex(0);
        if (self.columns()[index].isAggCol) {
            self.columns.splice(index, 1);
        } 
        self.configGroups.splice(index, 1);
		self.fixGroupIndexes();
        if (self.configGroups().length === 0) {
            self.fixColumnIndexes();
        }
        window.kg.domUtilityService.BuildStyles(self);
    };
	self.fixGroupIndexes = function(){		
		$.each(self.configGroups(), function(i,item){
			item.groupIndex(i + 1);
		});
	};
    self.totalRowWidth = function () {
        var totalWidth = 0,
            cols = self.visibleColumns();
        $.each(cols, function (i, col) {
            totalWidth += col.width;
        });
        return totalWidth;
    };
    self.headerScrollerDim = function () {
        var viewportH = self.viewportDimHeight(),
            maxHeight = self.maxCanvasHt(),
            vScrollBarIsOpen = (maxHeight > viewportH),
            newDim = new window.kg.Dimension();

        newDim.autoFitHeight = true;
        newDim.outerWidth = self.totalRowWidth();
        if (vScrollBarIsOpen) { newDim.outerWidth += self.elementDims.scrollW; }
        else if ((maxHeight - viewportH) <= self.elementDims.scrollH) { //if the horizontal scroll is open it forces the viewport to be smaller
            newDim.outerWidth += self.elementDims.scrollW;
        }
        return newDim;
    };
    //footer
    self.jqueryUITheme = self.config.jqueryUITheme;
    self.maxRows = ko.observable(Math.max(self.config.pagingOptions.totalServerItems() || self.sortedData().length, 1));
    self.maxRowsDisplay = ko.computed(function () {
        return self.maxRows();
    });
    self.multiSelect = ko.observable((self.config.canSelectRows && self.config.multiSelect));
    self.selectedItemCount = ko.computed(function () {
        return self.selectedItems().length;
    });
    self.maxPages = ko.computed(function () {
        self.maxRows(Math.max(self.config.pagingOptions.totalServerItems() || self.sortedData().length, 1));
        return Math.ceil(self.maxRows() / self.pagingOptions.pageSize());
    });
    self.pageForward = function () {
        var page = self.config.pagingOptions.currentPage();
        self.config.pagingOptions.currentPage(Math.min(page + 1, self.maxPages()));
    };
    self.pageBackward = function () {
        var page = self.config.pagingOptions.currentPage();
        self.config.pagingOptions.currentPage(Math.max(page - 1, 1));
    };
    self.pageToFirst = function () {
        self.config.pagingOptions.currentPage(1);
    };
    self.pageToLast = function () {
        var maxPages = self.maxPages();
        self.config.pagingOptions.currentPage(maxPages);
    };
    self.cantPageForward = ko.computed(function () {
        var curPage = self.config.pagingOptions.currentPage();
        var maxPages = self.maxPages();
        return !(curPage < maxPages);
    });
    self.cantPageBackward = ko.computed(function () {
        var curPage = self.config.pagingOptions.currentPage();
        return !(curPage > 1);
    });
    //call init
    self.init();
};
