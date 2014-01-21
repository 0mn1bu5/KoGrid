ko.bindingHandlers['kgTopSummaryCell'] = (function () {
	return {
		'init': function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
			var newContext = bindingContext.extend({ $grid: bindingContext.$parent, $userViewModel: bindingContext.$parent.$userViewModel });
			var compile = function (html) {
				var headerCell = $(html);
				ko.applyBindings(newContext, headerCell[0]);
				$(element).html(headerCell);
			};
			if (viewModel.topSummaryCellTemplate.then) {
				viewModel.topSummaryCellTemplate.then(function (p) {
					compile(p);
				});
			} else {
				compile(viewModel.topSummaryCellTemplate);
			}
			return { controlsDescendantBindings: true };
		}
	};
}());