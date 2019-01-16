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
if ( !fs.lstatSync(src).isDirectory() ){
    throw new Error("Source path does not exist: " + src)
}
if ( !fs.existsSync(outpath) ){
    fs.mkdirSync(outpath)
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

    var renderer = new marked.Renderer();

    function iterateProperty(renderer, type, value, level){
        if ( type === 'plugin' ){
            renderer.currentPlugin = value
            renderer.indexCollector[value] = []
            return ''
        } else if ( type === 'qmlType' ){
            renderer.currentType = {
                name : value,
                path : renderer.currentPlugin + '.' + value,
                brief : '',
                inherits : '',
                properties : [],
                methods : [],
                signals :[],
                enums : []
            }
            renderer.indexCollector[renderer.currentPlugin].push(renderer.currentType)
            return `<h1><code>${value}</code> type</h1>\n<!-----classsummary:${renderer.currentPlugin}:${value}----->\n`
        } else if ( type === 'qmlInherits' ){
            renderer.currentType.inherits = value
            return ''
        } else if ( type === 'qmlBrief' ){
            renderer.currentType.brief = value
            return `<p>${value}</p>\n`
        } else if ( type === 'qmlEnum' ){
            renderer.currentType.enums.push(value)
            return `<h4><code>${value}</code> enum</h2>\n`
        } else if ( type === 'qmlProperty' ){
            renderer.currentType.properties.push(value)
            return `<h4><code>${value}</code> property</h2>\n`
        } else if ( type === 'qmlMethod' ){
            renderer.currentType.methods.push(value)
            return `<h4><code>${value}</code> method</h2>\n`
        } else if ( type === 'qmlSignal' ){
            renderer.currentType.signals.push(value)
            return `<h4><code>${value}</code> signal</h2>\n`
        } else if ( type === 'qmlSummary' ){
            return `<h2>Summary</h2>\n<!-----pluginsummary:${value}----->\n` 
        }

        return ''
    }

    renderer.currentPlugin = ''
    renderer.currentType = ''
    renderer.indexCollector = {}

    // Override function
    renderer.paragraph = function (text, level) {
        var trimmedText = text.trim()
        if ( trimmedText.startsWith('{') && trimmedText.endsWith('}') ){
            var result = '';
            var segments = trimmedText.split('}')
            var validSegments = 0
            for ( var i = 0; i < segments.length; ++i ){
                var segment = segments[i].trim()
                if ( segment.startsWith('{') ){
                    var [propertyType, propertyValue] = segment.substring(1).split(':')
                    result += iterateProperty(renderer, propertyType.trim(), propertyValue.trim(), level)
                    validSegments++;
                }
            }

            if ( validSegments > 0 )
                return result;
        }
        return '<p>' + text + '</p>\n';
    };

    var tokens = marked.lexer(fileMdContent);

    // create html content
    result.content = marked(marked.parser(tokens, { renderer: renderer}))

    // replace plugin summary with actual content
    result.content = result.content.replace(/<\!\-{5}pluginsummary\:([a-zA-Z\.]*)\-{5}>/g, function(match, contents, offset, input_string){
        var result = '<table>'

        var plugin = renderer.indexCollector[contents]
        for ( var i = 0; i < plugin.length; ++i ){
            var cls = plugin[i]
            result += `<tr><td>Type <code>${cls.name}</code></td><td>${cls.brief}</td></tr>`
        }
        return result + '</table>';
    })

    // replace class summary with actual content
    result.content = result.content.replace(/<\!\-{5}classsummary\:([a-zA-Z\.]*\:[[a-zA-Z]*)\-{5}>/g, function(match, contents, offset, input_string){
        var result = ''
        var [pluginPath, requiredType] = contents.split(':')

        var plugin = renderer.indexCollector[pluginPath]
        for ( var i = 0; i < plugin.length; ++i ){
            var cls = plugin[i]
            if ( cls.path === pluginPath + '.' + requiredType ){
                if ( cls.inherits.length > 0 ){
                    result += `<table><tr><td>Inherits</td><td><code>${cls.inherits}</code></td></tr></table>\n`
                }
                if ( cls.enums.length > 0 ){
                    result += '<table>'
                    for ( var j = 0; j < cls.enums.length; ++j ){
                        result += '<tr><td>Enum</td><td><code>' + cls.enums[j] + '</code></td></tr>'
                    }
                    result += '</table>\n'
                }
                if ( cls.properties.length > 0 ){
                    result += '<table>'
                    for ( var j = 0; j < cls.properties.length; ++j ){
                        result += '<tr><td>Property</td><td><code>' + cls.properties[j] + '</code></td></tr>'
                    }
                    result += '</table>\n'
                }
                if ( cls.methods.length > 0 ){
                    result += '<table>'
                    for ( var j = 0; j < cls.methods.length; ++j ){
                        result += '<tr><td>Method</td><td><code>' + cls.methods[j] + '</code></td></tr>'
                    }
                    result += '</table>\n'
                }
                if ( cls.signals.length > 0 ){
                    result += '<table>'
                    for ( var j = 0; j < cls.signals.length; ++j ){
                        result += '<tr><td>Signal</td><td><code>' + cls.signals[j] + '</code></td></tr>'
                    }
                    result += '</table>\n'
                }
            }
        }
        return result;
    });

    return result
}

var structure = resolveList(obj)

console.log("\nDone")


