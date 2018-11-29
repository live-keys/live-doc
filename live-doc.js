let marked        = require('marked')
let pathmanage    = require('path')
var fs            = require('fs');
var child_process = require('child_process');

var args = process.argv.slice(2);

if ( args.length !== 1 ){
    throw new Error("Invalid arugment count. Usage: live-doc <path_to_livecv_src>")
}

var src       = pathmanage.resolve(args[0])
var indexPath = src + '/doc/pages';
var outpath   = src + '/doc/output';
var srcpath   = src + '/doc/src';

if ( fs.lstatSync(indexPath).isDirectory() ){
    indexPath = indexPath + '/index.json'
}
if ( !fs.lstatSync(outpath).isDirectory() ){
    throw new Error("Output path does not exist: " + outpath)
}
if ( !fs.existsSync(outpath + '/md') ){
    fs.mkdirSync(outpath + '/md')
}


console.log("\nExecuting Doxygen in " + srcpath)
console.log("-----------------------------------------------------------\n")

child_process.execSync('doxygen Doxyfile', {cwd: srcpath, stdio:[0,1,2]});

console.log("\nDoxygen done")


console.log("\nExecuting moxygen in " + outpath)
console.log("-----------------------------------------------------------\n")

child_process.execSync('node live-doc-moxygen.js ' + outpath, {stdio:[0,1,2]});

console.log("\nMoxygen done")

console.log("\nStarting live-doc")
console.log("-----------------------------------------------------------\n")

var templateHtmlPath = src + '/doc/src/template.tpl.html'
var templateHtml = fs.readFileSync(templateHtmlPath, 'utf8')

var templateCssPath = src + '/doc/src/documentation.css'
fs.createReadStream(templateCssPath).pipe(fs.createWriteStream(src + '/doc/output/documentation.css'));


var obj = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

function IndexTitle(name){
    this.name = name
}

function IndexLink(name, link){
    this.name = name
    this.link = link
}

function IndexList(){
    this.data = []
}

function resolveList(list){
    var result = new IndexList();
    for ( var i = 0; i < list.length; ++i ){
        var node = list[i];

        if ( node.constructor === Array ){
            result.data.push(resolveList(node))
        } else if ( typeof node === 'object' && node !== null ){
            var key = Object.keys(node)[0]

            var resolvedMd = resolveMarkDown(node[key])

            result.data.push(new IndexLink( key,  resolvedMd.resolvedLink))

            var replacements = {'%title%' : key, '%content%' : resolvedMd.content}
            var contentHtml = templateHtml.replace(/%\w+%/g, function(all) {
                return replacements[all] || all;
            });

            fs.writeFileSync(resolvedMd.resolvedLink, contentHtml)

        } else if (typeof node === 'string' || node instanceof String){
            result.data.push(new IndexTitle( node ))
        } else {
            throw new Error('Incompatible node type: ' + node)
        }
    }
    return result;
}

function resolveMarkDown(mdpath){
    var result = {'content' : '', 'titles': [], 'resolvedLink' : []}

    var parentDir = pathmanage.resolve(pathmanage.dirname(indexPath))
    var absoluteOutPath = pathmanage.resolve(outpath)

    var mdabsolutepath   = parentDir + '/' + mdpath
    var htmlabsolutepath = absoluteOutPath + '/' + pathmanage.parse(mdpath).name + '.html'

    console.log("Parse: " + mdabsolutepath)
    console.log("   To -->: " + htmlabsolutepath)

    result.resolvedLink = htmlabsolutepath

    var slpos = mdabsolutepath.lastIndexOf('#')
    if ( slpos !== -1 ){
        mdabsolutepath = mdabsolutepath.substring(0,slpos)
    }

    if ( !fs.existsSync(mdabsolutepath) )
        throw new Error("File does not exist: " + mdabsolutepath)

    var fileMdContent = fs.readFileSync(mdabsolutepath, 'utf8')

    result.content = marked(fileMdContent)

    return result
}

var structure = resolveList(obj)

console.log("\nDone")


