let marked = require('marked')
let pathmanage = require('path')
var fs = require('fs');

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
    IndexList
] = require("./init.js")

// require("./run_doxygen.js");
// require("./run_moxygen.js");

var mdpath;

resolveList(obj);
addIndexList(obj)

console.log("\nDone")

function resolveList(list) {
    var result = new IndexList();
    for (var i = 0; i < list.length; ++i) {
        var node = list[i];

        if (node.constructor === Array) {
            result.data.push(resolveList(node))
        } else if (typeof node === 'object' && node !== null) {
            var key = Object.keys(node)[0]

            mdpath = node[key];
            var resolvedMd = resolveMarkDown()

            result.data.push(new IndexLink(key, resolvedMd.resolvedLink))

            var replacements = {
                '%title%': key,
                '%content%': resolvedMd.content
            }
            var contentHtml = templateHtml.replace(/%\w+%/g, function (all) {
                return replacements[all] || all;
            });

            fs.writeFileSync(resolvedMd.resolvedLink, contentHtml)

        } else if (typeof node === 'string' || node instanceof String) {
            result.data.push(new IndexTitle(node))
        } else {
            throw new Error('Incompatible node type: ' + node)
        }
    }
    return result;
}

function resolveMarkDown() {
    var result = {
        'content': '',
        'titles': [],
        'resolvedLink': [],
        'relativePath': '',

    }

    var parentDir = pathmanage.resolve(pathmanage.dirname(indexPath))

    var mdabsolutepath = parentDir + '/' + mdpath

    // FIXME (if plugin, lib, other)
    var htmlabsolutepath = generateAbsolutePath(absoluteOutPath, pathmanage.parse(mdpath).name, mdpath);

    console.log("Parse: " + mdabsolutepath)
    console.log("   To -->: " + htmlabsolutepath)

    result.resolvedLink = htmlabsolutepath

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
            return `<h4 id="${value}"><code>${value}</code> enum</h2>\n`
        } else if (type === 'qmlProperty') {
            renderer.currentType.properties.push([value, ""])
            renderer.currentType.lastAdded = type
            return `<h4 id="${value.split(" ").join("%20")}"><code>${value}</code> property</h2>\n`
        } else if (type === 'qmlMethod') {
            renderer.currentType.methods.push([value, ""])
            renderer.currentType.lastAdded = type
            return `<h4 id="${value}"><code>${value}</code> method</h2>\n`
        } else if (type === 'qmlSignal') {
            renderer.currentType.signals.push([value, ""])
            renderer.currentType.lastAdded = type
            return `<h4 id="${value.split(" ").join("%20").replace("(", "%28").replace(")", "%29")}"><code>${value}</code> signal</h2>\n`
        } else if (type === 'qmlSummary') {
            return `<h2>Summary</h2>\n<!-----pluginsummary:${value}----->\n`
        }

        return ''
    }

    function setBrief(value, type) {
        if (type === 'qmlInherits') {
            let n = renderer.currentType.inherits.length;
            // brief
            renderer.currentType.inherits[1] = value;

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
        let anchor = false;
        [href, anchor] = mdToHTML(htmlabsolutepath, href, anchor);
        [href, anchor] = localAnchorLink(href, anchor);

        href = cleanUrl(this.options.sanitize, this.options.baseUrl, href);
        if (href === null) {
            return text;
        }

        var out = '<a href="' + (anchor ? "#" : "") + escape(href) + '"';
        if (title) {
            out += ' title="' + title + '"';
        }
        out += '>' + text + '</a>';
        return out;
    };

    renderer.heading = function (text, level, raw, slugger) {
        let id;
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
        return '<h' + level + ' id="' + id + '">' + text + '</h' + level + '>\n';
    };

    function mdToHTML(htmlabsolutepath, href, anchor) {
        if (href.indexOf(".md") > 0) {
            let currentFilePath = htmlabsolutepath.split("doc/output/html/")[1];

            // if (!currentFilePath)
            //     console.log(htmlabsolutepath.split("doc/output/html/"))

            currentFilePath = currentFilePath.split(".html")[0];

            let hrefFilePath = href.split("doc/output/md/")[1];
            if (hrefFilePath == undefined)
                return [href, anchor];
            hrefFilePath = hrefFilePath.split(".md#");
            if (hrefFilePath[0] === currentFilePath) {
                href = hrefFilePath[1];
                anchor = true;
            }
        }
        return [href, anchor];
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
            result += '<tr><td><code>Type</code><a href="' + generateAbsolutePath(absoluteOutPath, pathmanage.parse(mdpath).name, mdpath, [true, "#" + cls.name]) + '"><code>' + cls.name + '</code></a></td><td>' + cls.brief + '</td></tr>'
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
                    // TODO CHECK IF IT IS FINE
                    // result += `<table><tr><td><code>Inherits</code><code><a href="${generateAbsolutePath(absoluteOutPath, cls.inherits).replace(".","/")}">${cls.inherits}</a></code></td><td><!-----inheritbrief-----></td></tr></table>\n`
                    result += `<table><tr><td><code>Inherits</code><code><a href="${generateAbsolutePath(absoluteOutPath, cls.inherits[0]).replace(".","/")}">${cls.inherits[0]}</a></code></td><td>${cls.inherits[1]}</td></tr></table>\n`
                }
                if (cls.enums.length > 0) {
                    result += '<table>'
                    for (var j = 0; j < cls.enums.length; ++j) {
                        // result += '<tr><td><code>Enum</code><code><a href="#' + (cls.enums[j]) + '">' + cls.enums[j] + '</a></code></td><td><!-----enumbrief-----></td></tr>'
                        result += '<tr><td><code>Enum</code><code><a href="#' + (cls.enums[j][0]) + '">' + cls.enums[j][0] + '</a></code></td><td>' + cls.enums[j][1] + '</td></tr>'
                    }
                    result += '</table>\n'
                }
                if (cls.properties.length > 0) {
                    result += '<table>'
                    for (var j = 0; j < cls.properties.length; ++j) {
                        // result += '<tr><td><code>Property</code><code><a href="#' + (cls.properties[j]).split(" ").join("%20") + '">' + cls.properties[j] + '</a></code></td><td><!-----propertybrief-----></td></tr>'
                        result += '<tr><td><code>Property</code><code><a href="#' + (cls.properties[j][0]).split(" ").join("%20") + '">' + cls.properties[j][0] + '</a></code></td><td>' + cls.properties[j][1] + '</td></tr>'
                    }
                    result += '</table>\n'
                }
                if (cls.methods.length > 0) {
                    result += '<table>'
                    for (var j = 0; j < cls.methods.length; ++j) {
                        // result += '<tr><td><code>Method</code><code><a href="#' + (cls.methods[j]).split(" ").join("%20") + '">' + cls.methods[j] + '</a></code></td><td><!-----methodbrief-----></td></tr>'
                        result += '<tr><td><code>Method</code><code><a href="#' + (cls.methods[j][0]).split(" ").join("%20") + '">' + cls.methods[j][0] + '</a></code></td><td>' + cls.methods[j][1] + '</td></tr>'
                    }
                    result += '</table>\n'
                }
                if (cls.signals.length > 0) {
                    result += '<table>'
                    for (var j = 0; j < cls.signals.length; ++j) {
                        // result += '<tr><code>Signal</code><td><code><a href="#' + (cls.signals[j]).split(" ").join("%20").replace("(", "%28").replace(")", "%29") + '">' + cls.signals[j] + '</a></code></td><td><!-----signalbrief-----></td></tr>'
                        result += '<tr><code>Signal</code><td><code><a href="#' + (cls.signals[j][0]).split(" ").join("%20").replace("(", "%28").replace(")", "%29") + '">' + cls.signals[j][0] + '</a></code></td><td>' + cls.signals[j][1] + '</td></tr>'
                    }
                    result += '</table>\n'
                }
            }
        }
        return result;
    });

    populateIndexTableForCurr(result.content, result.resolvedLink);

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
            mdpath = node[key];
            addIndexTableToHtml();
        }
    }
    return result;

    function addIndexTableToHtml() {
        let htmlabsolutepath = generateAbsolutePath(absoluteOutPath, pathmanage.parse(mdpath).name, mdpath);
        let contentHtml = fs.readFileSync(htmlabsolutepath, "utf-8");
        contentHtml = contentHtml.replace("%indexList%", fs.readFileSync(indexTablePath))
        fs.writeFileSync(htmlabsolutepath, contentHtml)
        return htmlabsolutepath;
    }
}

// todo remove print (debuging)
// function classesTypesIndexTable(currHtml, print = false) {
function classesTypesIndexTable(currHtml) {
    let re = RegExp("\<code\>((class)|(Type))\<\/(code)\>((?!\<\/a\>).)*\<\/a\>", 'g');

    // <code>Type</code><a href="/Users/hrimthusar/Desktop/Projects/livecv/doc/output/html/plugin_lcvcore.html#MatView"><code>MatView</code></a>
    // <code>class</code><a href="/Users/hrimthusar/Desktop/Projects/livecv/doc/output/md/lveditqmljs-cpp.md%23classlv_1_1CodeQmlHandler"><code>lv::CodeQmlHandler</code></a>
    //< a href = "/Users/hrimthusar/Desktop/Projects/livecv/doc/output/html/plugin_lcvimgproc.html#sers/hrimthusar/Desktop/Projects/livecv/doc/output/html/plugin_lcvimgproc.html#Canny" > Canny < /a>

    let htmlabsolutepath = generateAbsolutePath(absoluteOutPath, pathmanage.parse(mdpath).name, mdpath);

    let result = '<div class="expandable">';
    let firstHr = true;
    while ((match = re.exec(currHtml)) != null) {
        // if (print)
        //     console.log("@@@@@@@@@@ " + match[0]);
        let replaceRegex = RegExp('^.*\"(.*)\".*\<code\>(.*)\<\/a\>$');
        let linkAndName = replaceRegex.exec(match[0]);

        if (!linkAndName)
            continue;

        linkAndName[1] = linkAndName[1].replace("#", "%23");

        console.log("######## ");
        console.log("# " + htmlabsolutepath);
        console.log("# " + linkAndName[1]);
        console.log("# " + linkAndName[2]);

        if (linkAndName == null)
            continue;
        let text = '<a href="' + htmlabsolutepath + createAnchor(linkAndName[1]) + '">' + linkAndName[2] + '</a>'
        result += ((firstHr ? "" : " < hr > ") + text);
        firstHr = true;
    }

    result += "</div>";

    function createAnchor(path) {
        return "#" + path.substring(path.indexOf("%23") + "%23".length);
    }

    return result;
}

function putClassesAndTypes(indexHTML, currentPageHtml, htmlabsolutepath) {
    let currentFilePath = htmlabsolutepath.split("doc/output/html/")[1];

    var re = RegExp("\'[^']*\>\>\'", 'g');

    while ((match = re.exec(indexHTML)) != null) {
        let matchFile = match[0];

        matchFile = generateFileName(pathmanage.parse(matchFile).name, pathmanage.parse(matchFile).dir);
        // console.log(matchFile);

        if (matchFile == currentFilePath) {
            let i;
            for (i = match.index; indexHTML[i] != '<'; i--);
            start = i;

            for (i = match.index + match[0].length + 1; indexHTML[i] != '\/' || indexHTML[i + 1] != 'a' || indexHTML[i + 2] != '>'; i++);
            end = i + 3;

            // todo remove (debuging)
            // if (match[0].indexOf("lcvcore") > 0) {
            //     console.log("###### " + match[0]);
            //     console.log(currentPageHtml);
            // console.log(classesTypesIndexTable(currentPageHtml));
            // indexHTML = indexHTML.substring(0, end) + classesTypesIndexTable(currentPageHtml, true) + indexHTML.substring(end);
            // } else
            indexHTML = indexHTML.substring(0, start) + classesTypesIndexTable(currentPageHtml) + indexHTML.substring(end);
        }
    }

    return indexHTML;
}

function printTableLevel(level, num) {
    let result = '';
    if (typeof level === 'string' || level instanceof String) {
        level = level.trim();
        if (level != '') {
            if (skipFirstHr)
                skipFirstHr = false;
            else
                result += "<hr>";
            result += "<div class='level-" + num + "'>";
            result += level;
            result += "</div>";

        }
    } else {
        for (var key in level) {
            if (isObject(level[key]) || isArray(level[key])) {
                result += printTableLevel(level[key], num + 1);
            } else {
                if (skipFirstHr)
                    skipFirstHr = false;
                else
                    result += "<hr>";
                result += "<div class='level-" + num + "'>";
                if (!isNaN(Number(key))) {
                    if (level[key].indexOf(">>") > 0) {
                        level[key] = level[key].replace(new RegExp("md", 'g'), "html");
                    }
                    result += "<a href='" + level[key] + "'>" + level[key] + "</a>";
                } else {
                    let link = generateAbsolutePath(absoluteOutPath,
                        pathmanage.parse(level[key]).name,
                        level[key], [level[key].indexOf("#") > 0,
                            level[key].substring(level[key].indexOf("#"))
                        ]);
                    result += "<a href='" + link + "'>" + key + "</a>";
                }
                result += "</div>";
            }
        }
    }

    return result;
}

function initiateIndexList() {
    let indexJson = require(indexPath);
    let result = '';

    for (var key in indexJson) {
        let level = indexJson[key];
        result += printTableLevel(level, 1);
    }

    return result;
}

function populateIndexTableForCurr(currentPageHtml, htmlabsolutepath) {
    skipFirstHr = true;
    let indexTableHTML
    if (fs.existsSync(indexTablePath)) {
        indexTableHTML = putClassesAndTypes(fs.readFileSync(indexTablePath, "utf-8"), currentPageHtml, htmlabsolutepath);
    } else {
        // fs.openSync(indexTablePath, 'w');
        // fs.writeFileSync(indexTablePath, "")
        indexTableHTML = initiateIndexList();
        indexTableHTML = putClassesAndTypes(indexTableHTML, currentPageHtml, htmlabsolutepath);
    }
    fs.writeFileSync(indexTablePath, indexTableHTML);
}