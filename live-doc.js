let marked = require('marked')
let pathmanage = require('path')
let docparser = require('./docparser')
var fs = require('fs');
var ncp = require('ncp').ncp;


[isArray, isObject, cleanUrl, generateFileName, generateAbsolutePath] = require("./utils.js");

[
    src,
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
] = require("./init.js")

if ( !options.disableDoxygen )
    require("./run_doxygen.js");

if ( !options.disableMoxygen )
    require("./run_moxygen.js");

var mdpath;

class IndexTableNode{

    constructor(){
      this.link = '';
      this.text = '';
      this.expandsTo = '';
      this.nested = false;
      this.children = []
    }

    toStringIndent(indent){
        if ( !indent )
            indent = ''

        var s = ''
        if ( this.link !== '' ){
            s = indent + 'LINK[' + this.link + ']:' + this.text + '\n';
        } else {
            s = indent + 'TEXT:' + this.text + '\n';
        }

        if ( this.nested ){
            s += indent + '{\n'
            for ( var i = 0; i < this.children.length; ++i ){
                s += this.children[i].toStringIndent(indent + '  ')
            }
            s += indent + '}\n'
        }
        return s;
    }

    toString(){
        return this.toStringIndent('')
    }

    toHtmlIndent(indent){
        if ( !indent )
            indent = ''

        var s = ''

        if ( this.text !== '' ){
            s += indent + '<li>\n'
            if ( this.link !== '' ){
                s += indent + '  ' + (this.expandsTo !== '' ? '<a href="#" class="expand-link">+</a>' : '') + '<a class="index-link" href=\'' + this.link + '\'>' + this.text + '</a>\n';
            } else {
                s += indent + '  <span class="index-title">' + this.text + '</span>\n';
            }
            if ( this.expandsTo !== '' ){
                s +=  indent + '  <a href=\'' + this.expandsTo + '\'>' + this.expandsTo + '</a>\n'
            }
        }

        if ( this.nested ){
            s += indent + '  <ul>\n'
            for ( var i = 0; i < this.children.length; ++i ){
                s += this.children[i].toHtmlIndent(indent + '    ')
            }
            s += indent + '  </ul>\n'
        }

        if ( this.text !== '' ){
            s += indent + '</li>\n'
        }
        
        return s;
    }

    toHtml(){
        return this.toHtmlIndent('')
    }
}

resolveList(obj);
addIndexList(obj)
docparser.exportExternals(outpath + '/externals.json')

console.log("\nDone")



function resolveList(list) {
    var result = new IndexList();
    for (var i = 0; i < list.length; ++i) {
        var node = list[i];

        if (node.constructor === Array) {
            result.data.push(resolveList(node))
        } else if (typeof node === 'object' && node !== null) {
            var key = Object.keys(node)[0]

            if ( key !== '__extra' ){
                mdpath = node[key];
                var resolvedMd = resolveMarkDown()
                result.data.push(new IndexLink(key, resolvedMd.resolvedLink))
    
                var replacements = {
                    '%title%': key,
                    '%docpath%': '',
                    '%content%': resolvedMd.content
                }
                var contentHtml = templateHtml.replace(/%\w+%/g, function (all) {
                    return all in replacements ? replacements[all] : all;
                });
    
                fs.writeFileSync(resolvedMd.resolvedLink, contentHtml)
            } else {
                pathArray = node[key]

                for ( var pi = 0; pi < pathArray.length; ++pi ){
                    mdpath = pathArray[pi][0];
                    var pluginDeployPath = pathArray[pi][1]

                    var pathFileName = pathmanage.parse(mdpath).name

                    var outputPath = ''
                    var docPath = ''
                    if ( paths.deployPath ){
                        outputPath = paths.deployPluginPath + '/' + pluginDeployPath + '/' + pathFileName + '.doc.html'
                        docPath = pluginDeployPath.split('/').map(p => '..').join('/') + '/../' + (process.platform === 'darwin' ? 'Docs/' : 'docs/')
                    } else {
                        outputPath = paths.htmlOutputPath + '/extra/' + pathFileName + '/' + pathFileName + '.doc.html'
                        docPath = '../../'
                    }
                    // paths.htmlOutputPath + '/' + fileName
                    var resolvedMd = resolveMarkDown(outputPath)
                    var pathDirectory = pathmanage.dirname(resolvedMd.resolvedLink);
                    
                    if ( !fs.existsSync(pathDirectory) )
                        fs.mkdirSync(pathDirectory, { recursive: true });
                    result.data.push(new IndexLink(key, resolvedMd.resolvedLink))
        
                    var replacements = {
                        '%title%': key,
                        '%docpath%': docPath,
                        '%indexList%' : '<p></p>',
                        '%content%': resolvedMd.content
                    }
                    var contentHtml = templateHtml.replace(/%\w+%/g, function (all) {
                        return all in replacements ? replacements[all] : all;
                    });

                    if ( resolvedMd.resources.length ){
                        var mdFileFolder = pathmanage.dirname(resolvedMd.mdFile)
                        // copy 'extras' folder
                        for ( var resIndex = 0; resIndex < resolvedMd.resources.length; ++resIndex ){
                            var from = mdFileFolder + '/' + resolvedMd.resources[resIndex]
                            var to = pathDirectory + '/' + resolvedMd.resources[resIndex]

                            ncp.limit = 16;

                            ncp(from, to, function (err){
                                if (err) {
                                    return console.error(err);
                                }
                            })
                        }
                    }
        
                    fs.writeFileSync(resolvedMd.resolvedLink, contentHtml)
                }
            }

        } else if (typeof node === 'string' || node instanceof String) {
            result.data.push(new IndexTitle(node))
        } else {
            throw new Error('Incompatible node type: ' + node)
        }
    }
    return result;
}

function resolveMarkDown(recommendedName) {
    var result = {
        'content': '',
        'titles': [],
        'resolvedLink': [],
        'mdFile' : '',
        'relativePath': '',
        'resources' : []
    }

    var parentDir = pathmanage.resolve(pathmanage.dirname(indexPath))

    var mdabsolutepath = parentDir + '/' + mdpath
    result.mdFile = pathmanage.resolve(mdabsolutepath);

    // paths.htmlOutputPath + '/' + fileName
    var fileName = generateFileName(pathmanage.parse(mdpath).name, mdpath);
    var absolutefilepath = recommendedName ? recommendedName : generateAbsolutePath(paths.htmlOutputPath, pathmanage.parse(mdpath).name, mdpath);

    console.log("Parse: " + mdabsolutepath)
    console.log("   To -->: " + absolutefilepath)

    result.resolvedLink = absolutefilepath

    var slpos = mdabsolutepath.lastIndexOf('#')
    if (slpos !== -1) {
        mdabsolutepath = mdabsolutepath.substring(0, slpos)
    }

    if (!fs.existsSync(mdabsolutepath))
        throw new Error("File does not exist: " + mdabsolutepath)

    var fileMdContent = fs.readFileSync(mdabsolutepath, 'utf8')

    var renderer = new marked.Renderer();

    function iterateProperty(renderer, type, value, level) {
        if (type === 'plugin') {
            renderer.currentPlugin = value
            renderer.indexCollector[value] = []
            return ''
        } else if (type === 'qmlType') {
            renderer.currentType = {
                name: value,
                path: renderer.currentPlugin + '.' + value,
                brief: '',
                inherits: ['', ''],
                properties: [],
                methods: [],
                signals: [],
                enums: [],
                lastAdded: ''
            }

            renderer.indexCollector[renderer.currentPlugin].push(renderer.currentType)
            return `<h1 id="${value}"><code>${value}</code> type</h1>\n<!-----classsummary:${renderer.currentPlugin}:${value}----->\n`
        } else if (type === 'qmlInherits') {
            renderer.currentType.inherits = [value, ""]
            renderer.currentType.lastAdded = type
            return ''
        } else if (type === 'qmlBrief') {
            renderer.currentType.brief = value
            setBrief(value, renderer.currentType.lastAdded);
            return `<p>${value}</p>\n`
        } else if (type === 'qmlEnum') {
            renderer.currentType.enums.push([value, ""])
            renderer.currentType.lastAdded = type
            return `<h4 id="${renderer.currentType.name}-${value}"><code>${value}</code> enum</h2>\n`
        } else if (type === 'qmlProperty') {
            renderer.currentType.properties.push([value, ""])
            renderer.currentType.lastAdded = type
            return `<h4 id="${renderer.currentType.name}-${value.split(" ").pop()}"><code>${value}</code> property</h2>\n`
        } else if (type === 'qmlMethod') {
            renderer.currentType.methods.push([value, ""])
            renderer.currentType.lastAdded = type
            return `<h4 id="${renderer.currentType.name}-${value}"><code>${value}</code> method</h2>\n`
        } else if (type === 'qmlSignal') {
            renderer.currentType.signals.push([value, ""])
            renderer.currentType.lastAdded = type
            return `<h4 id="${renderer.currentType.name}-${value.split(" ").join("%20").replace("(", "%28").replace(")", "%29")}"><code>${value}</code> signal</h2>\n`
        } else if (type === 'qmlSummary') {
            return `<h2>Summary</h2>\n<!-----pluginsummary:${value}----->\n`
        } else if (type === "using" ){
            result.resources.push(value)
            return ``
        } else if (type === "livekeysInit"){
            return `<span class="livekeys-init" src="livekeys://${value}"></span>\n`
        }

        return ''
    }

    function setBrief(value, type) {
        if (type === 'qmlInherits') {
            let n = renderer.currentType.inherits.length;
        } else if (type === 'qmlEnum') {
            let n = renderer.currentType.enums.length;
            // brief
            renderer.currentType.enums[n - 1][1] = "Enum";
        } else if (type === 'qmlProperty') {
            let n = renderer.currentType.properties.length;
            // brief
            renderer.currentType.properties[n - 1][1] = "Property";
        } else if (type === 'qmlMethod') {
            let n = renderer.currentType.methods.length;
            // brief
            renderer.currentType.methods[n - 1][1] = "Method";
        } else if (type === 'qmlSignal') {
            let n = renderer.currentType.signals.length;
            // brief
            renderer.currentType.signals[n - 1][1] = "Signal";
        }
    }

    renderer.currentPlugin = ''
    renderer.currentType = ''
    renderer.indexCollector = {}

    // Override function
    renderer.paragraph = function (text, level) {
        var trimmedText = text.trim()
        if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
            var result = '';
            var segments = trimmedText.split('}')
            var validSegments = 0
            for (var i = 0; i < segments.length; ++i) {
                var segment = segments[i].trim()
                if (segment.startsWith('{')) {
                    var [propertyType, propertyValue] = segment.substring(1).split(':')
                    result += iterateProperty(renderer, propertyType.trim(), propertyValue.trim(), level)
                    validSegments++;
                }
            }

            if (validSegments > 0)
                return result;
        }
        return '<p>' + text + '</p>\n';
    };

    renderer.link = function (href, title, text) {

        if ( href.startsWith("{") && href.endsWith("}") ){
            var hrefData = href.substr(1, href.length - 2)
            var hrefType = hrefData.substr(0, hrefData.indexOf(':'))
            // var hrefDetails = hrefData.substr(hrefData.substr(""))
            var hrefDetails = hrefData.substr(hrefData.indexOf(":") + 1)
            if ( hrefType === "livekeys-hover" ){
                var detailSegments = hrefDetails.split(";")
                if ( detailSegments.length === 2 ){
                    var onEnter = detailSegments[0]
                    var onLeave = detailSegments[1]

                    return `<span class="livekeys-hover" enter="${onEnter}" leave="${onLeave}">${text}</span>`
                }
            }
        } else if ( href.startsWith('livekeys://') ){
            return '<a class="livekeys-action" target="_blank" href="' + href + '">' + text + '</a>';
        }

        let anchor = false;
        href = mdToHTML(fileName, href, anchor)
        // [href, anchor] = mdToHTML(fileName, href, anchor);
        // [href, anchor] = localAnchorLink(href, anchor);

        href = cleanUrl(this.options.sanitize, this.options.baseUrl, href);
        if (href === null) {
            return text;
        }

        var out = '<a href="' + href + '"';
        if (title) {
            out += ' title="' + title + '"';
        }
        out += '>' + text + '</a>';
        return out;
    };

    renderer.heading = function (text, level, raw, slugger) {
        let id = '';
        if (text.indexOf("{#") > 0) {
            text = text.split("{#");
            id = text[1].slice(0, -1);
            text = text[0];
        }

        // if (this.options.headerIds) {
        //     return '<h' +
        //         level +
        //         ' id="' +
        //         this.options.headerPrefix +
        //         slugger.slug(raw) +
        //         '">' +
        //         text +
        //         '</h' +
        //         level +
        //         '>\n';
        // }
        // ignore IDs
        return '<h' + level + ' ' + (id ? 'id="' + id + '"' : '') + '>' + text + '</h' + level + '>\n';
    };

    function mdToHTML(currentFilePath, href, anchor) {
    //     if (href.indexOf(".md") > 0) {
    //         currentFilePath = currentFilePath.split(".html")[0];

    //         let hrefFilePath = href.split("doc/output/md/")[1];
    //         if (hrefFilePath == undefined)
    //             return [href, anchor];
    //         hrefFilePath = hrefFilePath.split(".md#");
    //         if (hrefFilePath[0] === currentFilePath) {
    //             href = hrefFilePath[1];
    //             anchor = true;
    //         }
    //     }

        if ( href.startsWith('qml:') ){
            return docparser.typeToUrl(href.substring(4))
        }

        var cppindex = href.indexOf('-cpp.md')
        if ( cppindex > 0 ){
            var res = "lib_" + href.substring(0, cppindex) + ".html" + href.substring(cppindex + 7)
            return res
        }

        href = href.replace('.md', '.html')
        // console.log(href)
        return href;
        // return [href, anchor];
    }

    function localAnchorLink(href, anchor) {
        if (href[0] == "#")
            return [href.substring(1), true];
        return [href, anchor];
    }

    var tokens = marked.lexer(fileMdContent);

    // create html content
    result.content = marked(marked.parser(tokens, {
        renderer: renderer
    }))

    // replace plugin summary with actual content
    // generates link for plugin
    result.content = result.content.replace(/<\!\-{5}pluginsummary\:([a-zA-Z\.]*)\-{5}>/g, function (match, contents, offset, input_string) {
        var result = '<table>'

        var plugin = renderer.indexCollector[contents]
        for (var i = 0; i < plugin.length; ++i) {
            var cls = plugin[i]
            result += '<tr><td><code>Type</code><a href="' + generateFileName(pathmanage.parse(mdpath).name, mdpath, [true, "#" + cls.name]) + '"><code>' + cls.name + '</code></a></td><td>' + cls.brief + '</td></tr>'
        }
        return result + '</table>';
    })

    // replace class summary with actual content
    result.content = result.content.replace(/<\!\-{5}classsummary\:([a-zA-Z\.]*\:[[a-zA-Z]*)\-{5}>/g, function (match, contents, offset, input_string) {
        var result = ''
        var [pluginPath, requiredType] = contents.split(':')

        var plugin = renderer.indexCollector[pluginPath]
        for (var i = 0; i < plugin.length; ++i) {
            var cls = plugin[i]
            if (cls.path === pluginPath + '.' + requiredType) {
                if (cls.inherits.length > 0) {
                    let link = cls.inherits[0];
                    result += `<table><tr class="qml-type qml-index qml-inherits"><td><code>Inherits</code></td><td><code>${docparser.typesToLink(link)}</code></td></tr></table>\n`
                }
                if (cls.enums.length > 0) {
                    result += '<table>'
                    for (var j = 0; j < cls.enums.length; ++j) {
                        result += '<tr class="qml-type qml-index qml-enum"><td><code>Enum</code></td><td><code><a href="#' + cls.name + '-' + (cls.enums[j][0]) + '">' + cls.enums[j][0] + '</a></code></td></tr>'
                    }
                    result += '</table>\n'
                }
                if (cls.properties.length > 0) {
                    result += '<table>'
                    for (var j = 0; j < cls.properties.length; ++j) {
                        result += '<tr class="qml-type qml-index qml-property"><td><code>Property</code></td><td><code><a href="#' + cls.name + '-' + (cls.properties[j][0]).split(" ").pop() + '">' + cls.properties[j][0] + '</a></code></td></tr>'
                    }
                    result += '</table>\n'
                }
                if (cls.methods.length > 0) {
                    result += '<table>'
                    for (var j = 0; j < cls.methods.length; ++j) {
                        result += '<tr class="qml-type qml-index qml-method"><td><code>Method</code></td><td><code><a href="#' + cls.name + '-' + (cls.methods[j][0]).split(" ").join("%20") + '">' + cls.methods[j][0] + '</a></code></td></tr>'
                    }
                    result += '</table>\n'
                }
                if (cls.signals.length > 0) {
                    result += '<table>'
                    for (var j = 0; j < cls.signals.length; ++j) {
                        result += '<tr class="qml-type qml-index qml-signal"><td><code>Signal</code></td><td><code><a href="#' + cls.name + '-' + (cls.signals[j][0]).split(" ").join("%20").replace("(", "%28").replace(")", "%29") + '">' + cls.signals[j][0] + '</a></code></td></tr>'
                    }
                    result += '</table>\n'
                }
            }
        }
        return result;
    });

    populateIndexTableForCurr(result.content, fileName);
    // 

    return result
}

function addIndexList(list) {
    var result = new IndexList();
    for (var i = 0; i < list.length; ++i) {
        var node = list[i];

        if (node.constructor === Array) {
            addIndexList(node)
        } else if (typeof node === 'object' && node !== null) {
            let key = Object.keys(node)[0];
            if ( key !== "__extra" ){
                mdpath = node[key];
                addIndexTableToHtml();
            }
        }
    }
    return result;

    function addIndexTableToHtml() {
        let htmlabsolutepath = generateAbsolutePath(paths.htmlOutputPath, pathmanage.parse(mdpath).name, mdpath);
        let contentHtml = fs.readFileSync(htmlabsolutepath, "utf-8");
        contentHtml = contentHtml.replace("%indexList%", fs.readFileSync(indexTablePath))
        fs.writeFileSync(htmlabsolutepath, contentHtml)
        return htmlabsolutepath;
    }
}

function classesTypesIndexTable(currHtml) {
    let re = RegExp("\<code\>((class)|(Type))\<\/(code)\>((?!\<\/a\>).)*\<\/a\>", 'g');
    let filepath = generateFileName(pathmanage.parse(mdpath).name, mdpath);

    var result = '<ul class="expandable-data hidden">';
    let firstHr = true;
    while ((match = re.exec(currHtml)) != null) {

        let replaceRegex = RegExp('^.*\"(.*)\".*\<code\>(.*)\<\/a\>$');
        let linkAndName = replaceRegex.exec(match[0]);

        if (!linkAndName)
            continue;

        // console.log("##### " + linkAndName[1]);

        linkAndName[1] = linkAndName[1].replace("#", "%23");

        if (linkAndName == null)
            continue;
        let text = '<li><a href="' + filepath + createAnchor(linkAndName[1]) + '">' + linkAndName[2] + '</a></li>'
        result += ((firstHr ? "" : " < hr > ") + text);
        firstHr = true;
    }
    result += "</ul>\n"; //expandable-data

    function createAnchor(path) {
        return "#" + path.substring(path.indexOf("%23") + "%23".length);
    }

    return result;
}

function putClassesAndTypes(indexHTML, currentPageHtml, currentFilePath) {

    // console.log("######## " + filepath)

    // let currentFilePath = filepath.split("doc/output/html/")[1];


    var re = RegExp("\'[^']*\>\>\'", 'g');

    while ((match = re.exec(indexHTML)) != null) {
        let matchFile = match[0];
        matchFile = matchFile.split("../");
        matchFile = "/" + matchFile[matchFile.length - 1]; // removes ../../
        matchFile = matchFile.substring(0, matchFile.length - 3); // removes >>
        matchFile = matchFile.replace("'", '');

        // if (matchFile.indexOf("lcveditor") > 0) {
        //     console.log("######## " + matchFile)
        //     console.log("@@@@@@@@ " + pathmanage.parse(matchFile).name)
        // }
        matchFile = generateFileName(pathmanage.parse(matchFile).name, matchFile);
        // if (matchFile.indexOf("lcveditor") > 0) {
        //     console.log("@@@@@@@@ " + matchFile)
        // }

        if (currentFilePath.indexOf("lcveditor") > 0)
            console.log("( " + matchFile + " " + currentFilePath + " )");
        if (matchFile == currentFilePath) {
            let i;
            for (i = match.index; indexHTML[i] != '<'; i--);

            start = i;
            
            for (i = match.index + match[0].length + 1; indexHTML[i] != '\/' || indexHTML[i + 1] != 'a' || indexHTML[i + 2] != '>'; i++);

            end = i + 3;

            indexHTML = indexHTML.substring(0, start) + classesTypesIndexTable(currentPageHtml) + indexHTML.substring(end);
        }
    }

    return indexHTML;
}

function captureIndexTable(jsonData, node){
    if ( !isArray(jsonData) ){
        throw new Error("Data not of array type: " + JSON.stringify(jsonData));
    }

    var n = node ? node : new IndexTableNode();
    n.nested = true;

    var last = null;

    for ( var i = 0; i < jsonData.length; ++i ){
        var current = jsonData[i]
        if (typeof current === 'string' || current instanceof String) {
            current = current.trim();
            if ( current === '' ){
                throw new Error("Null text given at json node: " + JSON.stringify(jsonData));
            }
            var nestedN = new IndexTableNode();
            nestedN.text = current
            if (nestedN.text.indexOf(">>") > 0) {
                nestedN.text = nestedN.text.replace(new RegExp("md", 'g'), "html");
                nestedN.link = nestedN.text
            }

            n.children.push(nestedN);


            last = nestedN;
        } else if ( isObject(current) ){
            for (var key in current) {
                if ( key !== '__extra' ){
                    var nestedN = new IndexTableNode();
                    nestedN.link = generateFileName(
                        pathmanage.parse(current[key]).name,
                        current[key], [current[key].indexOf("#") > 0,
                        current[key].substring(current[key].indexOf("#"))
                    ]);;
                    nestedN.text = key;
    
                    n.children.push(nestedN);
    
                    last = nestedN;
                }
            }

        } else if ( isArray(current) ){
            if ( last ){
                if ( current.length === 1 && 
                    (typeof current[0] === 'string' || current[0] instanceof String) 
                    && current[0].endsWith('>>'))
                {
                    last.expandsTo = current[0].replace(new RegExp("md", 'g'), "html")
                } else {
                    last.nested = true
                    captureIndexTable(current, last)
                }
            }
        }
    }

    return n;
}

function printTableLevel(level, num) {
    var n = captureIndexTable(level)
    return n.toHtml();
}

function initiateIndexList() {
    let indexJson = require(indexPath);
    let result = '';

    result += printTableLevel(indexJson, 1);
    // for (var key in indexJson) {
    //     let level = indexJson[key];
    // }

    return result;
}

function populateIndexTableForCurr(currentPageHtml, filepath) {
    skipFirstHr = true;
    let indexTableHTML
    if (fs.existsSync(indexTablePath)) {
        indexTableHTML = putClassesAndTypes(fs.readFileSync(indexTablePath, "utf-8"), currentPageHtml, filepath);
    } else {
        indexTableHTML = initiateIndexList();
        indexTableHTML = putClassesAndTypes(indexTableHTML, currentPageHtml, filepath);
    }
    fs.writeFileSync(indexTablePath, indexTableHTML);
}