/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
function Number64(high, low) {
    this.high = high;
    this.low = low;
    this.overflow = 0;
    this._overflow = 0;
};

Number64.prototype.mul32 = function(sub, obj) {
    var sub_hi = bitops.get_bits(sub, 31, 16);
    var sub_lo = bitops.get_bits(sub, 15, 0);
    var obj_hi = bitops.get_bits(obj, 31, 16);
    var obj_lo = bitops.get_bits(obj, 15, 0);
    //display.log("sub_hi=" + sub_hi.toString(16));
    //display.log("sub_lo=" + sub_lo.toString(16));
    //display.log("obj_hi=" + obj_hi.toString(16));
    //display.log("obj_lo=" + obj_lo.toString(16));
    var ret = sub_lo * obj_lo + this._overflow;
    //display.log("ret=" + ret.toString(16));
    var tmp_hi = sub_lo * obj_hi + sub_hi * obj_lo;
    //display.log("tmp_hi=" + tmp_hi.toString(16));
    ret += bitops.get_bits(tmp_hi, 15, 0) * 0x10000;
    //display.log("ret=" + ret.toString(16));
    this._overflow = bitops.get_bits64(tmp_hi, 32, 16) + bitops.get_bits64(ret, 51, 32);
    //display.log("tmp_hi_hi=" + bitops.get_bits64(tmp_hi, 32, 16).toString(16));
    //display.log("ret_overflow=" + bitops.get_bits64(ret, 51, 32).toString(16));
    //display.log("overflow=" + this._overflow.toString(16));
    ret = bitops.get_bits64(ret, 31, 0);
    this._overflow += sub_hi * obj_hi;
    return ret;
};

Number64.prototype.mul = function(obj) {
    /* this.high and obj.high should be zero */
    /*
    var sub_lohi = bitops.get_bits(this.low, 31, 16);
    var sub_lolo = bitops.get_bits(this.low, 15, 0);
    var obj_lohi = bitops.get_bits(obj.low, 31, 16);
    var obj_lolo = bitops.get_bits(obj.low, 15, 0);
    var obj_lohi = bitops.get_bits(obj.low, 31, 16);
    var obj_lolo = bitops.get_bits(obj.low, 15, 0);
    var obj_hihi = bitops.get_bits(obj.high, 31, 16);
    var obj_hilo = bitops.get_bits(obj.high, 15, 0);
    */
    this._overflow = 0;
    var ret = this.mul32(this.low, obj.low);
    return new Number64(this._overflow, ret);
};

Number64.prototype.add = function(obj) {
    var tmp = this.low + obj.low;
    var overflow = bitops.get_bits64(tmp, 51, 32);
    var low = bitops.get_bits64(tmp, 31, 0);
    tmp = this.high + obj.high + overflow;
    overflow = bitops.get_bits64(tmp, 51, 32);
    var high = bitops.get_bits64(tmp, 31, 0);
    return new Number64(high, low);
};

Number64.prototype.sub = function(obj) {
    if (this.high > obj.high) {
        var hi = this.high - obj.high;
        var lo = this.low - obj.low;
        if (lo < 0) {
            hi -= 1;
            lo += 0x100000000;
        }
        return new Number64(hi, lo);
    } else if (this.high < obj.high) {
        var hi = this.high - obj.high;
        var lo = this.low - obj.low;
        if (hi < 0)
            hi += 0x100000000;
        if (lo < 0) {
            lo += 0x100000000;
            hi -= 1;
        }
        return new Number64(hi, lo);
    } else {
        var lo = this.low - obj.low;
        return new Number64(0, lo);
    }
};

Number64.prototype.lsl = function(amount) {
    this.high = this.low >>> (32 - amount);
    this.low = bitops.lsl(bitops.get_bits(this.low, 32 - amount - 1, 0), amount);
    return this;
};

Number64.prototype.sign_extend = function(from, to) {
    if (bitops.get_bit(this.low, from - 1)) {
        if (to <= 32)
            return new Number64(this.high, bitops.sign_extend(this.low, from, to));
        var low = (from == 32) ? this.low : bitops.sign_extend(this.low, from, 32);
        var high = bitops.sign_extend(1, 1, to - 32);
        return new Number64(high, low);
    } else {
        return new Number64(this.high, this.low);
    }
};

/*
Number64.prototype.asr = function(amount) {
    var extended = this.sign_extend(32, 32 + amount);
    var result = bitops.get_bits(extended.low, 31, amount);
    result = bitops.set_bits(result, 31, 31 - amount - 1, bitops.get_bits(extended.high, amount - 1, 0));
    return new Number64(0, result);
};
*/

Number64.prototype.is_zero = function() {
    return this.high === 0 && this.low === 0;
};

function assert_equal(sub, obj, message) {
    //console.log(sub.high, sub.low, obj.high, obj.low);
    if (!(sub.high == obj.high && sub.low == obj.low)) {
        display.log(sub.high.toString(16) + " " + sub.low.toString(16) + " " + obj.high.toString(16) + " " + obj.low.toString(16));
        assert(sub.high == obj.high && sub.low == obj.low);
    }
}

function TestNumber64() {
    // mul tests
    var ret = new Number64(0, 0).mul(new Number64(0, 0));
    var obj = new Number64(0, 0);
    assert_equal(ret, obj, "0 * 0");
    var ret = new Number64(0, 1).mul(new Number64(0, 1));
    var obj = new Number64(0, 1);
    assert_equal(ret, obj, "1 * 1");
    var ret = new Number64(0, 0x80000000).mul(new Number64(0, 2));
    var obj = new Number64(1, 0);
    assert_equal(ret, obj, "0x80000000 * 2");
    var ret = new Number64(0, 0x80000000).mul(new Number64(0, 4));
    var obj = new Number64(2, 0);
    assert_equal(ret, obj, "0x80000000 * 4");
    var ret = new Number64(0, 0x8fffffff).mul(new Number64(0, 0x10));
    var obj = new Number64(8, 0xfffffff0);
    assert_equal(ret, obj, "0x8fffffff * 0x10");
    var ret = new Number64(0, 0x0fffffff).mul(new Number64(0, 0x0fffffff));
    var obj = new Number64(0x00ffffff, 0xe0000001);
    assert_equal(ret, obj, "0x0fffffff * 0x0fffffff");
    var ret = new Number64(0, 0xffffffff).mul(new Number64(0, 0xffffffff));
    var obj = new Number64(0xfffffffe, 1);
    assert_equal(ret, obj, "0xffffffff * 0xffffffff");
    // add tests
    var ret = new Number64(0, 0).add(new Number64(0, 0));
    var obj = new Number64(0, 0);
    assert_equal(ret, obj, "0 + 0");
    var ret = new Number64(0, 0).add(new Number64(0, 1));
    var obj = new Number64(0, 1);
    assert_equal(ret, obj, "0 + 1");
    var ret = new Number64(1, 0).add(new Number64(1, 0));
    var obj = new Number64(2, 0);
    assert_equal(ret, obj, "1:0 + 1:0");
    var ret = new Number64(0, 0xffffffff).add(new Number64(0, 1));
    var obj = new Number64(1, 0);
    assert_equal(ret, obj, "0:0xffffffff + 0:1");
    var ret = new Number64(0, 0x1ffffffff).add(new Number64(0, 1));
    var obj = new Number64(2, 0);
    assert_equal(ret, obj, "0:0x1ffffffff + 0:1");
    var ret = new Number64(0, 0xeeeeeeee).add(new Number64(0, 0x11111111));
    var obj = new Number64(0, 0xffffffff);
    assert_equal(ret, obj, "0:0xeeeeeeee + 0:0x11111111");
    var ret = new Number64(0xf, 0xf).add(new Number64(0x1, 0x1));
    var obj = new Number64(0x10, 0x10);
    assert_equal(ret, obj, "0xf:0xf + 0x1:0x1");
    var ret = new Number64(0xf, 0xffffffff).add(new Number64(0x1, 0x1));
    var obj = new Number64(0x11, 0);
    assert_equal(ret, obj, "0xf:0xfffffffff + 0x1:0x1");
    // sub tests
    var ret = new Number64(0, 1).sub(new Number64(0, 1));
    var obj = new Number64(0, 0);
    assert_equal(ret, obj, "1 - 1");
    var ret = new Number64(0, 0).sub(new Number64(0, 1));
    var obj = new Number64(0, -1);
    assert_equal(ret, obj, "0 - 1");
    var ret = new Number64(1, 0).sub(new Number64(0, 1));
    var obj = new Number64(0, 0xffffffff);
    assert_equal(ret, obj, "1:0 - 0:1");
    var ret = new Number64(1, 0xf).sub(new Number64(0, 1));
    var obj = new Number64(1, 0xe);
    assert_equal(ret, obj, "1:0xf - 0:1");
    var ret = new Number64(1, 0xf).sub(new Number64(0, 0xf0000000));
    var obj = new Number64(0, 0x1000000f);
    assert_equal(ret, obj, "1:0xf - 0:0xf0000000");
    var ret = new Number64(0, 0).sub(new Number64(0xf, 0));
    var obj = new Number64(0x100000000-0xf, 0);
    assert_equal(ret, obj, "0:0 - 0xf:0");
    var ret = new Number64(0xe, 0).sub(new Number64(0xf, 0xf0000000));
    var obj = new Number64(0xfffffffe, 0x10000000);
    assert_equal(ret, obj, "0xe:0x11111111 - 0xf:0");
    // lsl tests
    var ret = new Number64(0, 1).lsl(1);
    var obj = new Number64(0, 2);
    assert_equal(ret, obj, "1 << 1");
    var ret = new Number64(0, 0x80000000).lsl(1);
    var obj = new Number64(1, 0);
    assert_equal(ret, obj, "0x80000000 << 1");
    var ret = new Number64(0, 0x80000000).lsl(16);
    var obj = new Number64(0x8000, 0);
    assert_equal(ret, obj, "0x80000000 << 16");
    var ret = new Number64(0, 0x80000000).lsl(31);
    var obj = new Number64(0x40000000, 0);
    assert_equal(ret, obj, "0x80000000 << 31");
    // sign_extend tests
    var ret = new Number64(0, 0x10000000).sign_extend(31, 32);
    var obj = new Number64(0, 0x10000000);
    assert_equal(ret, obj, "0x10000000, 31, 32");
    var ret = new Number64(0, 0x10000000).sign_extend(29, 32);
    var obj = new Number64(0, 0xf0000000);
    assert_equal(ret, obj, "0x10000000, 29, 32");
    var ret = new Number64(0, 0x10000000).sign_extend(29, 36);
    var obj = new Number64(0xf, 0xf0000000);
    assert_equal(ret, obj, "0x10000000, 29, 36");
    var ret = new Number64(0, 0x80000000).sign_extend(32, 64);
    var obj = new Number64(0xffffffff, 0x80000000);
    assert_equal(ret, obj, "0x80000000, 32, 64");
    /*
    // asr tests
    var ret = new Number64(0, 0x80000000).asr(15);
    var obj = new Number64(0, 0xffff0000);
    assert_equal(ret, obj, "0x80000000 >> 15");
    */

    display.log("All Number64 tests passed successfully");
};

