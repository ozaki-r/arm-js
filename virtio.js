/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

function VirtioMMIO(baseaddr, irq, gic) {
    this.baseaddr = baseaddr;
    this.irq = irq;
    this.gic = gic;

    this.read = new Array();
    this.write = new Array();
    this.data = new Array();

    this.MagicValue = this.baseaddr + 0x000;
    this.Version    = this.baseaddr + 0x004;
    this.DeviceID   = this.baseaddr + 0x008;
    this.VendorID   = this.baseaddr + 0x00c;
    this.HostFeatures     = this.baseaddr + 0x010;
    this.HostFeaturesSel  = this.baseaddr + 0x014;
    this.GuestFeatures    = this.baseaddr + 0x020;
    this.GuestFeaturesSel = this.baseaddr + 0x024;
    this.GuestPageSize    = this.baseaddr + 0x028;
    this.QueueSel    = this.baseaddr + 0x030;
    this.QueueNumMax = this.baseaddr + 0x034;
    this.QueueNum    = this.baseaddr + 0x038;
    this.QueueAlign  = this.baseaddr + 0x03c;
    this.QueuePFN    = this.baseaddr + 0x040;
    this.QueueNotify     = this.baseaddr + 0x050;
    this.InterruptStatus = this.baseaddr + 0x060;
    this.InterruptACK    = this.baseaddr + 0x064;
    this.Status = this.baseaddr + 0x070;
    this.ConfigSpace = this.baseaddr + 0x100;
    
    this.read[this.MagicValue] = stringToLong("virt");
    this.read[this.Version] = 1;
    this.read[this.DeviceID] = 0x9;  // 9P
    this.read[this.VendorID] = 0xffffffff;  // ANY

    virtio = this;

    this.data[this.Status] = 0;
    this.read[this.Status] = function() {
        display.log("[r]Status: " + virtio.data[virtio.Status].toString(2));
        return virtio.data[virtio.Status];
    };
    this.write[this.Status] = function(status) {
        //throw "Status";
        display.log("[w]Status: " + status.toString(2));
        virtio.data[virtio.Status] = status;
    };

    this.data[this.HostFeatures] = 1;  // == 9P_MOUNT_TAG (See include/linux/virtio_9p.h)
    this.read[this.HostFeatures] = function() {
        display.log("[r]HostFeatures: " + virtio.data[virtio.HostFeatures].toString(2));
        return virtio.data[virtio.HostFeatures];
    };
    this.write[this.HostFeaturesSel] = function(features) {
        display.log("[w]HostFeaturesSel: " + features.toString(2));
        // Do nothing
    };

    this.data[this.GuestFeatures] = 0;
    this.write[this.GuestFeatures] = function(features) {
        display.log("[w]GuestFeatures: " + features.toString(2));
        virtio.data[virtio.GuestFeatures] = features;
    };
    this.write[this.GuestFeaturesSel] = function(features) {
        display.log("[w]GuestFeaturesSel: " + features.toString(2));
        virtio.data[virtio.GuestFeaturesSel] = features;
    };

    this.data[this.GuestPageSize] = 0;
    this.write[this.GuestPageSize] = function(size) {
        display.log("[w]GuestPageSize: " + size);
        virtio.data[virtio.GuestPageSize] = size;
    };

    this.data[this.QueueSel] = 0;
    this.write[this.QueueSel] = function(sel) {
        display.log("[w]QueueSel: " + sel.toString(16));
        virtio.data[virtio.QueueSel] = sel;
    };

    //this.data[this.QueueNumMax] = 1024;  // Same as qemu
    this.data[this.QueueNumMax] = 256;  // Minimum
    this.data[this.QueueNum] = 0;
    this.read[this.QueueNumMax] = function() {
        display.log("[r]QueueNumMax: " + virtio.data[virtio.QueueNumMax]);
        return virtio.data[virtio.QueueNumMax];
    };
    this.write[this.QueueNum] = function(num) {
        display.log("[w]QueueNum: " + num);
        virtio.data[virtio.QueueNum] = num;
    };
    this.data[this.QueueAlign] = 0;
    this.write[this.QueueAlign] = function(align) {
        display.log("[w]QueueAlign: " + align.toString(16));
        virtio.data[virtio.QueueAlign] = align;
    };

    this.data[this.QueuePFN] = 0;
    this.write[this.QueuePFN] = function(pfn) {
        display.log("[w]QueuePFN: " + pfn.toString(16));
        virtio.data[virtio.QueuePFN] = pfn;
    };
    this.read[this.QueuePFN] = function() {
        display.log("[r]QueuePFN: " + virtio.data[virtio.QueuePFN].toString(16));
        return virtio.data[virtio.QueuePFN];
    };

    this.data[this.QueueNotify] = 0;
    this.write[this.QueueNotify] = function(index) {
        display.log("[w]QueueNotify: " + index);
        virtio.data[virtio.QueueNotify] = index;
        var ready = virtio._notify_callback(index);
        if (ready) {
            virtio.data[virtio.InterruptStatus] = 1 << 0;
            gic.send_interrupt(virtio.irq);
        }
    };
    this.data[this.InterruptStatus] = 1 << 0;  // VRING
    this.read[this.InterruptStatus] = function() {
        display.log("[r]InterruptStatus: " + virtio.data[virtio.InterruptStatus].toString(2));
        return virtio.data[virtio.InterruptStatus];
    };
    this.write[this.InterruptACK] = function(ack) {
        display.log("[w]InterruptACK: " + ack.toString(2));
        if (ack != virtio.data[virtio.InterruptStatus])
            throw "InterruptACK";
    };
}

VirtioMMIO.prototype.register_tagname = function(name) {
    this.read[this.ConfigSpace + 0] = name.length & 0xff;
    this.read[this.ConfigSpace + 1] = name.length >> 8;

    for (var i=0; i < name.length; i++)
        this.read[this.ConfigSpace + 2 + i] = name.charCodeAt(i);
};

VirtioMMIO.prototype.set_notify_callback = function(cb) {
    this._notify_callback = cb;
};

VirtioMMIO.prototype.get_queue_addr = function() {
    return this.data[this.QueuePFN] * this.data[this.GuestPageSize];
};

VirtioMMIO.prototype.get_queue_num = function() {
    return this.data[this.QueueNum];
};

VirtioMMIO.prototype.get_queue_align = function() {
    return this.data[this.QueueAlign];
};

VirtioMMIO.prototype.send_interrupt = function() {
    this.data[this.InterruptStatus] = 1 << 0;
    this.gic.send_interrupt(this.irq);
};

VirtioMMIO.prototype.save = function() {
    var params = new Object();
    for (var i in this.data) {
        params[i] = this.data[i];
    }
    return params;
};

VirtioMMIO.prototype.restore = function(params) {
    for (var i in this.data) {
        this.data[i] = params[i];
    }
};

/*
 * Virtio Vring
 */
function VirtioVring(memctlr, mmio) {
    this.memctlr = memctlr;
    this.mmio = mmio;

    this.mmio.set_notify_callback(this.notify_callback.bind(this));
}

VirtioVring.prototype.get_desc = function(index) {
    var addr = this.get_desc_addr() + index * 16;
    var memctlr = this.memctlr;
    return {
        addr: memctlr.ld_word_fast(addr),
        len: memctlr.ld_word_fast(addr + 8),
        next: memctlr.ld_halfword_fast(addr + 12),
        flags: memctlr.ld_halfword_fast(addr + 14),
    };
};

VirtioVring.prototype.fill_desc = function(index, descaddr, len, next, flags) {
    var addr = this.get_desc_addr() + index * 16;
    var memctlr = this.memctlr;
    memctlr.st_word_fast(addr, descaddr);
    memctlr.st_word_fast(addr + 8, len);
    memctlr.st_halfword_fast(addr + 12, next);
    memctlr.st_halfword_fast(addr + 14, flags);
};

VirtioVring.prototype.consume_desc = function(desc_idx, desc_len) {
    var idx_addr = this.get_used_addr() + 2;
    var idx = this.memctlr.ld_halfword_fast(idx_addr);
    var used_addr = idx_addr + 2 + idx * 8;
    this.memctlr.st_word_fast(used_addr, desc_idx);
    this.memctlr.st_word_fast(used_addr + 4, desc_len);
    this.memctlr.st_halfword_fast(idx_addr, idx + 1);
    //this.dump_ring();
};

VirtioVring.prototype.notify_callback = function(index) {
    //this.dump_ring();
    return this._notify_callback(this.get_desc(index));
};

VirtioVring.prototype.set_notify_callback = function(cb) {
    this._notify_callback = cb;
};

VirtioVring.prototype.get_desc_addr = function() {
    return this.mmio.get_queue_addr();
};

VirtioVring.prototype.get_avail_addr = function() {
    return this.mmio.get_queue_addr() + this.mmio.get_queue_num() * 16;
};

VirtioVring.prototype.get_used_addr = function() {
    var num = this.mmio.get_queue_num();
    var addr = this.get_avail_addr() + 2 + 2 + 2 * num + 2;
    var align = this.mmio.get_queue_align();

    //display.log(addr.toString(16));
    // Skip padding
    if (addr & (align - 1)) {
        var mask = ~(align - 1);
        if (mask < 0)
            mask += 0x100000000;
        addr = (addr & mask) + align;
    }
    //display.log(addr.toString(16));
    return addr;
};

VirtioVring.prototype.kick = function() {
    this.mmio.send_interrupt();
};

VirtioVring.prototype.dump_ring = function() {
    var addr = this.mmio.get_queue_addr();
    var num = this.mmio.get_queue_num();
    var align = this.mmio.get_queue_align();
    var memctlr = this.memctlr;
    var i;
    var cur;
    var idx;

    cur = this.get_avail_addr();
    display.log("avail_flags: " + memctlr.ld_halfword_fast(cur).toString(2));
    cur += 2;
    var idx = memctlr.ld_halfword_fast(cur);
    display.log("avail_idx: " + idx);
    cur += 2;
    var items = [];
    for (i=0; i < idx; i++)
        items.push(memctlr.ld_halfword_fast(cur + (i * 2)).toString());
    display.log("available: " + items.join(" "));
    //display.log("available: " + memctlr.ld_halfword_fast(cur + idx * 2));
    cur += 2 * num;
    display.log("used_event_idx: " + memctlr.ld_halfword_fast(cur));

    cur = this.get_used_addr();
    display.log("used_flags: " + memctlr.ld_halfword_fast(cur).toString(2));
    cur += 2;
    idx = memctlr.ld_halfword_fast(cur);
    display.log("used_idx: " + idx);
    cur += 2;
    var items = [];
    for (i=0; i < idx; i++) {
        var id = memctlr.ld_word_fast(cur + (i * 8));
        var len = memctlr.ld_word_fast(cur + (i * 8 + 4));
        items.push("(" + id + "," + len + ")");
    }
    display.log("used_elem: " + items.join(" "));
    /*
    var id = memctlr.ld_word_fast(cur + (idx * 8));
    var len = memctlr.ld_word_fast(cur + (idx * 8 + 4));
    display.log("used: (" + id + "," + len + ")");
    */
    cur += 2 * num;
    display.log("avail_event_idx: " + memctlr.ld_halfword_fast(cur));
};


/*
 * Virtio 9P
 */
function Virtio9P(memctlr, vring) {
    this.memctlr = memctlr;
    this.vring = vring;
    this.net9p = new Net9p(this);

    this.vring.set_notify_callback(this.receive_request.bind(this));
}

Virtio9P.prototype.receive_request = function(desc) {
    var memctlr = this.memctlr;
    var addr = desc.addr;

    var bytes = [];
    var len = this.net9p.get_header_size();
    for (var i=0; i < len; i++) {
        bytes.push(memctlr.ld_byte_fast(addr + i));
    }
    var header = this.net9p.unmarshal_header(bytes);
    //display.log("size=" + header.size + ", id=" + header.id + ", tag=" + header.tag.toString(16));

    addr += len;
    var remained = desc.len - len;
    var next_data = function() {
        if (remained-- > 0)
            return memctlr.ld_byte_fast(addr++);
        else
            return null;
    };

    var reply = this.net9p.proto[header.id](header.id, header.tag, next_data);
    if (reply) {
        desc = this.vring.get_desc(1);
        if (reply.length > desc.len)
            abort("reply too long: " + reply.length + " > " + desc.len);
        addr = desc.addr;
        for (var i=0; i < reply.length; i++)
            memctlr.st_byte_fast(addr + i, reply[i]);
        this.vring.consume_desc(0, reply.length);

        // Reply data is ready. Issue interrupt
        return true;
    } else {
        return false;
    }
};

Virtio9P.prototype.send_reply = function(reply) {
    var memctlr = this.memctlr;
    var idx = 1;
    var desc = this.vring.get_desc(idx);
    var addr = desc.addr;
    var rest = desc.len;
    offset = 0;
    for (var i=0; i < reply.length; i++, offset++, rest--) {
        if (rest <= 0) {
            idx += 1;
            desc = this.vring.get_desc(idx);
            addr = desc.addr;
            rest = desc.len;
            offset = 0;
        }
        this.memctlr.st_byte_fast(addr + offset, reply[i]);
    }
    this.vring.consume_desc(0, reply.length);
    this.vring.kick();
};

