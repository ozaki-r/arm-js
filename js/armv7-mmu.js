/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
/*
 * ARMv7 MMU (VMPA)
 */
function ARMv7_MMU(cpu, memctlr) {
    this.cpu = cpu;

    this.enabled = false;
    this.baseaddr0 = 0;
    this.baseaddr1 = 0;
    this.memctlr = memctlr;
    this.asid = 0;
    this.width = 0;
    this.mask = (1 << (31 - this.width - 20 + 1)) - 1;
    this.cp15 = null;
    this.check_unaligned = false;
}

ARMv7_MMU.prototype.trans_to_phyaddr = function(vaddr, is_write) {
    if (this.enabled) {
        return this.walk_table(vaddr, is_write);
    } else {
        return vaddr;
    }
};

/*
 * Page Table Walk
 */
ARMv7_MMU.prototype.ld_word = function(addr) {
    return this.memctlr.ld_word(addr);
};

ARMv7_MMU.prototype.get_1st_ptaddr = function(vaddr) {
    var index = (vaddr >>> 20) & this.mask;
    var ptaddr;
    if (this.width) {
        var is_zero = bitops.get_bits(vaddr, 31, 32 - this.width) === 0;
        if (is_zero)
            ptaddr = bitops.set_bits(this.baseaddr0, 13 - this.width, 2, index);
        else
            ptaddr = bitops.set_bits(this.baseaddr1, 13, 2, index);
        return bitops.clear_bits(ptaddr, 1, 0);
    } else {
        return this.baseaddr0 + (index << 2);
    }
};

ARMv7_MMU.prototype.get_2nd_ptaddr = function(vaddr, table) {
    var index = (vaddr >>> 12) & 0xff;
    var tmp = table & 0xfffffc00;
    if (tmp < 0)
        tmp += 0x100000000;
    return tmp + (index << 2);
};

ARMv7_MMU.prototype.check_permission = function(vaddr, ap2, ap10, is_write, is_section) {
    if (ap2) {
        switch (ap10) {
            case 0:
                throw "Reserved";
                break;
            case 1:
                if (is_write || !this.cpu.is_priviledged())
                    throw "Permission Fault: ap2 == 1, ap10 == 1";
                break;
            case 2:
                // Deprecated
                if (is_write)
                    throw "Permission Fault: ap2 == 1, ap10 == 2";
                break;
            case 3:
                if (is_write) {
                    if (is_section)
                        this.cp15.set_memory_abort(vaddr, this.cp15.PERMISSION_FAULT_SECTION, is_write);
                    else
                        this.cp15.set_memory_abort(vaddr, this.cp15.PERMISSION_FAULT_PAGE, is_write);
                    throw "PF";
                }
                break;
            default:
                throw "Unknown ap10";
                break;
        }
    } else {
        switch (ap10) {
            case 0:
                if (is_section)
                    this.cp15.set_memory_abort(vaddr, this.cp15.PERMISSION_FAULT_SECTION, is_write);
                else
                    this.cp15.set_memory_abort(vaddr, this.cp15.PERMISSION_FAULT_PAGE, is_write);
                break;
            case 1:
                if (!this.cpu.is_priviledged())
                    throw "Permission Fault: ap2 == 0, ap10 == 1";
                break;
            case 2:
                if (is_write && !this.cpu.is_priviledged())
                    throw "Permission Fault: ap2 == 0, ap10 == 2";
                break;
            case 3:
                // Full access
                break;
            default:
                throw "Unknown ap10";
                break;
        }
    }
};

ARMv7_MMU.prototype.check_permission_table1 = function(vaddr, table, is_write) {
    var ap2 = (table >>> 15) & 1;
    var ap10 = (table >>> 10) & 3;
    this.check_permission(vaddr, ap2, ap10, is_write, true);
};

ARMv7_MMU.prototype.check_permission_table2 = function(vaddr, table, is_write) {
    var ap2 = (table >>> 9) & 1;
    var ap10 = (table >>> 4) & 3;
    this.check_permission(vaddr, ap2, ap10, is_write, false);
};

ARMv7_MMU.prototype.need_perm_check = function(table, is_supersection) {
    var domain;
    if (is_supersection)
        domain = this.cp15.domains[0];
    else
        domain = this.cp15.domains[(table >>> 5) & 0xf];
    switch (domain) {
        case 0:
            throw "Domain Fault";
            break;
        case 1:
            return true;
            break;
        case 2:
            throw "Domain Reserved";
            break;
        case 3:
            return false;
            break;
        default:
            throw "Unknown Domain";
            break;
    }
    throw "Unknown Domain";
};

ARMv7_MMU.prototype.walk_table = function(vaddr, is_write) {
    var paddr;

    var ptaddr1 = this.get_1st_ptaddr(vaddr);
    /*
     * First-level descriptors
     */
    var table1 = this.ld_word(ptaddr1);

    var format = table1 & 3;
    switch (format) {
        case 0:
            //throw "Translation fault (1st 0): " + vaddr.toString(16);
            this.cp15.set_memory_abort(vaddr, this.cp15.TRANS_FAULT_SECTION);
            throw "PF";
            break;
        case 1:
            // Small Pages or Large Pages. See the below.
            break;
        case 2:
            var is_supersection = (table1 >>> 18) & 1;
            if (is_supersection) {
                // Supersection
                if (this.need_perm_check(table1, true))
                    this.check_permission(vaddr, table1, is_write);
                throw "Supersection";
            } else {
                // Section
                if (this.need_perm_check(table1))
                    this.check_permission_table1(vaddr, table1, is_write);
                var tmp = table1 & 0xfff00000;
                if (tmp < 0)
                    tmp += 0x100000000;
                paddr = tmp + (vaddr & 0x000fffff);
            }
            return paddr;
        case 3:
            throw "Translation fault (1st 3): " + vaddr.toString(16);
            break;
        default:
            throw "Unknown format: " + format.toString();
            break;
    }
    /*
     * Second-level descriptors
     */
    var ptaddr2 = this.get_2nd_ptaddr(vaddr, table1);
    var table2 = this.ld_word(ptaddr2);

    if (this.need_perm_check(table1)) // table1 is correct
        this.check_permission_table2(vaddr, table2, is_write);
    var format2 = table2 & 3;
    switch (format2) {
        case 0:
            this.cp15.set_memory_abort(vaddr, this.cp15.TRANS_FAULT_PAGE);
            throw "PF";
            break;
        case 1:
            throw "Large page: " + vaddr.toString(16);
            break;
        case 2:
        case 3:
            // See the below;
            break;
        default:
            throw "Unknown format: " + format2.toString();
            break;
    }
    var tmp2 = table2 & 0xfffff000;
    if (tmp2 < 0)
        tmp2 += 0x100000000;
    paddr = tmp2 + (vaddr & 0x00000fff);
    return paddr;
};

ARMv7_MMU.prototype.dump_table = function(table, ptaddr) {
    display.log(ptaddr.toString(16) + " PT=" + toStringHex32(table) + "(" + toStringBinInst(table) + ")");
};

function toStringPageTable(table, addr) {
    if (table)
        return toStringHex32(table) + "@" + toStringHex32(addr);
    else
        return "null@" + toStringHex32(addr);
}

ARMv7_MMU.prototype.show_table = function(vaddr) {
    var paddr;
    var str = "";
    str += vaddr.toString(16);
    var ptaddr = this.get_1st_ptaddr(vaddr);
    /*
     * First-level descriptor
     */
    var table = this.ld_word(ptaddr);
    str += " => " + toStringPageTable(table, ptaddr);

    var format = bitops.get_bits(table, 1, 0);
    switch (format) {
        case 0:
            str += "(Invalid)";
            return str;
        case 1:
            // See the below;
            break;
        case 2:
            is_supersection = bitops.get_bit(table, 18);
            if (is_supersection) {
                str += "(Supersection)";
                return str;
            } else {
                str += "(Section)";
                paddr = bitops.copy_bits(table, 19, 0, vaddr);
            }
            str += " => " + paddr.toString(16);
            return str;
        case 3:
            str += "(Reserved)";
            return str;
        default:
            return null;
    }
    /*
     * Second-level descriptor
     */
    ptaddr = this.get_2nd_ptaddr(vaddr, table);
    table = this.ld_word(ptaddr);
    str += " => " + toStringPageTable(table, ptaddr);

    if (!table)
        return str;

    var format2 = bitops.get_bits(table, 1, 0);
    switch (format2) {
        case 0:
            str += "(Invalid)";
            return str;
        case 1:
            str += "(LargePage)";
            return str;
        case 2:
        case 3:
            // See the below;
            break;
        default:
            return null;
    }
    paddr = bitops.copy_bits(table, 11, 0, vaddr);
    str += " => " + paddr.toString(16);
    return str;
};

ARMv7_MMU.prototype.show_current_tables = function() {
    var size;
    switch (this.width) {
        case 0:
            size = 16*1024;
            break;
        case 1:
            size = 8*1024;
            break;
        case 2:
            size = 4*1024;
            break;
        case 3:
            size = 2*1024;
            break;
        case 4:
            size = 1024;
            break;
        case 5:
            size = 512;
            break;
        case 6:
            size = 256;
            break;
        case 7:
            size = 128;
            break;
        default:
            throw "Uknown width: " + this.width.toString();
            break;
    }
    var str = "";
    var addr;
    for (addr=0xc0000000; addr < 0xc1000000; addr += 0x10000)
        str += this.show_table(addr) + "\n";
    for (addr=0xf8000000; addr < 0xf8100000; addr += 0x10000)
        str += this.show_table(addr) + "\n";
    for (addr=0xf8e00000; addr < 0xf8f00000; addr += 0x10000)
        str += this.show_table(addr) + "\n";
    display.log(str);
};

ARMv7_MMU.prototype.save = function() {
    var params = Object();
    params.baseaddr0 = this.baseaddr0;
    params.baseaddr1 = this.baseaddr1;
    params.width = this.width;
    return params;
};

ARMv7_MMU.prototype.restore = function(params) {
    this.baseaddr0 = params.baseaddr0;
    this.baseaddr1 = params.baseaddr1;
    this.width = params.width;
    this.mask = (1 << (31 - this.width - 20 + 1)) - 1;
};

ARMv7_MMU.prototype.dump = function() {
    var msg = "";
    msg += "baseaddr0: " + toStringHex32(this.baseaddr0) + "\n";
    msg += "baseaddr1: " + toStringHex32(this.baseaddr1) + "\n";
    msg += "width: " + this.width + "\n";
    display.log(msg);
};

ARMv7_MMU.prototype.dump_phymem = function(addr) {
    for (var i=0; i < 100; i++) {
        var cur = addr + i*4;
        var val = this.ld_word(cur);
        if (val !== undefined && val !== null)
            display.log(toStringHex32(cur) + ": " + toStringHex32(val) + "\t" + toStringAscii(val));
        else
            display.log(toStringHex32(cur) + ": (null)");
    }
};

ARMv7_MMU.prototype.dump_virmem = function(addr) {
    for (var i=0; i < 100; i++) {
        var cur = addr + i*4;
        var phyaddr = this.trans_to_phyaddr(cur);
        var val = this.ld_word(phyaddr);
        if (val !== undefined && val !== null)
            display.log(toStringHex32(phyaddr) + ": " + toStringHex32(val) + "\t" + toStringAscii(val));
        else
            display.log(toStringHex32(phyaddr) + ": (null)");
    }
};
