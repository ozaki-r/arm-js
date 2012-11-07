/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;

function fsTestAvailability(requestByte, sCallback, eCallback) {
    if (!window.webkitStorageInfo) {
        if (eCallback)
            eCallback();
        return;
    }
    window.webkitStorageInfo.requestQuota(window.PERSISTENT, requestByte, function(grantedBytes) {
        window.requestFileSystem(window.PERSISTENT, requestByte, function(fs) {
            if (sCallback)
                sCallback(fs);
        }, eCallback);
    }, eCallback);
}

function HTML5FileSystem(root, requestByte) {
    this.rootDirectory = root;
    this.requestByte = requestByte;

    this.enabled = false;
    this.fs = null;

    var that = this;
    fsTestAvailability(requestByte, function(fs) {
        that.fs = fs;
        that.enabled = true;
        fs.root.getDirectory(that.rootDirectory, {create: true}, null, errorHandler);
    }, errorHandler);
}

function errorHandler(e) {
  var msg = '';
  if (window.FileError === undefined) {
    console.log('Error: Unknown');
    return;
  }

  switch (e.code) {
    case FileError.ABORT_ERR:
      msg = 'ABORT_ERR';
      break;
    case FileError.ENCODING_ERR:
      msg = 'ENCODING_ERR';
      break;
    case FileError.QUOTA_EXCEEDED_ERR:
      msg = 'QUOTA_EXCEEDED_ERR';
      break;
    case FileError.NOT_FOUND_ERR:
      msg = 'NOT_FOUND_ERR';
      break;
    case FileError.NOT_READABLE_ERR:
      msg = 'NOT_READABLE_ERR';
      break;
    case FileError.NO_MODIFICATION_ALLOWED_ERR:
      msg = 'NO_MODIFICATION_ALLOWED_ERR';
      break;
    case FileError.SECURITY_ERR:
      msg = 'SECURITY_ERR';
      break;
    case FileError.INVALID_MODIFICATION_ERR:
      msg = 'INVALID_MODIFICATION_ERR';
      break;
    case FileError.INVALID_STATE_ERR:
      msg = 'INVALID_STATE_ERR';
      break;
    case FileError.SYNTAX_ERR:
      msg = 'SYNTAX_ERR';
      break;
    case FileError.TYPE_MISMATCH_ERR:
      msg = 'TYPE_MISMATCH_ERR';
      break;
    case FileError.PATH_EXISTS_ERR:
      msg = 'PATH_EXISTS_ERR';
      break;
    default:
      msg = 'Unknown Error';
      break;
  };

  console.log('Error: ' + msg);
}

HTML5FileSystem.prototype.fileWrite = function(name, data, as, callback) {
    var that = this;
    this.getRoot(function(dir) {
        dir.getFile(name, {create: true}, function(entry) {
            entry.createWriter(function(fileWriter) {
                fileWriter.onwriteend = function(e) {
                    fileWriter.onwriteend = function(e) {
                        console.log("Write done");
                        if (callback)
                            callback(_entry);
                    };
                    fileWriter.onerror = function(e) {
                        console.log('Write failed: ' + e.toString());
                    };
                    if (as.text)
                        fileWriter.write(new Blob([data], {type: "text/plain"}));
                    else
                        fileWriter.write(new Blob([data], {type: "example/binary"}));
                };
                fileWriter.onerror = function(e) {
                    console.log('Truncate failed: ' + e.toString());
                };
                fileWriter.truncate(0);
            });
        });
    });
};

HTML5FileSystem.prototype.fileRead = function(name, as, callback) {
    this.getRoot(function(dir) {
        dir.getFile(name, {create: true}, function(entry) {
            entry.file(function(file) {
                var reader = new FileReader();
                reader.onloadend = function() {
                    if (callback)
                        callback(this.result);
                };
                reader.onerror = function(e) {
                    console.log('Read failed: ' + e.toString());
                };

                if (as.text)
                    reader.readAsText(file);
                else
                    reader.readAsArrayBuffer(file);
            });
        }, errorHandler);
    });
};

HTML5FileSystem.prototype.getRoot = function(callback) {
    this.fs.root.getDirectory(this.rootDirectory, {}, function(entry) {
        entry.getMetadata(function(metadata) {
            entry.size = metadata.size;
            entry.mtime = metadata.modificationTime;
            callback(entry);
        });
    });
};

HTML5FileSystem.prototype.getEntry = function(parent, name, callback, errcb) {
    var _callback = function(entry) {
        entry.getMetadata(function(metadata) {
            entry.size = metadata.size;
            entry.mtime = metadata.modificationTime;
            callback(entry);
        });
    };
    parent.getFile(name, {}, _callback, function(e) {
        if (e.code == FileError.TYPE_MISMATCH_ERR) {
            parent.getDirectory(name, {}, _callback);
        } else {
            errorHandler(e);
            if (errcb)
                errcb(e);
        }
    });
};

HTML5FileSystem.prototype.getDirectoryEntries = function(dirEntry, callback) {
    var toArray = function(list) {
        return Array.prototype.slice.call(list || [], 0);
    }

    var readDirectoryEntries = function(entry, handler) {
        var dirReader = entry.createReader();
        var entries = [];

        var readEntries = function() {
            dirReader.readEntries (function(results) {
                if (results.length === 0) {
                    handler(entries.sort());
                } else {
                    entries = entries.concat(toArray(results));
                    readEntries();
                }
            }, errorHandler);
        };

        readEntries();
    }

    readDirectoryEntries(dirEntry, function(entries) {
        var ret_entries = [];
        function getMetadata(entry) {
            if (!entry) {
                callback(ret_entries);
                return;
            }
            entry.getMetadata(function(metadata) {
                entry.size = metadata.size;
                entry.mtime = metadata.modificationTime;
                ret_entries.push(entry);
                if (entries.length)
                    getMetadata(entries.shift());
                else
                    callback(ret_entries);
            });
        };
        getMetadata(entries.shift());
    });
};

HTML5FileSystem.prototype.create = function(parent, name, is, callback) {
    var getEntry = is.file ? parent.getFile : parent.getDirectory;
    getEntry.call(parent, name, {create: true}, function(entry) {
        entry.getMetadata(function(metadata) {
            entry.size = metadata.size;
            entry.mtime = metadata.modificationTime;
            callback(entry);
        });
    });
};

HTML5FileSystem.prototype.truncate = function(entry, callback) {
    entry.createWriter(function(fileWriter) {
        fileWriter.truncate(0);
        callback(entry);
    });
};

HTML5FileSystem.prototype.write = function(entry, buffer, offset, callback) {
    entry.createWriter(function(fileWriter) {
        fileWriter.onwriteend = function(e) {
            callback(entry);
        };

        fileWriter.onerror = function(e) {
            console.log('Write failed: ' + e.toString());
        };

        fileWriter.seek(offset);
        var view = new Uint8Array(buffer);
        fileWriter.write(new Blob([view]));
    });
};

HTML5FileSystem.prototype.read = function(entry, offset, count, callback) {
    entry.file(function(file) {
        var fileReader = new FileReader();

        fileReader.onloadend = function(e) {
            var ret = [];
            var buffer = this.result;

            if (offset > buffer.byteLength) {
                callback([]);
                return;
            }

            var size = buffer.byteLength < count ? buffer.byteLength : count;
            if ((size + offset) > buffer.byteLength)
                size = buffer.byteLength - offset;
            var data = new Uint8Array(buffer, offset, size);
            for (var i=0; i < size; i++)
                ret.push(data[i]);
            callback(ret);
        };
        fileReader.readAsArrayBuffer(file);
    });
};

HTML5FileSystem.prototype.remove = function(entry, callback) {
    entry.remove(function() {
        callback();
    }, function(e) {
        // FIXME: when directory is not empty
        errorHandler(e);
        callback();
    });
};

HTML5FileSystem.prototype.rename = function(dir, oldname, newname, callback) {
    this.getEntry(dir, oldname, function(entry) {
        entry.moveTo(dir, newname, function() {
            callback();
        }, function(e) {
            // FIXME
            errorHandler(e);
            callback();
        });
    });
};
