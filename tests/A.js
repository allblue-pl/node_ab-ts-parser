import {
    js0,
    js1,
    js2,
} from "js0";

module.exports.escapeString = function(str) {
    return str.replace(/\'/g, '\'\'');
};

module.exports.unescapeString = function(str) {
    return str;
};

module.exports.quote = function(str) {
    return str
        .replace(/\\/g, "\\\\")
        .replace(/\'/g, "\\\'")
        .replace(/\"/g, "\\\"")
        .replace(/\n/g, "\\\n")
        .replace(/\r/g, "\\\r")
        .replace(/\x00/g, "\\\x00")
        .replace(/\x1a/g, "\\\x1a");
};