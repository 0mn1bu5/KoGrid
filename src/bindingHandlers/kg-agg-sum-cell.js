/// <reference path="../../lib/knockout-2.2.0.js" />
ko.bindingHandlers.kgAggSumCell = (function () {
	return {
		'init': function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
			bindingContext.$userViewModel = bindingContext.$parent.$userViewModel;
			var compile = function (html) {
				var cell = $(html);
				ko.applyBindings(bindingContext, cell[0]);
				$(element).html(cell);
			};
			if (viewModel.aggregateSummaryCellTemplate.then) {
				viewModel.aggregateSummaryCellTemplate.then(function (p) {
					compile(p);
				});
			} else {
				compile(viewModel.aggregateSummaryCellTemplate);
			}
			return { controlsDescendantBindings: true };
		}
	};
}());