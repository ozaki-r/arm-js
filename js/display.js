/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
function Display(display_id, options) {
    this.display_id = display_id;
}

Display.prototype.log = function(content) {
    var display = document.getElementById(this.display_id);
    display.innerHTML += content + "\n";
};

Display.prototype.wipe = function() {
    var display = document.getElementById(this.display_id);
    display.innerHTML = "";
};

