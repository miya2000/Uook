// public domain.
/**
 * CharsetEncoder interface.
 * This interface provides interconversion of String and ByteArray.
 */
function CharsetEncoder() {
}
CharsetEncoder.prototype = {
    /**
     * encode target string to byte array.
     * If buffer parameter set, this method append to it.
     * @param {String}    str    - target string.
     * @param {ByteArray} buffer - result byte array which prepared by caller. Optional.
     * @return {ByteArray} - result byte array.
     */
    encode: null,
    /**
     * decode byte array to ECMAScript string(UTF-16).
     * @param {ByteArray} bytes  - source byte array.
     * @return {String} - result string.
     */
    decode: null
};

(function() {
    /** factory count. */
    var count = 0;
    /** default converter factory(registered as default). */
    var defaultFactory = null;
    /** converter factory list. */
    var factoryList = [];
    /** converter factory map(key => name, value => factory). */
    var factoryMap = {};
    /** converter factory cache(key => charset, value => factory). */
    var factoryCache = {};
    /** sort comparer by factory's order. */
    function sortFunc(a, b) {
        return a.order - b.order || b.index - a.index;
    }
    /**
     * Registers CharsetEncoderFactory object.
     * 
     * The factory object is expected to implements two methods below.
     * 
     *     factory.create(charset) : 
     *         Creates CharsetEncoder object for given charset name.
     *         If the converter supports one charset, You can implement this method to ignore given charset.
     *         You may implement this method as Singleton if possible.
     * 
     *     factory.available(charset) : 
     *         Tests this factory's converter supports the given charset.
     *         If the converter supports any charset and you don't know
     *         those all charset name, you may implement this method
     *         always returns true. In this case, You must set 
     *         order parameter to 1000 over.
     * 
     * The order parameter is used to find factory by charset(@see #create).
     * You should set this value to be given priority to faster converter.
     * The factory that is registered later will be selected when the order values are same.
     * 
     * @param {String}  name      - factory's name.
     * @param {CharsetEncoderFactory} factory - factory of CharsetEncoder.
     * @param {String}  order     - search order to find by charset. lower is prior. default value is 100.
     * @param {Boolean} asDefault - mark factory as default. Optional.
     */
    CharsetEncoder.registerFactory = function registerFactory(name, factory, order, asDefault) {
        this.unregisterFactory(name);
        var item = {
            name : name,
            factory : factory,
            order : order != null ? order : 100,
            index : count++
        };
        factoryMap[name] = item;
        factoryList.push(item);
        factoryList.sort(sortFunc);
        if (asDefault) {
            defaultFactory = factory;
        }
        factoryCache = {};
    };
    /**
     * Unregiters factory.
     * @param {String} name - factory's name.
     */
    CharsetEncoder.unregisterFactory = function unregisterFactory(name) {
        var existsItem = factoryMap[name];
        if (!existsItem) return;
        for(var i = 0, item; item = factoryList[i]; i++) {
            if (item === existsItem) {
                factoryList.splice(i, 1);
                break;
            }
        }
        delete factoryMap[name];
    };
    /**
     * Creates CharsetEncoder using default factory.
     * @param {String} charset - charset name.
     * @return {CharsetEncoder} - charset encoder.
     */
    CharsetEncoder.create = function create(charset) {
        if (charset == null) {
            return defaultFactory.create();
        }
        var cached = factoryCache[charset];
        if (cached) return cached.create(charset);
        for (var i = 0, item; item = factoryList[i]; i++) {
            if (item.factory.available(charset)) {
                factoryCache[charset] = item.factory;
                return item.factory.create(charset);
            }
        }
        return null;
    };
    /**
     * Returns CharsetEncoderFactory.
     * @param {String} name - factory's name.
     * @return {CharsetEncoderFactory} - charset encoder factory.
     */
    CharsetEncoder.getFactory = function getFactory(name) {
        if (name == null) {
            return defaultFactory;
        }
        if (factoryMap.hasOwnProperty(name)) {
            return factoryMap[name].factory;
        }
        return null;
    };
    CharsetEncoder.impl = {};
})();

(function() {
    /**
     * CharsetEncoder for UTF-16LE.
     */
    function UTF16LEEncoder() {
    }
    UTF16LEEncoder.prototype.encode = function encode(str, buffer) {
        var buf = buffer || [], b_len = buf.length;
        for (var i = 0, len = str.length; i < len; i++) {
            var code = str.charCodeAt(i);
            buf[b_len++] = code & 0xFF;
            buf[b_len++] = code >>> 8 & 0xFF;
        }
        return buf;
    };
    UTF16LEEncoder.prototype.decode = function decode(bytes) {
        var buf = [], b_len = 0, s = 0;
        if (bytes[0] == 0xFF && bytes[1] == 0xFE) s = 2; // skip BOM(LE)
        for (var i = s, len = bytes.length; i < len;) {
            buf[b_len++] = bytes[i++] | bytes[i++] << 8;
        }
        return String.fromCharCode.apply(String, buf);
    };
    UTF16LEEncoder.prototype.constructor = UTF16LEEncoder;
    var instance = new UTF16LEEncoder();
    CharsetEncoder.registerFactory(
        'UTF-16LE',
        {
            create : function(charset) {
                return instance;
            },
            available : function(charset) {
                return /^(?:utf-?16(?:le)?|unicode)$/i.test(charset);
            }
        }
    );
    CharsetEncoder.impl.UTF16LEEncoder = UTF16LEEncoder;
})();

(function() {
    /**
     * CharsetEncoder for UTF-8.
     */
    function UTF8Encoder() {
    }
    UTF8Encoder.prototype.encode = function encode(str, buffer) {
        var buf = buffer || [], b_len = buf.length;
        for (var i = 0, len = str.length; i < len; i++) {
            var code = str.charCodeAt(i);
            // frequency order.
            if (code < 0x80) {
                buf[b_len++] = code;
            }
            else if (code > 0x07FF) {
                buf[b_len++] = 0xE0 | (code >>> 12 & 0x0F);
                buf[b_len++] = 0x80 | (code >>>  6 & 0x3F);
                buf[b_len++] = 0x80 | (code        & 0x3F);
            }
            else {
                buf[b_len++] = 0xC0 | (code >>>  6);
                buf[b_len++] = 0x80 | (code & 0x3F);
            }
        }
        return buf;
    };
    UTF8Encoder.prototype.decode = (function() {
        // http://coderepos.org/share/browser/lang/javascript/Base64/trunk/base64.js
        var reg = /[\xC0-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|[\xF0-\xF7][\x80-\xBF]{3}/g;
        var rep = function (m) {
            var c0 = m.charCodeAt(0);
            var c1 = m.charCodeAt(1);
            if (c0 < 0xE0) {
                return String.fromCharCode(((c0 & 0x1F) << 6) | (c1 & 0x3F));
            }
            else{
                var c2 = m.charCodeAt(2);
                return String.fromCharCode(
                    ((c0 & 0x0F) << 12) | ((c1 & 0x3F) <<  6) | (c2 & 0x3F)
                );
            }
        };
        return function decode(bytes) {
            if (bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF) bytes = bytes.slice(3); // skip BOM
            return String.fromCharCode.apply(String, bytes).replace(reg, rep);
        }
    })();
    UTF8Encoder.prototype.constructor = UTF8Encoder;
    var instance = new UTF8Encoder();
    CharsetEncoder.registerFactory(
        'UTF-8',
        {
            create : function(charset) {
                return instance;
            },
            available : function(charset) {
                return /^(?:utf-?8)$/i.test(charset);
            }
        },
        null,
        true // mark as default.
    );
    CharsetEncoder.impl.UTF8Encoder = UTF8Encoder;
})();
