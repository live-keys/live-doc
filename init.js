let pathmanage = require('path');
var fs = require('fs');
var child_process = require('child_process');


var args = process.argv.slice(2);

if (args.length !== 1) {
    throw new Error("Invalid arugment count. Usage: live-doc <path_to_livecv_src>")
}

var src = pathmanage.resolve(args[0]);
var indexPath = src + "/doc/pages";
var outpath = src + "/doc/output";
var includepath = outpath + "/html/include";
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

var templateHtmlPath = srcpath + '/template.tpl.html'
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
    IndexList
]

function makeDirs() {
    if (!fs.existsSync(outpath)) {
        fs.mkdirSync(outpath);
    }

    if (!fs.existsSync(outpath + "/md")) {
        fs.mkdirSync(outpath + "/md");
    }

    if (!fs.existsSync(outpath + "/html")) {
        fs.mkdirSync(outpath + "/html");
    }

    if (!fs.existsSync(includepath)) {
        fs.mkdirSync(includepath);
    }

    if (!fs.existsSync(indexPath)) {
        fs.mkdirSync(indexPath);
    }
}

function copyInclude() {
    let bootstrapCopyCmd = "cp -r " + __dirname + "/node_modules/bootstrap " + includepath + "/bootstrap";
    let jqueryCopyCmd = "cp -r " + __dirname + "/node_modules/jquery " + includepath + "/jquery";

    child_process.execSync(bootstrapCopyCmd);
    child_process.execSync(jqueryCopyCmd);
}