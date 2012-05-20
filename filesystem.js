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
    case FileError.QUOTA_EXCEEDED_ERR:
      msg = 'QUOTA_EXCEEDED_ERR';
      break;
    case FileError.NOT_FOUND_ERR:
      msg = 'NOT_FOUND_ERR';
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
    default:
      msg = 'Unknown Error';
      break;
  };

  console.log('Error: ' + msg);
}

window.webkitStorageInfo.requestQuota(PERSISTENT, 50*1024*1024, function(grantedBytes) {
  //window.requestFileSystem(window.PERSISTENT, grantedBytes, onInitFs, errorHandler);
  console.log((grantedBytes/1024/1024).toString() + 'MB granted');
}, function(e) {
  console.log('Error', e);
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

          var bb = new window.WebKitBlobBuilder();
          bb.append(data);
          if (is_text)
              fileWriter.write(bb.getBlob("text/plain"));
          else
              fileWriter.write(bb.getBlob("example/binary"));

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
