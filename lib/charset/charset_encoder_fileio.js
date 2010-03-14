
if (!this.CharsetEncoder) throw 'CharsetEncoder not loaded.';

(function() {
    /**
     * FileIOCharsetEncoder
     * implements with File I/O API.
     */
    function encode(str, buffer, charset, workfile) {
        var s = null, result = null;
        try {
            s = workfile.open(null, 'w+');
            s.write(str, charset);
            var b_len = s.position;
            s.position = 0;
            result = s.readBytes(b_len);
            s.close();
        }
        catch(e) {
            try { if (s) s.close(); } catch(ee) {}
            throw e;
        }
        return buffer ? Array.prototype.push.apply(buffer, result) : result;
    }
    function decode(bytes, charset, workfile) {
        if (bytes instanceof Array) {
            var b = new ByteArray(0);
            Array.prototype.push.apply(b, bytes);
            bytes = b;
        }
        var s = null, result = null;
        try {
            s = workfile.open(null, 'w+');
            s.writeBytes(bytes);
            s.writeBytes(new ByteArray(1)); // null terminator.
            s.position = 0;
            result = s.read(bytes.length, charset);
            s.close();
        }
        catch(e) {
            try { if (s) s.close(); } catch(ee) {}
            throw e;
        }
        return result;
    }
    function FileIOCharsetEncoder(workfile, charset) {
        if (charset == null) {
            charset = 'UTF-8';
        }
        this.encode = function(str, buffer) {
            deleteWorkFileLater();
            return encode(str, buffer, charset, workfile);
        };
        this.decode = function(bytes) {
            deleteWorkFileLater();
            return decode(bytes, charset, workfile);
        };
        var deleteTid = null;
        function deleteWorkFileLater() {
            deleteTid || (deleteTid = setTimeout(deleteWorkFile, 100));
        }
        function deleteWorkFile() {
            deleteTid = null;
            if (workfile.exists) workfile.deleteFile(workfile);
        }
    }
    var workfile = null;
    var workfileName = '.charsetencoder.tmp';
    var cache = {}, cacheTid;
    function deleteCacheLater() {
        cacheTid || (cacheTid = setTimeout(deleteCache, 100));
    }
    function deleteCache() {
        cacheTid = null; cache = {};
    }
    CharsetEncoder.registerFactory(
        'FileIO',
        {
            get workfileName()      { return workfileName; },
            set workfileName(value) { workfileName = value; workfile = null; cache = null; },
            getWorkfile : function() {
                if (workfile) return workfile;
                return workfile = opera.io.filesystem.mountSystemDirectory('storage').resolve(workfileName);
            },
            create : function(charset) {
                var cached = cache[charset];
                if (cached) return cached;
                deleteCacheLater();
                return cache[charset] = new FileIOCharsetEncoder(this.getWorkfile(), charset);
            },
            available : function(charset) {
                return true;
            }
        },
        1001
    );
    CharsetEncoder.impl.FileIOCharsetEncoder = FileIOCharsetEncoder;
})()
