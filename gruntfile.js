module.exports = function(grunt) {

	function processFiles (src, path) {
		var leader = "\n\/***********************************************"
			+ "\n* FILE: " + path
			+ "\n***********************************************\/\n",
			htmlRgx = /\.html?$/i,
			fileRgx = /^<!--(.*?)-->/,
			matches;

		if (htmlRgx.test(path)) {
			matches = fileRgx.exec(src);

			if (matches && matches[1]) {
				leader += matches[1] + " = function(){ return '";

				// remove comment line
				src = src.replace(/^<!--.*-->$/gm, "");

				// escape characters, remove extra whitespace
				src = src.replace(/'/g, "\\'").replace(/^\s*(.*)\s*$/gm, "$1") + "';};";
			}
		}

		// remove references
		src = src.replace(/\/\/\/.*\s*/g, "");
		
		return leader + src;
	}

	var banner = "\/***********************************************"
		+ "\n* koGrid JavaScript Library"
		+ "\n* Authors: https://github.com/ericmbarnard/koGrid/blob/master/README.md"
		+ "\n* License: MIT (http://www.opensource.org/licenses/mit-license.php)"
		+ "\n* Compiled At: <%= grunt.template.today('yyyy-mm-dd HH:MM:ss') %>"
		+ "\n***********************************************\/\n";

	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		meta: {
			banner: banner,
			prefix: "\n(function(window){\n'use strict';\n",
			postfix: "\n})(window);"
		},
		clean: ["dist"],
		concat: {
			options: {
				banner: "<%= meta.banner %> <%= meta.prefix %>",
				footer: "<%= meta.postfix %>",
				process: processFiles
			},
			dist: {
				src: [
					"src/namespace.js",
					"src/constants.js",
					"src/navigation.js",
					"src/utils.js",
					"src/templates/gridTemplate.html",
					"src/templates/rowTemplate.html",
					"src/templates/cellTemplate.html",
					"src/templates/aggregateTemplate.html",
					"src/templates/headerRowTemplate.html",
					"src/templates/footerRowTemplate.html",
					"src/templates/headerCellTemplate.html",
					"src/bindingHandlers/ko-grid.js",
					"src/bindingHandlers/kg-row.js",
					"src/bindingHandlers/kg-cell.js",
					"src/bindingHandlers/kg-header-row.js",
					"src/bindingHandlers/kg-footer-row.js",
					"src/bindingHandlers/kg-header-cell.js",
					"src/bindingHandlers/kg-mouse-events.js",
					"src/classes/aggregate.js",
					"src/classes/column.js",
					"src/classes/dimension.js",
					"src/classes/eventProvider.js",
					"src/classes/rowFactory.js",
					"src/classes/grid.js",
					"src/classes/range.js",
					"src/classes/row.js",
					"src/classes/searchProvider.js",
					"src/classes/selectionService.js",
					"src/classes/styleProvider.js",
					"src/classes/sortService.js",
					"src/classes/domUtilityService.js"
				],
				dest: "dist/<%= pkg.name %>-<%= pkg.version %>.debug.js"
			}
		},
		// tests are busted - must be written for v1
		qunit: {
			all: ["tests/*.htm"]
		},
		uglify: {
			options: {
				banner: "<%= meta.banner %>"
			},
			build: {
				src: "<%= concat.dist.dest %>",
				dest: "dist/<%= pkg.name %>-<%= pkg.version %>.js"
			}
		},
		jshint: {
			all: ["gruntfile.js","src/**/*.js"],
			options: {
				eqnull: true,
				curly: true,
				forin: true,
				newcap: true,
				noempty: false,
				plusplus: false,
				quotmark: false,
				nonew: false,
				unused: true
			},
			ignore_warning: {
				options: {
					'-W014': true,
				},
				src: ["gruntfile.js", '**/*.js'],
			},
		}
	});

	grunt.loadNpmTasks("grunt-contrib-jshint");
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks("grunt-contrib-uglify");
	grunt.loadNpmTasks("grunt-contrib-concat");

	grunt.registerTask("default", ["clean","concat","uglify","jshint"]);
};