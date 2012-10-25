/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;

function errorHandler(e) {
  var msg = '';

  switch (e.code) {
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

window.webkitStorageInfo.requestQuota(PERSISTENT, 50*1024*1024, function(grantedBytes) {
  //window.requestFileSystem(window.PERSISTENT, grantedBytes, onInitFs, errorHandler);
  display.log((grantedBytes/1024/1024).toString() + 'MB granted');
}, function(e) {
  display.log('Error', e);
});

/*
function onInitFs(fs) {
   fs.root.getFile('log.txt', {create: true, exclusive: true}, function(fileEntry) {

   // fileEntry.isFile === true
   // fileEntry.name == 'log.txt'
   // fileEntry.fullPath == '/log.txt'

   }, errorHandler);
}

window.requestFileSystem(window.PERSISTENT, 1024*1024, onInitFs, errorHandler);
*/

function writeToFile(name, data, size, is_text) {
    function onInitFs(fs) {
      // Truncate to 0
      fs.root.getFile(name, {create: true}, function(fileEntry) {
        fileEntry.createWriter(function(fileWriter) {
          fileWriter.onwriteend = function(e) {
            console.log('Truncate completed.');
          };

          fileWriter.onerror = function(e) {
            console.log('Truncate failed: ' + e.toString());
          };

          fileWriter.truncate(0);
        }, errorHandler);
      }, errorHandler);

      // Write content
      fs.root.getFile(name, {create: true}, function(fileEntry) {
        fileEntry.createWriter(function(fileWriter) {
          fileWriter.onwriteend = function(e) {
            console.log('Write completed.');
          };

          fileWriter.onerror = function(e) {
            console.log('Write failed: ' + e.toString());
          };

          if (is_text)
              fileWriter.write(new Blob([data], {type: "text/plain"}));
          else
              fileWriter.write(new Blob([data], {type: "example/binary"}));

        }, errorHandler);
      }, errorHandler);
    }

    window.requestFileSystem(window.PERSISTENT, size, onInitFs, errorHandler);
}

function readFromFile(name, size, handler, is_text) {
    function onInitFs(fs) {
        fs.root.getFile(name, {}, function(fileEntry) {
            fileEntry.file(function(file) {
                var reader = new FileReader();

                reader.onloadend = handler;
                if (is_text)
                    reader.readAsText(file);
                else
                    reader.readAsArrayBuffer(file);
            }, errorHandler);
        }, errorHandler);
    }

    window.requestFileSystem(window.PERSISTENT, size, onInitFs, errorHandler);
}

function createDirectory(parent, path, handler) {
    function onInitFs(fs) {
        var dir = parent ? parent : fs.root;
        dir.getDirectory(path, {create: true}, function(dirEntry) {
            if (handler)
                handler(dirEntry);
        }, errorHandler);
    }

    window.requestFileSystem(window.PERSISTENT, 1024 * 1024, onInitFs, errorHandler);
}

function getDirectory(parent, path, handler, errcb) {
    function onInitFs(fs) {
        var dir = parent ? parent : fs.root;
        dir.getDirectory(path, {}, function(dirEntry) {
            if (handler)
                handler(dirEntry);
        }, errcb ? errcb : errorHandler);
    }

    window.requestFileSystem(window.PERSISTENT, 1024 * 1024, onInitFs, errorHandler);
}

function createFile(parent, path, handler) {
    function onInitFs(fs) {
        var dir = parent ? parent : fs.root;
        dir.getFile(path, {create: true}, function(fileEntry) {
            if (handler)
                handler(fileEntry);
        }, errorHandler);
    }

    window.requestFileSystem(window.PERSISTENT, 1024 * 1024, onInitFs, errorHandler);
}

function getFile(parent, path, handler, errcb) {
    function onInitFs(fs) {
        var dir = parent ? parent : fs.root;
        dir.getFile(path, {}, function(fileEntry) {
            if (handler)
                handler(fileEntry);
        }, errcb ? errcb : errorHandler);
    }

    window.requestFileSystem(window.PERSISTENT, 1024 * 1024, onInitFs, errorHandler);
}

function toArray(list) {
    return Array.prototype.slice.call(list || [], 0);
}

function readDirectoryEntries(dirEntry, handler) {
    var dirReader = dirEntry.createReader();
    var entries = [];

    // Call the reader.readEntries() until no more results are returned.
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

    readEntries(); // Start reading dirs.
}
