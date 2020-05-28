let pathmanage = require('path');
var fs = require('fs');
var child_process = require('child_process');
var ncp = require('ncp').ncp
var ArgumentParser = require('argparse').ArgumentParser;

var parser = new ArgumentParser({
    version: '0.0.1',
    addHelp:true,
    description: 'LiveKeys documentation generator.'
});

parser.addArgument(
    ['-m', '--disable-moxygen'],
    {
        help: 'Disable running moxygen.',
        action: 'storeTrue'
    }
)
parser.addArgument(
    ['-d', '--disable-doxygen'],
    {
        help: 'Disable running doxygen.',
        action: 'storeTrue'
    }
)
parser.addArgument(
    ['--template-file'],
    {
        help: 'Set template file. Default is in source/doc/src/template.tpl.html',
        nargs: 1
    }
)
parser.addArgument(
    ['--deploy'],
    {
        help: 'Set the deploy path. Will deploy docs and extras accordingly.',
        nargs: 1
    }
)
parser.addArgument(
    ['--output-path'],
    {
        help: 'Set the output path. Default is in source/doc/output',
        nargs: 1
    }
)
parser.addArgument(
    ['source-path'],
    {
        nargs : 1,
        help: "Path to source code."
    }
)

var args;
args = parser.parseArgs();

var src = pathmanage.resolve(args['source-path'][0])
var output = args['output_path'] ? pathmanage.resolve(args['output_path'][0]) : src + '/doc/output/html'

var options = {
    disableMoxygen : args['disable_moxygen'] ? true : false,
    disableDoxygen : args['disable_doxygen'] ? true : false
};

var deployPath = args['deploy'] ? args['deploy'][0] : ''
var deployPluginPath = process.platform === 'darwin' ? deployPath + '/PlugIns' : deployPath + '/plugins'
var deployDocsPath = process.platform === 'darwin' ? deployPath + '/Docs' : deployPath + '/docs'


var paths = {
    source : src,
    sourceDoc : src + '/doc',
    sourceDocCode : src + '/doc/src',
    sourceDocPages : src + '/doc/pages',
    templateFile : args['template_file'] ? args['template_file'][0] : src + "/doc/src/template.tpl.html",
    outputPath : src + '/doc/output',
    htmlOutputPath : deployPath ? deployDocsPath : output,
    htmlOutputIncludePath : deployPath ? deployDocsPath + '/include' : output + '/include',
    deployPath : deployPath,
    deployPluginPath : deployPluginPath,
    deployDocsPath : deployDocsPath
}

var indexPath = src + "/doc/pages";
var outpath = paths.outputPath;
var htmloutpath = paths.htmlOutputPath;
var includepath = paths.htmlOutputIncludePath;
let absoluteOutPath = pathmanage.resolve(outpath)
var srcpath = src + "/doc/src";

if (fs.lstatSync(indexPath).isDirectory()) {
    indexPath = indexPath + "/index.json";
}
if (!fs.lstatSync(src).isDirectory()) {
    throw new Error("Source path does not exist: " + src);
}

makeDirs();
copyInclude();

var templateHtmlPath = paths.templateFile
var templateHtml = fs.readFileSync(templateHtmlPath, 'utf8')

var indexTablePath = outpath + '/indexTable.html'
if (fs.existsSync(indexTablePath))
    fs.unlinkSync(indexTablePath);

var templateCssPath = srcpath + '/documentation.css'
fs.createReadStream(templateCssPath).pipe(fs.createWriteStream(includepath + '/documentation.css'));

var obj = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

function IndexTitle(name) {
    this.name = name
}

function IndexLink(name, link) {
    this.name = name
    this.link = link
}

function IndexList() {
    this.data = []
}

function makeDirs() {
    if (!fs.existsSync(outpath)) {
        fs.mkdirSync(outpath);
    }

    if (!fs.existsSync(outpath + "/md")) {
        fs.mkdirSync(outpath + "/md");
    }

    if (!fs.existsSync(htmloutpath)) {
        fs.mkdirSync(htmloutpath);
    }

    if (!fs.existsSync(includepath)) {
        fs.mkdirSync(includepath);
    }

    if (!fs.existsSync(indexPath)) {
        fs.mkdirSync(indexPath);
    }
}

function copyInclude(){
    ncp.limit = 16;

    ncp(__dirname + "/node_modules/bootstrap", includepath + "/bootstrap", function (err) {
        if (err) {
            return console.error(err);
        }
    })

    ncp(__dirname + "/node_modules/jquery", includepath + "/jquery", function (err) {
        if (err) {
            return console.error(err);
        }
    })

    ncp(__dirname + "/node_modules/perfect-scrollbar", includepath + "/perfect-scrollbar", function (err) {
        if (err) {
            return console.error(err);
        }
    })

    ncp(srcpath + "/images", htmloutpath + "/images", function (err) {
        if (err) {
            return console.error(err);
        }
    })
}


module.exports = [src,
    indexPath,
    outpath,
    absoluteOutPath,
    srcpath,
    templateHtmlPath,
    templateHtml,
    indexTablePath,
    obj,
    IndexTitle,
    IndexLink,
    IndexList,
    options,
    paths
]