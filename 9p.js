/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

function FS9P() {
    this.root = '/9proot';  // Root directory for virtio-9p
}

FS9P.prototype.initFileSystem = function() {
    createDirectory(this.root);
};

FS9P.prototype.readdir = function(path, callback) {
    readDirectoryEntries(path, callback);
};

FS9P.prototype.get_dir = function(path, callback) {
    getDirectory(path, function(entry) {
        entry.getMetadata(function(metadata) {
            entry.size = metadata.size;
            entry.mtime = metadata.modificationTime;
            callback(entry);
        });
    });
};

FS9P.prototype.get_dir_entries = function(dirEntry, callback) {
    readDirectoryEntries(dirEntry, function(entries) {
        var ret_entries = [];
        function get_metadata(entry) {
            if (!entry) {
                callback(ret_entries);
                return;
            }
            entry.getMetadata(function(metadata) {
                entry.size = metadata.size;
                entry.mtime = metadata.modificationTime;
                ret_entries.push(entry);
                if (entries.length)
                    get_metadata(entries.shift());
                else
                    callback(ret_entries);
            });
        };
        get_metadata(entries.shift());
    });
};

FS9P.prototype.create_file = function(path, callback) {
    createFile(path, function(entry) {
        entry.getMetadata(function(metadata) {
            entry.size = metadata.size;
            entry.mtime = metadata.modificationTime;
            callback(entry);
        });
    });
};

FS9P.prototype.create_dir = function(path, callback) {
    createDirectory(path, function(entry) {
        entry.getMetadata(function(metadata) {
            entry.size = metadata.size;
            entry.mtime = metadata.modificationTime;
            callback(entry);
        });
    });
};

FS9P.prototype.get_file = function(path, callback, errcb) {
    getFile(path, function(entry) {
        entry.getMetadata(function(metadata) {
            entry.size = metadata.size;
            entry.mtime = metadata.modificationTime;
            callback(entry);
        });
    }, function(e) {
        errorHandler(e);
        errcb(e);
    });
};

FS9P.prototype.get = function(path, callback, errcb) {
    var _callback = function(entry) {
        entry.getMetadata(function(metadata) {
            entry.size = metadata.size;
            entry.mtime = metadata.modificationTime;
            callback(entry);
        });
    };
    getFile(path, _callback, function(e) {
        if (e.code == FileError.TYPE_MISMATCH_ERR) {
            getDirectory(path, _callback);
        } else {
            errorHandler(e);
            if (errcb)
                errcb(e);
        }
    });
};

FS9P.prototype.get_root = function(callback) {
    this.get_dir(this.root, callback);
};

FS9P.prototype.truncate = function(path, callback) {
    getFile(path, function(entry) {
        entry.createWriter(function(fileWriter) {
            fileWriter.truncate(0);
            callback();
        });
    });
};

FS9P.prototype.write = function(path, offset, buffer, callback) {
    getFile(path, function(entry) {
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
    });
};

FS9P.prototype.read = function(path, offset, count, callback) {
    getFile(path, function(entry) {
        entry.file(function(file) {
            var fileReader = new FileReader();
            fileReader.onloadend = function(e) {
                var ret = [];
                var buffer = this.result;

                if (offset > buffer.byteLength)
                    callback([]);

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
    });
};

FS9P.prototype.remove = function(path, callback) {
    this.get(path, function(entry) {
        entry.remove(function() {
            callback();
        }, function(e) {
            // FIXME when directory is not empty
            errorHandler(e);
            callback();
        });
    });
};

FS9P.prototype.rename = function(dir, oldname, newname, callback) {
    var path = [dir.fullPath, oldname].join("/");
    console.log(path);
    console.log(oldname);
    console.log(newname);
    this.get(path, function(entry) {
        entry.moveTo(dir, newname, function() {
            callback();
        }, function(e) {
            // FIXME
            errorHandler(e);
            callback();
        });
    });
};


/*
 * 9P2000.u Protocol
 */
function Protocol9P2000u(net9p) {
    this.net9p = net9p;

    this.VERSION = "9P2000.u";
    this.EXTENSION = ".u";
    this.IOUNIT = 4096;
    this.TERROR = 106;
    this.HEADER_SIZE = 4 + 1 + 2;  // size + id + tag
    this.msize = 0;
    this.fid2qid = {};
    this.qidpath2fspath = {};
    this.fspath2qid = {};
}

Protocol9P2000u.prototype.add_qid = function(fid, qid, path) {
    this.fid2qid[fid] = qid;
    this.qidpath2fspath[qid.path] = path;
    this.fspath2qid[path] = qid;
};

Protocol9P2000u.prototype.get_qid = function(path) {
    return this.fspath2qid[path];
};

Protocol9P2000u.prototype.build_reply = function(id, tag, payload) {
    var size = this.HEADER_SIZE + payload.length;
    // Reply ID is always +1 to request one
    var header = this.net9p.marshal(["w", "b", "h"], [size, id + 1, tag]);
    return header.concat(payload);
};

Protocol9P2000u.prototype.version = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w", "s"], next_data);
    display.log("[version] msize=" + req[0] + ", version=" + req[1]);
    this.msize = req[0];

    var payload = this.net9p.marshal(["w", "s"], [this.msize, this.VERSION]);
    return this.build_reply(id, tag, payload);
};
Protocol9P2000u.prototype[100] = Protocol9P2000u.prototype.version;

Protocol9P2000u.prototype.attach = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w", "w", "s", "s", "w"], next_data);
    var fid = req[0];
    var afid = req[1];  // afid is used for auth. virtio_9p doesn't use it.
    var uname = req[2];
    var aname = req[3];
    var n_uname = req[4];
    display.log("[attach] fid=" + fid + ", afid=" + afid + ", uname=" + uname
                + ", aname=" + aname + ", n_uname=" + n_uname);

    // Return root directory's QID
    var net9p = this.net9p;
    net9p.fs.get_root(function(entry) {
        var qid = {
            type: 0x10 | 0x80,  // mount point & directory
            version: entry.mtime.getTime(),
            path: net9p.hashCode32(entry.fullPath)
        };

        net9p.proto.add_qid(fid, qid, net9p.fs.root);

        var payload = net9p.marshal(["Q"], [qid]);
        var reply = net9p.proto.build_reply(id, tag, payload);
        net9p.send_reply(reply);
    });
    return null;
};
Protocol9P2000u.prototype[104] = Protocol9P2000u.prototype.attach;

Protocol9P2000u.prototype.walk = function(id, tag, next_data) {
    // path elements ["root", "dir1", "dir2",...]
    var req = this.net9p.unmarshal(["w", "w", "h"], next_data);
    var fid = req[0];
    var nwfid = req[1];  // afid is used for auth. virtio_9p doesn't use it.
    var nwname = req[2];
    display.log("[walk] fid=" + fid + ", nwfid=" + nwfid + ", nwname=" + nwname);

    var pqid = this.net9p.proto.fid2qid[fid];
    if (!pqid)
        abort("No such QID found for fid=" + fid);

    if (nwname === 0) {
        this.net9p.proto.fid2qid[nwfid] = pqid;

        var payload = this.net9p.marshal(["h"], [0]);
        return this.build_reply(id, tag, payload);
    }

    var wnames = [];
    for (var i=0; i < nwname; i++) {
        wnames.push(this.net9p.unmarshal(["s"], next_data));
    }

    var pqid = this.net9p.proto.fid2qid[fid];
    var fullpath = [this.qidpath2fspath[pqid.path], wnames[nwname - 1]].join("/");

    if (nwname == 1) {
        var net9p = this.net9p;
        display.log("[walk] path=" + fullpath);
        net9p.fs.get(fullpath, function(entry) {
            var qid = {
                type: (entry.isDirectory ? 0x80 : 0),
                version: entry.mtime.getTime(),
                path: net9p.hashCode32(entry.fullPath)
            };

            net9p.proto.add_qid(nwfid, qid, entry.fullPath);

            var payload = net9p.marshal(["h", "Q"], [1, qid]);
            var reply = net9p.proto.build_reply(id, tag, payload);
            net9p.send_reply(reply);

        }, function(e) {
            // FIXME
            var payload = net9p.marshal(["s", "w"], ["No such file or directory", 2]);
            var reply = net9p.proto.build_reply(net9p.proto.TERROR, tag, payload);
            net9p.send_reply(reply);
        });

        return null;
    }

    abort("walk: nwname=" + nwame);

    var qid = {
        type: 0,  // file
        version: (new Date()).getTime(),
        path: this.net9p.hashCode32(fullpath)
    };

    this.add_qid(nwfid, qid, fullPath);

    // Return QIDs of the path elements
    var types = ["h"];
    for (var i=0; i < nwname; i++) {
        types.push("Q");
    }

    var data = [nwname];
    data.push(qid);   // FIXME

    var payload = this.net9p.marshal(types, data);
    return this.build_reply(id, tag, payload);
};
Protocol9P2000u.prototype[110] = Protocol9P2000u.prototype.walk;

Protocol9P2000u.prototype.open = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w", "b"], next_data);
    var fid = req[0];
    var mode = req[1];
    display.log("[open] fid=" + fid + ", mode=" + mode.toString(16));

    var qid = this.net9p.proto.fid2qid[fid];
    if (!qid)
        abort("No such QID found for fid=" + fid);

    var path = this.qidpath2fspath[qid.path];
    if (!path)
        abort("No such path found for QID=" + qid);

    if (mode & 0x10) {
        var net9p = this.net9p;
        net9p.fs.truncate(path, function() {
            var payload = net9p.marshal(["Q", "w"], [qid, this.IOUNIT]);
            var reply = net9p.proto.build_reply(id, tag, payload);
            net9p.send_reply(reply);
        });
        return null;
    } else {
        var payload = this.net9p.marshal(["Q", "w"], [qid, this.IOUNIT]);
        return this.build_reply(id, tag, payload);
    }
};
Protocol9P2000u.prototype[112] = Protocol9P2000u.prototype.open;

Protocol9P2000u.prototype.create = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w", "s", "w", "b", "s"], next_data);
    var fid = req[0];
    var name = req[1];
    /*
    var perm0 = req[2];
    var perm1 = req[3];
    var mode = req[4];
    var extension = req[5];
    var perm = perm0.toString(16) + ":" + perm1.toString(16);
    */
    var perm = req[2];
    var mode = req[3];
    var extension = req[4];
    display.log("[create] fid=" + fid + ", name=" + name + ", perm=" + perm.toString(16)
                + ", mode=" + mode.toString(2) + ", extension=" + extension);

    var pqid = this.net9p.proto.fid2qid[fid];
    if (!pqid)
        abort("No such QID found for fid=" + fid);

    var fullpath = [this.qidpath2fspath[pqid.path], name].join("/");

    var net9p = this.net9p;
    if (perm & 0x80000000) {  // directory
        net9p.fs.create_dir(fullpath, function(entry) {
            if (!entry.isDirectory)
                abort("file created for directory creation");

            var qid = {
                type: 0,
                version: entry.mtime.getTime(),
                path: net9p.hashCode32(entry.fullPath)
            };

            net9p.proto.fid2qid[fid] = qid;
            net9p.proto.qidpath2fspath[qid.path] = entry.fullPath;

            var payload = net9p.marshal(["Q", "w"], [qid, net9p.proto.IOUNIT]);
            var reply = net9p.proto.build_reply(id, tag, payload);
            net9p.send_reply(reply);
        });
    } else {  // file
        net9p.fs.create_file(fullpath, function(entry) {
            if (entry.isDirectory)
                abort("dir created for file creation");

            var qid = {
                type: 0x80,
                version: entry.mtime.getTime(),
                path: net9p.hashCode32(entry.fullPath)
            };

            net9p.proto.fid2qid[fid] = qid;
            net9p.proto.qidpath2fspath[qid.path] = entry.fullPath;

            var payload = net9p.marshal(["Q", "w"], [qid, net9p.proto.IOUNIT]);
            var reply = net9p.proto.build_reply(id, tag, payload);
            net9p.send_reply(reply);
        });
    }

    return null;
};
Protocol9P2000u.prototype[114] = Protocol9P2000u.prototype.create;

Protocol9P2000u.prototype.read = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w", "w", "w", "w"], next_data);
    var fid = req[0];
    var offset = req[1];
    //var offset = req[2];
    var count = req[3];
    display.log("[read] fid=" + fid + ", offset=" + offset + ", count=" + count);

    var qid = this.fid2qid[fid];
    if (!qid)
        abort("No such QID found for fid=" + fid);
    var path = this.qidpath2fspath[qid.path];
    if (!path)
        abort("No such path found for QID=" + qid);

    if (qid.type & 0x80) {  // directory
        var net9p = this.net9p;
        net9p.fs.get_dir(path, function(entry) {
            if (!entry.isDirectory)
                abort("[read] get_dir for file");

            net9p.fs.get_dir_entries(entry, function(entries) {
                // FIXME non-root
                var name = path.replace(net9p.fs.root, "");
                if (name == "")
                    name = "/";
                var atime = (new Date()).getTime();
                var mtime = entry.mtime.getTime();

                var data = net9p.proto.build_stat(".", 0, qid, atime, mtime);
                if (name == "/")
                    data = data.concat(net9p.proto.build_stat("..", 0, qid, atime, mtime));
                else
                    abort(".. for non-root directory");

                for (var i in entries) {
                    var ent = entries[i];
                    var cqid = net9p.proto.get_qid(ent.fullPath);
                    mtime = ent.mtime.getTime();
                    if (!cqid) {
                        cqid = {
                            type: (ent.isDirectory ? 0x80 : 0),
                            version: mtime,
                            path: net9p.hashCode32(ent.fullPath)
                        };
                    }
                    var stat = net9p.proto.build_stat(ent.name, ent.size, cqid, atime, mtime);
                    data = data.concat(stat);
                }

                if (offset)
                    data = data.slice(offset);

                var count = net9p.marshal(["w"], [data.length]);
                display.log("[read] count=" + data.length);
                var payload = count.concat(data);
                var reply = net9p.proto.build_reply(id, tag, payload);
                net9p.send_reply(reply);
            });
        });
    } else {  // file
        var net9p = this.net9p;
        net9p.fs.read(path, offset, count, function(data) {
            var count = net9p.marshal(["w"], [data.length]);
            display.log("[read] count=" + data.length);
            var payload = count.concat(data);
            var reply = net9p.proto.build_reply(id, tag, payload);
            net9p.send_reply(reply);
        });
    }
    return null;
};
Protocol9P2000u.prototype[116] = Protocol9P2000u.prototype.read;

Protocol9P2000u.prototype.write = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w", "w", "w", "w"], next_data);
    var fid = req[0];
    var offset = req[1];
    //var offset = req[2];
    var count = req[3];

    var qid = this.fid2qid[fid];
    if (!qid)
        abort("No such QID found for fid=" + fid);
    var path = this.qidpath2fspath[qid.path];
    if (!path)
        abort("No such path found for QID=" + qid);

    display.log("[write] fid=" + fid + ", offset=" + offset + ", count=" + count + ", path=" + path);

    var buffer = new ArrayBuffer(count);
    var data = new Uint8Array(buffer, 0, count);
    for (var i=0; i < count; i++)
        data[i] = next_data();

    var net9p = this.net9p;
    net9p.fs.write(path, offset, buffer, function(e) {
        var payload = net9p.marshal(["w"], [data.byteLength]);
        display.log("[write] count=" + data.byteLength);
        var reply = net9p.proto.build_reply(id, tag, payload);
        net9p.send_reply(reply);
    });
    return null;
};
Protocol9P2000u.prototype[118] = Protocol9P2000u.prototype.write;

Protocol9P2000u.prototype.clunk = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w"], next_data);
    var fid = req[0];
    display.log("[clunk] fid=" + fid);

    delete this.net9p.proto.fid2qid[fid];

    return this.build_reply(id, tag, []);
};
Protocol9P2000u.prototype[120] = Protocol9P2000u.prototype.clunk;

Protocol9P2000u.prototype.remove = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w"], next_data);
    var fid = req[0];

    var qid = this.fid2qid[fid];
    if (!qid)
        abort("No such QID found for fid=" + fid);
    var path = this.qidpath2fspath[qid.path];
    if (!path)
        abort("No such path found for QID=" + qid);

    display.log("[remove] fid=" + fid);

    var net9p = this.net9p;
    net9p.fs.remove(path, function() {
        // clunk fid as well
        delete net9p.proto.fid2qid[fid];

        var reply = net9p.proto.build_reply(id, tag, []);
        net9p.send_reply(reply);
    });
    return null;
};
Protocol9P2000u.prototype[122] = Protocol9P2000u.prototype.remove;

Protocol9P2000u.prototype.build_stat = function(name, filesize, qid, atime, mtime) {
    //display.log("qid.type=" + qid.type.toString(16));
    var types = [
        "h",  // size
        "h",  // type
        "w",  // dev
        "Q",  // qid
        "w",  // mode
        "w",  // atime
        "w",  // mtime
        "w",  // length0
        "w",  // length1
        "s",  // name
        "s",  // uid
        "s",  // gid
        "s",  // muid
        "s",  // extension
        "w",  // n_uid
        "w",  // n_gid
        "w"  // n_muid
        ];
    var data = [
        0,  // size
        0,  // type
        0,  // dev
        qid,  // qid
        (qid.type & 0x80) ? (0x80000000 | 0755) : 0644,  // mode
        atime,  // atime
        mtime,  // mtime
        filesize,  // length0 FIXME
        0,  // length1
        name,  // name
        "root",  // uid
        "root",  // gid
        "root",  // muid
        ".u",  // extension
        0,  // n_uid
        0,  // n_guid
        0  // n_muid
        ];
    var stat = this.net9p.marshal(types, data);

    // Fill size
    stat[0] = (stat.length - 2) & 0xff;
    stat[1] = (stat.length - 2) >>> 8;

    return stat;
};

Protocol9P2000u.prototype.build_stat_vals_from_data = function(data) {
    var types = [
        "h",  // size
        "h",  // type
        "w",  // dev
        "Q",  // qid
        "w",  // mode
        "w",  // atime
        "w",  // mtime
        "w",  // length0
        "w",  // length1
        "s",  // name
        "s",  // uid
        "s",  // gid
        "s",  // muid
        "s",  // extension
        "w",  // n_uid
        "w",  // n_gid
        "w"  // n_muid
        ];
    var stat_vals = this.net9p.unmarshal(types, data);

    return stat_vals;
};

Protocol9P2000u.prototype.stat = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w"], next_data);
    var fid = req[0];

    var qid = this.fid2qid[fid];
    if (!qid)
        abort("No such QID found for fid=" + fid);
    var path = this.qidpath2fspath[qid.path];
    if (!path)
        abort("No such path found for QID=" + qid);
    display.log("[stat] path=" + path);

    /*
    if (qid.type & 0x80) {  // directory
        // FIXME Return root directory's QID
        var net9p = this.net9p;
        net9p.fs.get_dir(path, function(entry) {
            if (!entry.isDirectory)
                abort("[stat] get_dir for file");
            var name = path.replace(net9p.fs.root, "");
            if (name == "")
                name = "/";
            var atime = (new Date()).getTime();
            var mtime = entry.mtime.getTime();
            var payload = net9p.proto.build_stat(name, 0, qid, atime, mtime);
            payload = [0, 0].concat(payload);  // Ignored by guest but required

            var reply = net9p.proto.build_reply(id, tag, payload);
            net9p.send_reply(reply);
        });
    } else {  // file
        var net9p = this.net9p;
        net9p.fs.get_file(path, function(entry) {
            if (entry.isDirectory)
                abort("[stat] get_file for directory");

            var name = path.replace(net9p.fs.root, "");
            var atime = (new Date()).getTime();
            var mtime = entry.mtime.getTime();
            var filesize = entry.size;
            var payload = net9p.proto.build_stat(name, filesize, qid, atime, mtime);
            payload = [0, 0].concat(payload);  // Ignored by guest but required

            var reply = net9p.proto.build_reply(id, tag, payload);
            net9p.send_reply(reply);
        });
    }
    */
    var net9p = this.net9p;
    net9p.fs.get(path, function(entry) {
        var name = path.replace(net9p.fs.root, "");
        var atime = (new Date()).getTime();
        var mtime = entry.mtime.getTime();
        var filesize = 0;

        if (entry.isDirectory) {
            if (name == "")
                name = "/";
        } else {
            filesize = entry.size;
        }

        var payload = net9p.proto.build_stat(name, filesize, qid, atime, mtime);
        payload = [0, 0].concat(payload);  // Ignored by guest but required

        var reply = net9p.proto.build_reply(id, tag, payload);
        net9p.send_reply(reply);
    });
    return null;
};
Protocol9P2000u.prototype[124] = Protocol9P2000u.prototype.stat;

Protocol9P2000u.prototype.wstat = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w"], next_data);
    var fid = req[0];
    next_data(); next_data();  // We need it to remove unknown halfword data
    var stat_vals = this.build_stat_vals_from_data(next_data);

    var qid = this.fid2qid[fid];
    if (!qid)
        abort("No such QID found for fid=" + fid);
    var path = this.qidpath2fspath[qid.path];
    if (!path)
        abort("No such path found for QID=" + qid);
    display.log("[wstat] path=" + path);

    var name = path.replace(this.net9p.fs.root, "");
    if (qid.type & 0x80) {  // directory
        if (name == "")
            name = "/";
    }

    if (stat_vals[9] != name) {
        var newname = stat_vals[9];
        // FIXME only support rename
        var net9p = this.net9p;
        // FIXME
        net9p.fs.get_root(function(root) {
            net9p.fs.rename(root, name, newname, function(entry) {
                var reply = net9p.proto.build_reply(id, tag, []);
                net9p.send_reply(reply);
            });
        });
        return null;
    } else {
        return net9p.proto.build_reply(id, tag, []);
    }
};
Protocol9P2000u.prototype[126] = Protocol9P2000u.prototype.wstat;

function Net9p(virtio) {
    this.virtio = virtio;

    this.proto = new Protocol9P2000u(this);
    this.fs = new FS9P();
    this.fs.initFileSystem();
}

Net9p.prototype.marshal = function(type, data) {
    var out = [];
    var item;
    for (var i=0; i < type.length; i++) {
        item = data[i];
        switch (type[i]) {
            case "w":
                out.push(item & 0xff);
                out.push((item >>> 8) & 0xff);
                out.push((item >>> 16) & 0xff);
                out.push(item >>> 24);
                break;
            case "h":
                out.push(item & 0xff);
                out.push(item >>> 8);
                break;
            case "b":
                out.push(item);
                break;
            case "s":
                // Prepend size
                out.push(item.length & 0xff);
                out.push(item.length >>> 8);
                for (var j in item)
                    out.push(item.charCodeAt(j));
                break;
            case "D":
                for (var j in item)
                    out.push(item[j]);
                break;
            case "Q":
                out = out.concat(this.marshal(["b"], item.type));
                out = out.concat(this.marshal(["w"], item.version));
                out = out.concat(this.marshal(["w"], item.path));
                out = out.concat(this.marshal(["w"], 0));  // FIXME
                break;
            default:
                abort("marshal: Unknown type=" + type[i]);
        }
    }
    return out;
};

Net9p.prototype.unmarshal = function(type, data_or_generator) {
    var out = [];
    var get = (typeof data_or_generator == "function") ?
        data_or_generator :
        function() { return data_or_generator.shift(); };
    for (var i=0; i < type.length; i++) {
        switch (type[i]) {
            case "w":
                var val = get();
                val += get() << 8;
                val += get() << 16;
                var tmp = get() << 24;
                if (tmp < 0)
                    tmp += 0x100000000;
                out.push(val + tmp);
                break;
            case "h":
                var val = get();
                out.push(val + (get() << 8));
                break;
            case "b":
                out.push(get());
                break;
            case "s":
                var len = get();
                len += get() << 8;
                var str = '';
                for (var j=0; j < len; j++)
                    str += String.fromCharCode(get());
                out.push(str);
                break;
            case "Q":
                var stat = {
                    type: 0,
                    version: 0,
                    path: 0
                };
                stat.type = this.unmarshal(["b"], get)[0];
                stat.version = this.unmarshal(["w"], get)[0];
                stat.path = this.unmarshal(["w", "w"], get)[0];  // FIXME
                out.push(stat);
                break;
            default:
                abort("unmarshal: Unknown type=" + type[i]);
        }
    }
    return out;
};

Net9p.prototype.get_header_size = function() {
    return this.proto.HEADER_SIZE;
};

Net9p.prototype.get_body_size = function(id) {
    return this.proto.HEADER_SIZE;
};

Net9p.prototype.unmarshal_header = function(data) {
    var header = this.unmarshal(["w", "b", "h"], data);
    return {
        size: header[0],
        id: header[1],
        tag: header[2]
    };
};

Net9p.prototype.send_reply = function(reply) {
    this.virtio.send_reply(reply);
};

Net9p.prototype.hashCode32 = function(string) {
    var hash = 0;
    if (string.length == 0)
        return hash;
    for (var i = 0; i < string.length; i++) {
        hash = 31 * hash + string.charCodeAt(i);
        hash = hash & hash;
        if (hash < 0)
            hash += 0x100000000;
    }
    return hash;
}
