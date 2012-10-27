/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

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
    this.path2qid = {};
}

Protocol9P2000u.prototype.hashCode32 = function(string) {
    var hash = 0;
    if (string.length === 0)
        return hash;
    for (var i=0; i < string.length; i++) {
        hash = 31 * hash + string.charCodeAt(i);
        hash = hash & hash;
        if (hash < 0)
            hash += 0x100000000;
    }
    return hash;
};

Protocol9P2000u.prototype.add_qid = function(fid, qid) {
    //display.log("Adding fid=" + fid + ", name=" + qid.name + ", fullPath=" + qid.entry.fullPath);
    this.fid2qid[fid] = qid;
    this.path2qid[qid.fullPath] = qid;
};

Protocol9P2000u.prototype.del_qid = function(fid) {
    var qid = this.fid2qid[fid];
    delete this.fid2qid[fid];
    delete this.path2qid[qid.fullPath];
};

Protocol9P2000u.prototype.get_qid = function(fid_or_path) {
    if (typeof fid_or_path == "number")
        return this.fid2qid[fid_or_path];
    else if (typeof fid_or_path == "string")
        return this.path2qid[fid_or_path];
    else
        abort("get_qid: unknown key type: " + (typeof fid_or_path));
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
    var afid = req[1];  // For auth. Ignored.
    var uname = req[2];  // Username. Ignored.
    var aname = req[3];  // Mount point. Ignored.
    var n_uname = req[4];
    display.log("[attach] fid=" + fid + ", afid=" + afid + ", uname=" + uname
                + ", aname=" + aname + ", n_uname=" + n_uname);

    // Return root directory's QID
    var net9p = this.net9p;
    var that = this;
    net9p.fs.getRoot(function(entry) {
        var qid = {
            type: 0x10 | 0x80,  // mount point & directory
            version: entry.mtime.getTime(),
            path: that.hashCode32(entry.fullPath),
            name: "/",
            entry: entry,  // It includes fullPath and mtime
            atime: getCurrentTime(),  // Need to update
            parent: null  // See below
        };
        qid.parent = qid;  // To avoid checking null
        display.log("[attach] fullPath=" + entry.fullPath);

        that.add_qid(fid, qid);

        var payload = net9p.marshal(["Q"], [qid]);
        var reply = that.build_reply(id, tag, payload);
        net9p.send_reply(reply);
    });
    return null;
};
Protocol9P2000u.prototype[104] = Protocol9P2000u.prototype.attach;

Protocol9P2000u.prototype.walk = function(id, tag, next_data) {
    // path elements ["root", "dir1", "dir2",...]
    var req = this.net9p.unmarshal(["w", "w", "h"], next_data);
    var fid = req[0];
    var nwfid = req[1];
    var nwname = req[2];
    display.log("[walk] fid=" + fid + ", nwfid=" + nwfid + ", nwname=" + nwname);

    var qid = this.get_qid(fid);
    if (!qid)
        abort("No such QID found for fid=" + fid);

    if (nwname === 0) {
        this.add_qid(nwfid, qid);

        var payload = this.net9p.marshal(["h"], [0]);
        return this.build_reply(id, tag, payload);
    }

    var wnames = [];
    for (var i=0; i < nwname; i++) {
        wnames.push(this.net9p.unmarshal(["s"], next_data));
    }
    display.log("[walk] wnames=[" + wnames.toString() + "]");

    display.log("[walk] path=" + qid.entry.fullPath);

    ret_qids = [];
    var net9p = this.net9p;
    var that = this;
    var walk = function(pqid, names) {
        var name = names[0];

        if (name) {
            display.log("[walk] walking: " + name);
            net9p.fs.getEntry(pqid.entry, name, function(entry) {
                var _qid = {
                    type: (entry.isDirectory ? 0x80 : 0),
                    version: entry.mtime.getTime(),
                    path: that.hashCode32(entry.fullPath),
                    name: entry.name,
                    entry: entry,
                    atime: (entry.isDirectory ? getCurrentTime() : entry.mtime.getTime()),
                    parent: pqid
                };

                ret_qids.push(_qid);

                walk(_qid, names.slice(1));
            }, function(e) {
                if (names == wnames) {
                    // FIXME: have to check error code
                    var payload = net9p.marshal(["s", "w"], ["No such file or directory", 2]);
                    var reply = that.build_reply(that.TERROR, tag, payload);
                } else {
                    // Return walked QIDs
                    var types = ["h"];
                    var data = [ret_qids.length];
                    for (var i in ret_qids) {
                        types.push("Q");
                        types.push(ret_qids[i]);
                    }
                    var payload = net9p.marshal(types, data);
                    var reply = that.build_reply(id, tag, payload);
                }
                net9p.send_reply(reply);
            });
        } else {
            // Walked sucessfully
            that.add_qid(nwfid, ret_qids[ret_qids.length - 1]);

            // Return walked QIDs
            var types = ["h"];
            var data = [ret_qids.length];
            for (var i in ret_qids) {
                types.push("Q");
                data.push(ret_qids[i]);
            }
            var payload = net9p.marshal(types, data);
            var reply = that.build_reply(id, tag, payload);
            net9p.send_reply(reply);
        }
    };

    walk(qid, wnames);

    return null;
};
Protocol9P2000u.prototype[110] = Protocol9P2000u.prototype.walk;

Protocol9P2000u.prototype.open = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w", "b"], next_data);
    var fid = req[0];
    var mode = req[1];
    display.log("[open] fid=" + fid + ", mode=" + mode.toString(16));

    var qid = this.get_qid(fid);
    if (!qid)
        abort("[open] No such QID found for fid=" + fid);

    if (mode & 0x10) {
        var net9p = this.net9p;
        var that = this;
        net9p.fs.truncate(qid.entry, function(entry) {
            // Update
            qid.entry = entry;
            qid.version = entry.mtime.getTime();
            qid.atime = getCurrentTime();

            var payload = net9p.marshal(["Q", "w"], [qid, this.IOUNIT]);
            var reply = that.build_reply(id, tag, payload);
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
    var perm = req[2];
    var mode = req[3];
    var extension = req[4];
    display.log("[create] fid=" + fid + ", name=" + name + ", perm=" + perm.toString(16)
                + ", mode=" + mode.toString(2) + ", extension=" + extension);

    var qid = this.get_qid(fid);
    if (!qid)
        abort("[create] No such QID found for fid=" + fid);

    var net9p = this.net9p;
    var that = this;
    var isfile = perm & 0x80000000 ? false : true;
    net9p.fs.create(qid.entry, name, {file: isfile}, function(entry) {
        display.log("[create] fullPath=" + entry.fullPath);

        var cqid = {
            type: isfile ? 0 : 0x80,
            version: entry.mtime.getTime(),
            path: that.hashCode32(entry.fullPath),
            name: entry.name,
            entry: entry,
            atime: isfile ? entry.mtime.getTime() : getCurrentTime(),
            parent: qid
        };
        that.add_qid(fid, cqid);
        qid.parent.atime = getCurrentTime();  // FIXME: different from entry.mtime

        var payload = net9p.marshal(["Q", "w"], [cqid, that.IOUNIT]);
        var reply = that.build_reply(id, tag, payload);
        net9p.send_reply(reply);
    });

    return null;
};
Protocol9P2000u.prototype[114] = Protocol9P2000u.prototype.create;

Protocol9P2000u.prototype.read_directory = function(qid, offset, entries) {
    var atime = qid.atime;
    var mtime = qid.entry.mtime.getTime();
    var data = this.build_stat(".", 0, qid, atime, mtime);

    atime = qid.parent.atime;
    mtime = qid.parent.entry.mtime.getTime();
    data = data.concat(this.build_stat("..", 0, qid.parent, atime, mtime));

    for (var i in entries) {
        var ent = entries[i];
        display.log("[read] name=" + ent.name);
        var cqid = this.get_qid(ent.fullPath);
        mtime = ent.mtime.getTime();
        if (!cqid) {
            cqid = {
                type: (ent.isDirectory ? 0x80 : 0),
                version: mtime,
                path: this.hashCode32(ent.fullPath)
            };
        }
        var stat = this.build_stat(ent.name, ent.size, cqid, atime, mtime);
        data = data.concat(stat);
    }

    if (offset)
        data = data.slice(offset);

    var count = this.net9p.marshal(["w"], [data.length]);
    display.log("[read] count=" + data.length);
    return count.concat(data);
};

Protocol9P2000u.prototype.read = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w", "w", "w", "w"], next_data);
    var fid = req[0];
    var offset = req[1];
    //var offset = req[2];  // FIXME
    var count = req[3];
    display.log("[read] fid=" + fid + ", offset=" + offset + ", count=" + count);

    var qid = this.get_qid(fid);
    if (!qid)
        abort("[read] No such QID found for fid=" + fid);

    var net9p = this.net9p;
    var that = this;
    if (qid.type & 0x80) {  // directory
        display.log("[read] reading directory: " + qid.entry.fullPath);
        net9p.fs.getDirectoryEntries(qid.entry, function(entries) {
            qid.atime = getCurrentTime();

            var payload = that.read_directory(qid, offset, entries);
            var reply = that.build_reply(id, tag, payload);
            net9p.send_reply(reply);
        });
    } else {  // file
        net9p.fs.read(qid.entry, offset, count, function(data) {
            qid.atime = getCurrentTime();

            var count = net9p.marshal(["w"], [data.length]);
            display.log("[read] count=" + data.length);
            var payload = count.concat(data);
            var reply = that.build_reply(id, tag, payload);
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

    var qid = this.get_qid(fid);
    if (!qid)
        abort("[write] No such QID found for fid=" + fid);

    display.log("[write] fid=" + fid + ", offset=" + offset
                + ", count=" + count + ", fullPath=" + qid.entry.path);

    var buffer = new ArrayBuffer(count);
    var data = new Uint8Array(buffer, 0, count);
    for (var i=0; i < count; i++)
        data[i] = next_data();

    var net9p = this.net9p;
    var that = this;
    net9p.fs.write(qid.entry, buffer, offset, function(entry) {
        qid.entry = entry;
        qid.atime = getCurrentTime();

        var payload = net9p.marshal(["w"], [data.byteLength]);
        display.log("[write] count=" + data.byteLength);
        var reply = that.build_reply(id, tag, payload);
        net9p.send_reply(reply);
    });
    return null;
};
Protocol9P2000u.prototype[118] = Protocol9P2000u.prototype.write;

Protocol9P2000u.prototype.clunk = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w"], next_data);
    var fid = req[0];
    display.log("[clunk] fid=" + fid);

    this.del_qid(fid);

    return this.build_reply(id, tag, []);
};
Protocol9P2000u.prototype[120] = Protocol9P2000u.prototype.clunk;

Protocol9P2000u.prototype.remove = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w"], next_data);
    var fid = req[0];

    var qid = this.get_qid(fid);
    if (!qid)
        abort("[remove] No such QID found for fid=" + fid);

    display.log("[remove] fid=" + fid);

    var net9p = this.net9p;
    var that = this;
    net9p.fs.remove(qid.entry, function() {
        // clunk fid as well
        that.del_qid(fid);
        qid.parent.atime = getCurrentTime();  // FIXME: different from entry.mtime

        var reply = that.build_reply(id, tag, []);
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

    var qid = this.get_qid(fid);
    if (!qid)
        abort("[stat] No such QID found for fid=" + fid);

    display.log("[stat] path=" + qid.entry.fullPath);
    var filesize = qid.entry.isDirectory ? 0 : qid.entry.size;
    var payload = this.build_stat(qid.name, filesize, qid, qid.atime, qid.entry.mtime.getTime());
    payload = [0, 0].concat(payload);  // Ignored by guest but required

    var reply = this.build_reply(id, tag, payload);
    return reply;
};
Protocol9P2000u.prototype[124] = Protocol9P2000u.prototype.stat;

Protocol9P2000u.prototype.wstat = function(id, tag, next_data) {
    var req = this.net9p.unmarshal(["w"], next_data);
    var fid = req[0];
    next_data(); next_data();  // We need it to remove unknown halfword data
    var stat_vals = this.build_stat_vals_from_data(next_data);

    var qid = this.get_qid(fid);
    if (!qid)
        abort("[wstat] No such QID found for fid=" + fid);

    display.log("[wstat] path=" + qid.entry.fullPath);

    qid.atime = qid.parent.atime = getCurrentTime();
    if (stat_vals[9] && stat_vals[9] != qid.name) {
        var newname = stat_vals[9];
        // FIXME: support only rename
        display.log("[wstat] newname=" + newname + ", name=" + name);

        var net9p = this.net9p;
        var that = this;
        display.log("[wstat] parent=" + qid.parent.entry.fullPath);
        net9p.fs.rename(qid.parent.entry, qid.name, newname, function(entry) {
            var reply = that.build_reply(id, tag, []);
            net9p.send_reply(reply);
        });

        return null;
    } else {
        return this.build_reply(id, tag, []);
    }
};
Protocol9P2000u.prototype[126] = Protocol9P2000u.prototype.wstat;

function Net9p(virtio) {
    this.virtio = virtio;

    this.proto = new Protocol9P2000u(this);
    this.fs = new HTML5FileSystem('/9proot', 50 * 1024 * 1024);
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
