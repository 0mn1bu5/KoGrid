ko.bindingHandlers['kgTopSummaryRow'] = (function () {
	return {
		'init': function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
			bindingContext.$userViewModel = bindingContext.$data.$userViewModel;
			var compile = function (html) {
				var headerRow = $(html);
				ko.applyBindings(bindingContext, headerRow[0]);
				$(element).html(headerRow);
			};
			if (viewModel.topSummaryRowTemplate.then) {
				viewModel.topSummaryRowTemplate.then(function (p) {
					compile(p);
				});
			} else {
				compile(viewModel.topSummaryRowTemplate);
			}
			return { controlsDescendantBindings: true };
		}
	};
}());