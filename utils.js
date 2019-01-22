function isArray(what) {
    return Object.prototype.toString.call(what) === "[object Array]";
}

function isObject(what) {
    return Object.prototype.toString.call(what) === "[object Object]";
}

function cleanUrl(sanitize, base, href) {
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
    return href;
}

module.exports = [
    isArray,
    isObject,
    cleanUrl
]