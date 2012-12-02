/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
function Tracer(target, options) {
    this.target = target;
    this.options = options;

    this.reset();
}

Tracer.prototype.reset = function() {
    this.name_logs = new Array();
    this.inst_logs = new Array();
    this.counter = new Array();
    this.inst_dup_hash = new Array();
    this.inst_dup_list = new Array();
    this.total = 0;
    this.hit = 0;
};

Tracer.prototype.log = function(name, inst) {
    if (!this.options.enable_tracer)
        return;
    if (!this.options.tracer_buffering) {
        this.target.log(name);
        return;
    }
    this.total += 1;
    var ihash = this.inst_dup_hash;
    if (ihash[inst]) {
        this.hit += 1;
        return;
    }
    ihash[inst] = true;

    var ilist = this.inst_dup_list;
    ilist.push(inst);
    while (ilist.length > this.options.check_size) {
        var old = ilist.shift();
        ihash[old] = false;
    }
    var ilogs = this.inst_logs;
    ilogs.push(inst);
    this.name_logs.push(name);
    this.counter.push(this.total);
    while (ilogs.length > this.options.trace_size) {
        ilogs.shift();
        this.name_logs.shift();
        this.counter.shift();
    }
};

Tracer.prototype.dump = function() {
    //if (!this.options.enable_tracer)
    //    return;
    var output = 0;
    var msgs = "";
    for (var i=0; i < this.inst_logs.length; i++) {
        var name = this.name_logs[i];
        var inst = this.inst_logs[i];
        var n = this.counter[i];
        if (name && inst) {
            msgs += "(" + n.toString() + ")" + "\t" + name + "\n";
            output += 1;
        }
        if (i > 0 && (i % 100) === 0) {
            if (msgs)
                this.target.log(msgs);
            msgs = "";
        }
    }
    if (msgs)
        this.target.log(msgs);
    this.target.log("Tracer: output=" + output + ", hit=" + this.hit + ", total=" + this.total);
};

function BranchTracer(target, options) {
    this.target = target;
    this.options = options;

    this.reset();
}

BranchTracer.prototype.reset = function() {
    this.addr_logs = new Array();
    this.from_addr_logs = new Array();
    this.counter = new Array();
    this.dup_counter = new Array();
    this.depth_logs = new Array();
    this.total = 0;
    this.last_symbol = "";
    this.last_from_addr = 0;
    this.omitted_counter = 0;
};

BranchTracer.prototype.log = function(addr, from_addr, depth) {
    if (!this.options.enable_branch_tracer)
        return;
    this.total += 1;
    if (!Symbols[addr])
        return;
    if (from_addr == this.last_from_addr && Symbols[addr] == this.last_symbol) {
        this.omitted_counter += 1;
        return;
    }
    this.last_symbol = Symbols[addr];
    this.last_from_addr = from_addr;
    var alogs = this.addr_logs;
    alogs.push(addr);
    this.from_addr_logs.push(from_addr);
    this.dup_counter.push(this.omitted_counter);
    this.counter.push(this.total);
    this.depth_logs.push(depth);
    while (alogs.length > this.options.branch_trace_size) {
        alogs.shift();
        this.from_addr_logs.shift();
        this.dup_counter.shift();
        this.counter.shift();
        this.depth_logs.shift();
    }
    this.omitted_counter = 0;
};

BranchTracer.prototype.dump = function() {
    //if (!this.options.enable_branch_tracer)
    //    return;
    var output = 0;
    // XXX: have to displace by one
    this.dup_counter.push(this.omitted_counter);
    var msgs = "";
    for (var i=0; i < this.addr_logs.length; i++) {
        var addr = this.addr_logs[i];
        var from_addr = this.from_addr_logs[i];
        var n = this.counter[i];
        var d = this.dup_counter[i];
        var depth = this.depth_logs[i];
        if (addr && n) {
            // FIXME
            depth = depth % 20;
            var indent = new Array(depth + 1).join(" ");
            if (d)
                msgs += "(" + n.toString() + ")" + "\t" + toStringHex32(from_addr) + " =>\t" + toStringHex32(addr) + "\t" + indent + Symbols[addr] + " (" + d + ")\n";
            else
                msgs += "(" + n.toString() + ")" + "\t" + toStringHex32(from_addr) + " =>\t" + toStringHex32(addr) + "\t" + indent + Symbols[addr] + "\n";
            output += 1;
        }
        if (i > 0 && (i % 100) === 0) {
            if (msgs)
                this.target.log(msgs);
            msgs = "";
        }
    }
    if (msgs)
        this.target.log(msgs);
    this.target.log("BranchTracer: output=" + output + ", total=" + this.total);
    // XXX: have to remove last one
    this.dup_counter.pop();
};

