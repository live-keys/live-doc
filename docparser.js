var fs = require('fs');

class DocParser{

    static typesToLink(types){
        var segments = types
            .replace('(', ' ( ')
            .replace(',', ' , ')
            .split(' ').map(value => value.trim()).map(value => {
                var hashIndex = value.indexOf('#')

                if ( hashIndex !== -1 ){
                    var namespace = value.substring(0, hashIndex)
                    var type      = value.substring(hashIndex + 1)

                    if ( namespace.startsWith("external.") && type !== "" ){
                        DocParser.externals = DocParser.externals ? DocParser.externals : {}
                        DocParser.externals[namespace.substring(9).replace('.', '-') + '-' + type] = ''
                        return `<a href="external.html#${namespace.substring(9).replace('.', '-') + '-' + type}">${type}</a>`
                    }
                        

                    if ( namespace !== "" && type !== "" )
                        return `<a href="plugin_${namespace.replace('.', '-') + '.html#' + type}">${type}</a>`
                }
                return value
            })
            
        return segments.join(' ')
    }

    static exportExternals(path){
        if ( DocParser.externals ){
            var json = JSON.stringify(DocParser.externals);
            fs.writeFileSync(path, json, 'utf8');
        }
    }

}

module.exports = DocParser
