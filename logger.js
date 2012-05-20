/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
function Logger(target, options) {
    this.target = target;
    this.options = options;

    this.reset();
}

Logger.prototype.reset = function() {
    this.logs = new Array();
    this.total = 0;
};

Logger.prototype.log = function(str) {
    if (!this.options.enable_logger)
        return;
    this.logs.push(str);
    this.total += 1;
    // log_size would change
    while (this.logs.length > this.options.log_size)
        this.logs.shift();
};


Logger.prototype.dump = function() {
    //if (!this.options.enable_logger)
    //    return;
    var output = 0;
    var msgs = "";
    for (var i=0; i < this.logs.length; i++) {
        var log = this.logs[i];
        if (log) {
            msgs += log + "\n";
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
    this.target.log("Logger: output=" + output);
    this.target.log("Logger: total=" + this.total);
};

