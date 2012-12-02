/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
function JSONlocalStorage(name, target, list) {
    this.name = name;
    this.target = target;
    this.list = list;
}

JSONlocalStorage.prototype.restore = function() {
    var json = localStorage[this.name];
    if (!json)
        return;
    var data = JSON.parse(json);
    for (var i in this.list) {
        var name = this.list[i];
        var val = data[name];
        if (val || val === false) {
            //console.debug("localStorage[" + opt + "] => " + val);
            this.target[name] = val;
        }
    }
};

JSONlocalStorage.prototype.save = function() {
    var data = Object();
    //localStorage.clear();
    for (var i in this.list) {
        var name = this.list[i];
        var val = this.target[name];
        if (val || val === false) {
            //console.debug("localStorage[" + opt + "] <= " + val);
            data[name] = val;
        }
    }
    localStorage[this.name] = JSON.stringify(data);
};

