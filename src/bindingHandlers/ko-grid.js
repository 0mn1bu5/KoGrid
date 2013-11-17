﻿ko.bindingHandlers['koGrid'] = (function () {
    return {
        'init': function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var options = valueAccessor();
            var elem = $(element);
            options.gridDim = new window.kg.Dimension({ outerHeight: ko.observable(elem.height()), outerWidth: ko.observable(elem.width()) });

            //Taranyan on 2013/09/09: Initial column grouping fixed
            var groups = options.groups;
            options.groups = [];
            //#

            var grid = new window.kg.Grid(options);
            var gridElem = $(window.kg.defaultGridTemplate());
            // if it is a string we can watch for data changes. otherwise you won't be able to update the grid data
            options.data.subscribe(function () {
                if (grid.$$selectionPhase) {
                    return;
                }
                grid.searchProvider.evalFilter();
                grid.refreshDomSizes();
            });
            //options.selectedItems.subscribe(function(opt1, opt2) {
                //use ko.utils.arrayPushAll(array, items) to add elements
                //use removeAll to delete
                //use ko.utils.compareArrays(previousValue, latestValue); to identify added/deleted items an mark all in one time
                //but may be it is overengineering
            //});
            
            //VERESOV on 2013/07/12: fix bug with uninitialized selectedItems field
            if (options.selectedItems != undefined) {
                options.selectedItems.subscribeArrayChanged(
                    function (dataAdded) {
                        if (grid.$$selectionPhase) {
                            return;
                        }

                        $.each(grid.rowFactory.rowCache, function (key, row) {
                            if (row.entity == dataAdded) {
                                grid.selectionService.setSelection(row, true);
                                return;
                            }
                        });
                    },
                    function (dataDeleted) {
                        if (grid.$$selectionPhase) {
                            return;
                        }

                        $.each(grid.rowFactory.rowCache, function (key, row) {
                            if (row.entity == dataDeleted) {
                                grid.selectionService.setSelection(row, false);
                                return;
                            }
                        });
                    }
                );
            }
            
            // if columndefs are observable watch for changes and rebuild columns.
            if (ko.isObservable(options.columnDefs)) {
                options.columnDefs.subscribe(function (newDefs) {
                    grid.columns([]);
                    grid.config.columnDefs = newDefs;
                    grid.buildColumns();
                    grid.configureColumnWidths();
                });
            }
            //set the right styling on the container
            elem.addClass("koGrid").addClass(grid.gridId.toString());
            elem.append(gridElem);
            grid.$userViewModel = bindingContext.$data;
            ko.applyBindings(grid, gridElem[0]);
            //walk the element's graph and the correct properties on the grid
            window.kg.domUtilityService.AssignGridContainers(elem, grid);
            grid.configureColumnWidths();
            grid.refreshDomSizes();
            //now use the manager to assign the event handlers
            grid.eventProvider = new window.kg.EventProvider(grid);
            //initialize plugins.
            $.each(grid.config.plugins, function (i, p) {
                if (typeof p.onGridInit === 'function') {
                    p.onGridInit(grid);
                }
            });
            window.kg.domUtilityService.BuildStyles(grid);
	        
            //Taranyan on 2013/09/09: Initial column grouping fixed
            if (groups) {
                $.each(groups, function(i, item) {
                    $.each(grid.columns(), function(j, column) {
                        if (column.field == item) {
                            grid.groupBy(column);
                        }
                    });
                });
            }

            return { controlsDescendantBindings: true };
        }
    };
}());