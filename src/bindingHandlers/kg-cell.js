/// <reference path="../../lib/knockout-2.2.0.js" />
ko.bindingHandlers.kgCell = (function () {
	return {
		'init': function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
			var cell = valueAccessor();
			var compile = function (html) {
				var cellElem = $(html);
				cell.$userViewModel = bindingContext.$parent.$userViewModel;
				ko.applyBindings(bindingContext, cellElem[0]);
				$(element).html(cellElem);
			};
			if (viewModel.cellTemplate.then) {
				viewModel.cellTemplate.then(function(p) {
					compile(p);
				});
			} else {
				compile(viewModel.cellTemplate);
			}
			return { controlsDescendantBindings: true };
		}
	};
}());