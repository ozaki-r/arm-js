/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
function assert(cond, val) {
    if (!cond) {
        if (typeof val == "string")
            throw "Assertion failed: " + val;
        if (val)
            throw "Assertion failed: " + val.toString(16) + "(" + val.toString(2) + ")";
        else
            throw "Assertion failed."
    }
}

function assert2(x, y, str) {
    if (x != y) {
        var msg = "";
        if (str == undefined)
            throw "Assertion failed: " + toStringNum(x) + " != " + toStringNum(y);
        else
            throw "Assertion failed(" + str + "): " + toStringNum(x) + " != " + toStringNum(y);
    }
}

function BitOps() {
}

BitOps.prototype.xor = function(x, y) {
    var ret = x ^ y;
    if (ret >= 0)
        return ret;
    else
        return ret + 0x100000000;
};

BitOps.prototype.xor64 = function(x, y) {
    var xh = Math.floor(x / 0x100000000);
    var yh = Math.floor(y / 0x100000000);
    var xl = x % 0x100000000;
    var yl = y % 0x100000000;
    return this.xor(xh, yh) * 0x100000000 + this.xor(xl, yl);
};

BitOps.prototype.and = function(x, y) {
    var ret = x & y;
    if (ret >= 0)
        return ret;
    else
        return ret + 0x100000000;
};

BitOps.prototype.and64 = function(x, y) {
    var xh = Math.floor(x / 0x100000000);
    var yh = Math.floor(y / 0x100000000);
    var xl = x % 0x100000000;
    var yl = y % 0x100000000;
    return this.and(xh, yh) * 0x100000000 + this.and(xl, yl);
};

BitOps.prototype.or = function(x, y) {
    var ret = x | y;
    if (ret >= 0)
        return ret;
    else
        return ret + 0x100000000;
};

BitOps.prototype.or64 = function(x, y) {
    var xh = Math.floor(x / 0x100000000);
    var yh = Math.floor(y / 0x100000000);
    var xl = x % 0x100000000;
    var yl = y % 0x100000000;
    return this.or(xh, yh) * 0x100000000 + this.or(xl, yl);
};

BitOps.prototype.not = function(x) {
    var ret = ~x;
    if (ret >= 0)
        return ret;
    else
        return ret + 0x100000000;
};

BitOps.prototype.lowest_set_bit = function(val, len) {
    var pos = 0;
    for (var i=0; i < len; i++) {
        if (val & 1 << i)
            return i;
    }
    return len;
};

BitOps.prototype.bit_count = function(val, len) {
    var count = 0;
    for (var i=0; i < len; i++) {
        if (val & 1 << i)
            count++;
    }
    return count;
};

BitOps.prototype.clear_bit = function(uint, pos) {
    if (uint < 0x80000000 && pos < 31)
        return uint & ~(1 << pos);
    if (pos < 31) {
        var ret = uint & ~(1 << pos);
        if (ret < 0)
            ret += 0x100000000;
        return ret;
    } else {
        if (uint >= 0x80000000)
            return uint - 0x80000000;
        else
            return uint;
    }
    /*
    var uints = toStringBin32(uint);
    var ret = "";
    for (var i=0; i < 32; i++) {
        if ((32-i-1) == pos)
            ret += "0";
        else
            ret += uints[i];
    }
    return parseInt(ret, 2);
    */
};

BitOps.prototype.clear_bits = function(uint, start, end) {
    if (uint < 0x80000000 && start < 31)
        return uint & ~(((1 << (start+1)) - 1) & ~((1 << end) - 1));
    if (start < 31) {
        var ret = uint & ~(((1 << (start+1)) - 1) & ~((1 << end) - 1));
        if (ret < 0)
            ret += 0x100000000;
        return ret;
    }
    var uints = toStringBin32(uint);
    var ret = "";
    for (var i=0; i < 32; i++) {
        if ((32-i-1) <= start && (32-i-1) >= end)
            ret += "0";
        else
            ret += uints[i];
    }
    return parseInt(ret, 2);
};

BitOps.prototype.set_bits = function(uint, start, end, val) {
    return this.or(this.clear_bits(uint, start, end), this.lsl(val, end));
};

BitOps.prototype.set_bit = function(uint, pos, val) {
    if (val)
        if (pos == 31)
            return this.or(uint, 0x80000000);
        else
            return this.or(uint, val << pos);
    else
        if (pos == 31)
            return this.clear_bit(uint, 31);
        else
            return this.and(uint, this.not(1 << pos));
};

BitOps.prototype.get_bit = function(uint, pos, dummy) {
    //assert(dummy === undefined, "get_bit: extra 3rd argument");
    return (uint & (1 << pos)) >>> pos;
};

BitOps.prototype.get_bit64 = function(ulong, pos, dummy) {
    //assert(dummy === undefined, "get_bit64: extra 3rd argument");
    if (pos > 31) {
        var ulong_h = Math.floor(ulong / 0x100000000);
        return this.get_bit(ulong_h, pos - 31);
    } else {
        var ulong_l = ulong % 0x100000000;
        return this.get_bit(ulong_l, pos);
    }
};

BitOps.prototype.zero_extend = function(val, n) {
    return val;
};

BitOps.prototype.zero_extend64 = function(val, n) {
    return val;
};

BitOps.prototype.get_bits = function(uint, start, end) {
    //assert(end != undefined, "get_bits: missing 3rd argument");
    if (start == 31) {
        if (end !== 0)
            return uint >>> end;
        if (uint > 0xffffffff)
            this.and(uint, 0xffffffff);
        else
            return uint;
    }
    //return this.and(uint >>> end, ((1 << (start - end + 1)) - 1));
    var ret = (uint >>> end) & ((1 << (start - end + 1)) - 1);
    if (ret >= 0x100000000)
        return ret - 0x100000000;
    else
        return ret;
};

BitOps.prototype.get_bits64 = function(ulong, start, end) {
    assert(end != undefined, "get_bits64: missing 3rd argument");
    assert(start != end, "get_bits64: start == end");
    //assert(start < 32 && end < 32, "get_bits64: too high range");
    if (ulong < 0x80000000 && start < 31 && end < 31)
        this.get_bits(ulong, start, end);
    var ulong_h = Math.floor(ulong / 0x100000000);
    var ulong_l = ulong % 0x100000000;
    var ret = 0;
    if (start > 31) {
        if (start == 32) {
            ret += this.get_bit(ulong_h, 0) << (31 - end + 1);
        } else {
            if (end > 31)
                ret += this.get_bits(ulong_h, start-32, end-32);
            else
                ret += this.get_bits(ulong_h, start-31, 0) << (31 - end + 1);
        }
    }
    if (end <= 31) {
        if (end == 31)
            ret += this.get_bit(ulong_l, 31);
        else
            ret += this.get_bits(ulong_l, start < 31 ? start : 31, end);
    }
    return ret;
};

BitOps.prototype.sign_extend = function(x, x_len, n) {
    assert(n !== undefined);
    var sign = this.get_bit(x, x_len - 1);
    if (sign) {
        /*
        var extend = "";
        for (var i=0; i < (n-x_len); i++)
            extend += "1";
        var str = extend + toStringBin(x, x_len);
        return parseInt32(str, 2);
        */
        if (n == 32)
            var tmp = 0xffffffff;
        else
            var tmp = (1<<n)-1;
        //return x | (tmp & ~((1 << x_len)-1));
        var ret = x | (tmp & ~((1 << x_len)-1));
        if (ret < 0)
            return ret + 0x100000000;
        else
            return ret;
    } else
        return x;
};

BitOps.prototype.lsl = function(x, n) {
    var ret = x << n;
    if (ret >= 0 && ret >= x) {
        return ret;
    } else {
        return x * Math.pow(2, n);
    }
};

BitOps.prototype.lsr = function(x, n) {
    return (n == 32) ? 0 : x >>> n;
};

BitOps.prototype.asr = function(x, n) {
    if (n == 32)
        return 0;
    var ret = x >> n;
    if (ret < 0)
        ret += 0x100000000;
    return ret;
};

BitOps.prototype.sint32 = function(x) {
    return x & 0xffffffff;
};

BitOps.prototype.uint32 = function(x) {
    return this.and64(x, 0xffffffff);
};

BitOps.prototype.toUint32 = function(x) {
    if (x < 0) {
        if (x < (1 << 31)) {
            //throw "toUint32: too small";
            x = x + 0x10000000000000000;
        } else {
            x = x + 0x100000000;
        }
    }
    return this.and64(x, 0xffffffff);
};

BitOps.prototype.copy_bits = function(dest, start, end, src) {
    return this.set_bits(dest, start, end, this.get_bits(src, start, end));
};

BitOps.prototype.copy_bit = function(dest, pos, src) {
    return this.set_bit(dest, pos, this.get_bit(src, pos));
};

BitOps.prototype.ror = function(value, amount) {
    var m = amount % 32;
    //var lo = this.get_bits(value, m-1, 0);
    //var result = this.or(value >>> m, this.lsl(lo, (32-m)));
    var lo = value & ((1 << m) - 1);
    var result = (value >>> m) + this.lsl(lo, (32-m));
    //assert(result >= 0 && result <= 0xffffffff, "ror");
    return result;
};

BitOps.prototype.count_leading_zero_bits = function(val) {
    var n = 0;
    for (var i=31; i >= 0; i--) {
        if (bitops.get_bit(val, i))
            break;
        n++;
    }
    return n;
};

BitOps.prototype.test = function() {
    assert2(this.clear_bit(0xffffffff, 0), 0xfffffffe);
    assert2(this.clear_bit(0x13, 31), 0x13);
    assert2(this.clear_bit(0x13, 0), 0x12);

    assert2(this.clear_bits(0xffffffff, 31, 0), 0);
    assert2(this.clear_bits(0xffffffff, 31, 16), 0x0000ffff);
    assert2(this.clear_bits(0xffffffff, 15, 0), 0xffff0000);
    assert2(this.clear_bits(0xffffffff, 15, 12), 0xffff0fff);
    assert2(this.clear_bits(0x0fffffff, 15, 12), 0x0fff0fff);

    var tmp = 0;
    assert(this.xor(0xffffffff, 0xffffffff) == 0);
    assert(this.xor(0x11111111, 0x22222222) == 0x33333333);
    assert(this.xor(0xf0000000, 0xf0000000) == 0);

    assert(this.xor64(0xffffffff, 0xffffffff) == 0);
    assert(this.xor64(0x11111111, 0x22222222) == 0x33333333);
    assert(this.xor64(0xf0000000, 0xf0000000) == 0);
    assert(this.xor64(0x1f0000000, 0xf0000000) == 0x100000000);

    assert(this.not(0xffffffff) == 0x00000000);
    assert(this.not(0x00000000) == 0xffffffff);
    assert(this.not(0x00000001) == 0xfffffffe);
    assert(this.not(0x80000000) == 0x7fffffff);

    assert(this.or(0x11111111, 0x22222222) == 0x33333333);
    assert(this.or(0xffffffff, 0x00000000) == 0xffffffff);
    assert(this.or(0xffffffff, 0xffffffff) == 0xffffffff);

    assert(this.or64(0x11111111, 0x22222222) == 0x33333333);
    assert(this.or64(0xffffffff, 0x00000000) == 0xffffffff);
    assert(this.or64(0xffffffff, 0xffffffff) == 0xffffffff);
    assert(this.or64(0xf00000000, 0x00000000) == 0xf00000000);
    assert(this.or64(0xf00000000, 0x0000000f) == 0xf0000000f);

    assert(this.and(0x11111111, 0x22222222) == 0);
    assert(this.and(0xffffffff, 0) == 0);

    assert(this.and64(0x11111111, 0x22222222) == 0);
    assert2(this.and64(0xffffffff, 0), 0);
    assert2(this.and64(0xffffffffffff, 0), 0);
    assert2(this.and64(0xffffffffffff, 0xffffffff), 0xffffffff);

    assert2(this.get_bit(0xffffffff, 31), 1);
    assert2(this.get_bit(0xffffffff, 0), 1);
    assert(this.get_bit(0x80000000, 31) == 1);
    assert(this.get_bit(0, 31) == 0);
    assert(this.get_bit(0, 0) == 0);
    assert(this.get_bit(0x7fffffff, 31) == 0);
    assert2(this.get_bit(0x80000000, 31), 1);

    assert(this.get_bit64(0xffffffff, 31) == 1);
    assert2(this.get_bit64(0xffffffff, 0), 1);
    assert(this.get_bit64(0x80000000, 31) == 1);
    assert(this.get_bit64(0, 31) == 0);
    assert(this.get_bit64(0, 0) == 0);
    assert(this.get_bit64(0x7fffffff, 31) == 0);
    assert(this.get_bit64(0xffffffffffff, 31) == 1);
    assert2(this.get_bit64(0xffffffffffff, 50), 0);

    assert(this.get_bits(0xffffffff, 31, 0) == 0xffffffff);
    assert(this.get_bits(0xffffffff, 31, 16) == 0xffff);
    assert(this.get_bits(0, 31, 0) == 0);
    assert(this.get_bits(0x13, 4, 0) == 0x13, this.get_bits(0x13, 4, 0));
    assert2(this.get_bits(0xf0000000, 31, 27), 0x1e);
    assert2(this.get_bits(0xc0000000, 31, 27), 0x18);

    assert2(this.get_bits64(0xffffffff, 31, 0), 0xffffffff);
    assert2(this.get_bits64(0xffffffff, 31, 16), 0xffff);
    assert2(this.get_bits64(0, 31, 0), 0);
    assert2(this.get_bits64(0x13, 4, 0), 0x13);
    assert2(this.get_bits64(0x100000000, 31, 0), 0);
    assert2(this.get_bits64(0x100000000, 31, 0), 0);
    assert2(this.get_bits64(0x100000000, 32, 31), 2);
    assert2(this.get_bits64(0x300000000, 32, 31), 2);
    assert2(this.get_bits64(0x180000000, 32, 31), 3);
    assert2(this.get_bits64(0xf00000000, 33, 32), 3);
    assert2(this.get_bits64(0xf00000000, 34, 33), 3);
    assert2(this.get_bits64(0x180000000, 34, 31), 3);
    assert2(this.get_bits64(0x180000000, 34, 30), 6);
    assert2(this.get_bits64(0x100000000, 51, 32), 1);

    assert(this.set_bit(0xffffffff, 0, 0) == 0xfffffffe, this.set_bit(0xffffffff, 0, 0));
    assert(this.set_bit(0xffffffff, 31, 0) == 0x7fffffff, this.set_bit(0xffffffff, 31, 0));
    assert(this.set_bit(0xffffffff, 31, 1) == 0xffffffff, this.set_bit(0xffffffff, 31, 1));
    assert(this.set_bit(0x13, 31, 0) == 0x13, this.set_bit(0x13, 31, 0));
    assert(this.set_bit(0, 31, 1) == 0x80000000);
    assert(this.set_bit(0, 0, 1) == 1);
    assert(this.set_bit(0, 2, 1) == 4, this.set_bit(0, 2, 1));

    assert(this.set_bits(0xffffffff, 31, 0, 0) == 0);
    assert(this.set_bits(0xffffffff, 15, 0, 0) == 0xffff0000, this.set_bits(0xffffffff, 15, 0, 0));
    assert(this.set_bits(0, 4, 0, 0x13) == 0x13);
    assert2(this.set_bits(0xf0000000, 31, 27, 0x1e), 0xf0000000);
    assert2(this.set_bits(0x00000000, 31, 27, 0x1e), 0xf0000000);
    assert2(this.set_bits(0xf0000000, 31, 27, 0x18), 0xc0000000);

    assert2(this.lsl(1, 1), 2);
    assert2(this.lsl(0xf0000000, 1), 0x1e0000000);
    assert2(this.lsl(0xffffffff, 1), 0x1fffffffe);
    assert2(this.lsl(0xf0f0f0f0, 4), 0xf0f0f0f00);
    assert2(this.lsl(0x100000000, 1), 0x200000000);

    assert2(this.lsr(1, 1), 0);
    assert2(this.lsr(0xf0000000, 1), 0x78000000);
    assert2(this.lsr(0xffffffff, 1), 0x7fffffff);
    assert2(this.lsr(0xf0f0f0f0, 4), 0x0f0f0f0f);
    assert2(this.lsr(0x80000000, 32), 0);
    assert2(this.lsr(0x80000000, 1), 0x40000000);

    assert2(this.lsr(1, 1), 0);
    assert2(this.lsr(0xf0000000, 1), 0x78000000);
    assert2(this.lsr(0xffffffff, 1), 0x7fffffff);
    assert2(this.lsr(0xf0f0f0f0, 4), 0x0f0f0f0f);
    assert2(this.lsr(0x80000000, 32), 0);
    assert2(this.lsr(0x80000000, 1), 0x40000000);

    assert2(this.sint32(0x00000000), 0x00000000);
    assert2(this.sint32(0x80000000), 0x80000000 & 0xffffffff);
    assert2(this.sint32(0x100000000), 0x00000000);

    assert2(this.uint32(0x00000000),  0x00000000);
    assert2(this.uint32(0x80000000),  0x80000000);
    assert2(this.uint32(0x100000000), 0x00000000);
    assert2(this.uint32(0xffffffff),  0xffffffff);
    assert2(this.uint32(0xfffffffff), 0xffffffff);

    assert2(this.sign_extend(0, 26, 32), 0);
    //assert2(this.sign_extend(0, 1, 32), this.sint32(0));
    //assert2(this.sign_extend(1, 1, 32), this.sint32(0xffffffff));
    //assert2(this.sign_extend(0x0000ffff, 16, 32), this.sint32(0xffffffff));
    //assert2(this.sign_extend(0x00007fff, 16, 32), this.sint32(0x00007fff));
    assert2(this.sign_extend(0, 1, 32), 0);
    assert2(this.sign_extend(1, 1, 32), 0xffffffff);
    assert2(this.sign_extend(0x0000ffff, 16, 32), 0xffffffff);
    assert2(this.sign_extend(0x00007fff, 16, 32), 0x00007fff);
    assert2(this.sign_extend(0xffffe3 << 2, 26, 32), 0xffffff8c);

    assert2(this.copy_bits(0xf0000000, 31, 27, 0), 0);
    assert2(this.copy_bits(0xf0000000, 31, 27, 0xc0000000), 0xc0000000);

    assert2(this.copy_bit(0, 0, 1), 1);
    assert2(this.copy_bit(1, 0, 0), 0);
    assert2(this.copy_bit(0xffffffff, 0, 0), 0xfffffffe);
    assert2(this.copy_bit(0xffffffff, 31, 0), 0x7fffffff);

    assert2(this.ror(0x10000000, 1), 0x08000000);
    assert2(this.ror(0x10000001, 1), 0x88000000);
    assert2(this.ror(0xffffffff, 1), 0xffffffff);
    assert2(this.ror(0x0000ffff, 16), 0xffff0000);
    assert2(this.ror(0x000ffff0, 16), 0xfff0000f);

    assert2(this.count_leading_zero_bits(0), 32);
    assert2(this.count_leading_zero_bits(0x80000000), 0);
    assert2(this.count_leading_zero_bits(0x00008000), 16);

    display.log("All BitOps tests passed successfully");
};

