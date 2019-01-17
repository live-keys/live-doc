var moxygen = require('moxygen');
let pathmanage = require('path')
var assign = require('object-assign');

var args = process.argv.slice(2);
if (args.length !== 1) {
    throw new Error("Invalid arugment count. Usage: live-doc-moxygen <outputpath>")
}

// Encoding space as %20 (browser like) for moxygen not to look at it as more than 1 arg
var outpath = pathmanage.resolve(args[0]).replace("%20", " ");

moxygen.run(assign({}, moxygen.defaultOptions, {
    directory: outpath + '/xml',
    output: outpath + '/md/%s-cpp.md',
    groups: true,
    pages: 'false',
    classes: false,
    noindex: false,
    anchors: false,
    htmlAnchors: false,
    language: 'cpp',
    templates: 'templates'
}));