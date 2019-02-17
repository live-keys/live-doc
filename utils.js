function isArray(what) {
    return Object.prototype.toString.call(what) === "[object Array]";
}

function isObject(what) {
    return Object.prototype.toString.call(what) === "[object Object]";
}

function cleanUrl(sanitize, base, href) {
    // console.log(href)
    if (sanitize) {
        try {
            var prot = decodeURIComponent(unescape(href))
                .replace(/[^\w:]/g, '')
                .toLowerCase();
        } catch (e) {
            return null;
        }
        if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
            return null;
        }
    }
    if (base && !originIndependentUrl.test(href)) {
        href = resolveUrl(base, href);
    }
    try {
        href = encodeURI(href).replace(/%25/g, '%'); //.replace(/%23/g, '#');
    } catch (e) {
        return null;
    }

    // console.log('  --> ' + href)

    return href;
}

function generatePluginFileName(name) {
    return "plugin_" + name.substr("plugin-".length).replace('.', '/') + ".html";
}

function generateLibFileName(name) {
    return "lib_" + name.substr(0, name.length - "-cpp".length).replace('.', '/') + ".html";
}

function generateDefaultFileName(name) {
    return name + ".html";
}

function generateFileName(name, mdpath = undefined, anchor = [false, ""]) {
    if (mdpath && mdpath.indexOf("/plugins/") > -1)
        return generatePluginFileName(name) + (anchor[0] ? anchor[1] : "");
    if (name.indexOf("-cpp") > 0)
        return generateLibFileName(name) + (anchor[0] ? anchor[1] : "");
    return generateDefaultFileName(name) + (anchor[0] ? anchor[1] : "");
}

function generateAbsolutePath(absoluteOutPath, name, mdpath) {
    // anchor[0] -> true/false
    // anchor[1] -> #anchor
    return absoluteOutPath + "/" + generateFileName(name, mdpath);
}

module.exports = [
    isArray,
    isObject,
    cleanUrl,
    generateFileName,
    generateAbsolutePath
]