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

function toStringBinInst(inst) {
    var ret = "";
    var bin = inst.toString(2);
    while (bin.length < 32)
        bin = "0" + bin;
    for (var i=0; i < 32; i++) {
        ret += bin.charAt(i);
        if ((i + 1) % 4 == 0 && i != 31)
            ret += " ";
    }
    return ret;
}

function toStringBin(val, n) {
    var ret = val.toString(2);
    while (ret.length < n)
        ret = "0" + ret;
    return ret;
}

function toStringBin32(val) {
    return toStringBin(val, 32);
}

function toStringBin64(val) {
    return toStringBin(val, 64);
}

function toStringBin16(val) {
    return toStringBin(val, 16);
}

function toStringHex32(ulong) {
    if (!ulong) {
        if (ulong === null)
            return "(null)";
        if (ulong === undefined)
            return "(undefined)";
        if (ulong === Number.NaN)
            return "(NaN)";
    }
    var ret = ulong.toString(16);
    while (ret.length < 8)
        ret = "0" + ret;
    return ret;
}

function toStringNum(num) {
    return num.toString(10) + "(" + num.toString(16) + ")";
}

function toStringInst(inst) {
    return toStringHex32(inst) + "(" + toStringBinInst(inst) + ")";
}

function toStringAscii(uint) {
    var ret = "";
    for (var i=0; i < 32; i += 8) {
        var b = bitops.get_bits(uint, 32-1 - i, 32-1 - i - 7);
        if (b >= 32 && b <= 126)
            ret += String.fromCharCode(b);
        else
            ret += '.';
    }
    return ret;
}

function abort(str) {
    throw str;
}

function stringToLong(str) {
    if (str.length != 4)
        abort("String.toLong: string too long: " + str.length + " > 4");
    var ret = 0;
    ret += str.charCodeAt(3) << 24;
    ret += str.charCodeAt(2) << 16;
    ret += str.charCodeAt(1) << 8;
    ret += str.charCodeAt(0);
    return ret;
};

function getCurrentTime() {
    return (new Date()).getTime();
};
