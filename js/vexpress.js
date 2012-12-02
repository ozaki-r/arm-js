/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
function Device() {
    this.baseaddr = 0;
    this.read = new Array();
    this.write = new Array();
    this.data = new Object();

    // Peripheral Identification Registers
    this.read[this.baseaddr + 0xfe0] = 0;
    this.read[this.baseaddr + 0xfe4] = 0;
    this.read[this.baseaddr + 0xfe8] = 0;
    this.read[this.baseaddr + 0xfec] = 0;
    this.read[this.baseaddr + 0xff0] = 0;
    this.read[this.baseaddr + 0xff4] = 0;
    this.read[this.baseaddr + 0xff8] = 0;
    this.read[this.baseaddr + 0xffc] = 0;
};

Device.prototype.register_readonly = function(name, initval, cb_r) {
    if (cb_r) {
        this.data[name] = initval;
        this.read[this[name]] = cb_r;
    } else {
        this.read[this[name]] = initval;
    }
};

Device.prototype.register_writeonly = function(name, cb_w) {
    if (cb_w) {
        this.write[this[name]] = cb_w;
    } else {
        var that = this;
        this.write[this[name]] = function(word) {
            that.data[name] = word;
        };
    }
};

Device.prototype.register_writable = function(name, initval, cb_r, cb_w) {
    this.data[name] = initval;
    var that = this;
    if (cb_r) {
        this.read[this[name]] = cb_r;
    } else {
        this.read[this[name]] = function() {
            return that.data[name];
        };
    }
    if (cb_w) {
        this.write[this[name]] = cb_w;
    } else {
        this.write[this[name]] = function(word) {
            that.data[name] = word;
        };
    }
};

Device.prototype.save = function() {
    var params = new Object();
    for (var i in this.data) {
        params[i] = this.data[i];
    }
    return params;
};

Device.prototype.restore = function(params) {
    for (var i in this.data) {
        this.data[i] = params[i];
    }
};

/*
 * System Registers
 */
function SystemRegisters(baseaddr, options) {
    this.baseaddr = baseaddr;

    this.ID          = this.baseaddr + 0x00;
    this.SW          = this.baseaddr + 0x04;
    this.LED         = this.baseaddr + 0x08;
    this.CLOCK_24MHZ = this.baseaddr + 0x5c;
    this.MISC        = this.baseaddr + 0x60;
    this.PROCID0     = this.baseaddr + 0x84;

    var that = this;

    var id = 0;
    id = bitops.set_bits(id, 31, 28, 1); // Rev B
    id = bitops.set_bits(id, 27, 16, 0x190); // HBI
    id = bitops.set_bits(id, 15, 12, 0xf); // all builds
    id = bitops.set_bits(id, 11, 8, 0x5); // AXI
    id = bitops.set_bits(id, 7, 0, 0); // FPGA build
    this.register_readonly("ID", id);

    this.register_readonly("SW", 0);
    this.register_readonly("LED", 0);
    this.register_readonly("MISC", 0);

    var procid0 = 0;
    //procid0 = bitops.set_bits(procid0, 31, 24, 0x12); // Cortex-A5
    procid0 = bitops.set_bits(procid0, 31, 24, 0x0c); // CA9x4
    procid0 = bitops.set_bits(procid0, 11, 0, 0x191); // CoreTile Express
    this.register_readonly("PROCID0", procid0);

    // 24 MHz clock
    var clock_24mhz = {
        clock: 0,
        time: (new Date()).getTime(),
        hz: 24*1000*1000
    };
    this.register_writable("CLOCK_24MHZ", clock_24mhz, function() {
        var now = (new Date()).getTime();
        var clock24mhz = that.data["CLOCK_24MHZ"];
        var old = clock24mhz.time;
        clock24mhz.time = now;
        var passing_ticks = (now - old) * (clock24mhz.hz / 1000);
        clock24mhz.clock = (clock24mhz.clock + passing_ticks) % 0x100000000;
        return clock24mhz.clock;
    }, function(word) {
        throw "24MHz clock write";
    });
    // XXX: update clock to prevent overflow
    // FIXME: should stop when the emulator is stopped
    function update_clock() {
        that.read[that.CLOCK_24MHZ]();
        setTimeout(update_clock, 1000);
    }
    setTimeout(update_clock, 1000);
}

SystemRegisters.prototype = new Device();

SystemRegisters.prototype.dump = function() {
    display.log("CLOCK_24MHz=" + this.data["CLOCK_24MHZ"].time);
};


function UnimplementedDevice(baseaddr) {
    this.baseaddr = baseaddr;
};

UnimplementedDevice.prototype = new Device();


function GenericInterruptController(baseaddr) {
    this.baseaddr = baseaddr;

    this.enabled = false;
    this.pending_interrupts = new Array();
    this.sent_irqs = new Array();

    this.n_supported_irqs = 64;
    // 64 = 32 * (ITLinesNumber + 1)
    this.ITLinesNumber = this.n_supported_irqs / 32 - 1;
    this.n_supported_cpus = 1;
    this.CPUNumber = 0;

    this.DCR  = this.baseaddr + 0x1000;
    this.ICTR = this.baseaddr + 0x1004;
    this.CICR = this.baseaddr + 0x0100;
    this.IPMR = this.baseaddr + 0x0104;
    this.IAR  = this.baseaddr + 0x010c;
    this.EOIR = this.baseaddr + 0x0110;
    this.ICFR = this.baseaddr + 0x1c00;
    this.IPTR = this.baseaddr + 0x1800;
    this.IPR  = this.baseaddr + 0x1400;
    this.ICER = this.baseaddr + 0x1180;
    this.ISER = this.baseaddr + 0x1100;

    var that = this;

    /*
     * Distributor registers
     */
    // Distributor Control Register
    this.register_writable("DCR", 0, null, function(word) {
        if (bitops.get_bit(word, 0)) {
            that.enabled = true;
            display.log("GIC: started monitoring interrupts");
        } else {
            that.enabled = false;
            display.log("GIC: stopped monitoring interrupts");
        }
        return that.data["DCR"] = word;
    });

    // Interrupt Controller Type Register
    // [4:0]: ITLinesNumber
    // TODO
    var ictr = 0;
    ictr = bitops.set_bits(ictr, 7, 5, this.CPUNumber);
    ictr = bitops.set_bits(ictr, 4, 0, this.ITLinesNumber);
    this.register_readonly("ICTR", ictr);

    var i;
    // Interrupt Configuration Registers
    for (i=0; i < 2*(this.ITLinesNumber+1); i++) {
        this["ICFR" + i] = this.ICFR + i*4;
        this.register_writable("ICFR" + i, 0);
    }
    // Interrupt Processor Targets Registers
    for (i=0; i < 8*(this.ITLinesNumber+1); i++) {
        this["IPTR" + i] = this.IPTR + i*4;
        this.register_writable("IPTR" + i, 0);
    }
    // Interrupt Priority Registers
    for (i=0; i < 8*(this.ITLinesNumber+1); i++) {
        this["IPR" + i] = this.IPR + i*4;
        this.register_writable("IPR" + i, 0);
    }
    // Interrupt Clear-Enable Registers
    for (i=0; i < (this.ITLinesNumber+1); i++) {
        this["ICER" + i] = this.ICER + i*4;
        this.register_writable("ICER" + i, 0);
    }
    // Interrupt Set-Enable Registers
    for (i=0; i < (this.ITLinesNumber+1); i++) {
        this["ISER" + i] = this.ISER + i*4;
        this.register_writable("ISER" + i, 0);
    }

    /*
     * CPU interface registers
     */
    // CPU Interface Control Register
    this.register_writable("CICR", 0);

    // Interrupt Priority Mask Register
    this.register_writable("IPMR", 0);

    // Interrupt Acknowledge Register
    this.register_readonly("IAR", 0, function() {
        if (that.sent_irqs.length === 0) {
            // There is no pending IRQ
            return 1023;
        }
        var irq = that.sent_irqs[0];
        //display.log("irq=" + irq);
        return irq;
    });

    // End of Interrupt Register
    this.register_writeonly("EOIR", function(word) {
        if (that.sent_irqs.length === 0)
            return;
        var eoi = word & 0x3ff;
        if (that.sent_irqs[0] == eoi)
            that.sent_irqs.shift();
        else
            throw "irq != eoi";
    });
}

GenericInterruptController.prototype = new Device();

GenericInterruptController.prototype.save = function() {
    params = Device.prototype.save.call(this);
    params.pending_interrupts = this.pending_interrupts;
    params.sent_irqs = this.sent_irqs;
    return params;
};

GenericInterruptController.prototype.restore = function(params) {
    Device.prototype.restore.call(this, params);
    if (bitops.get_bit(this.data["DCR"], 0))
        this.enabled = true;
    else
        this.enabled = false;
    this.pending_interrupts = params.pending_interrupts;
    this.sent_irqs = params.sent_irqs;
};

GenericInterruptController.prototype.is_pending = function() {
    return this.enabled && this.pending_interrupts.length > 0;
};

GenericInterruptController.prototype.send_interrupt = function(irq) {
    if (this.pending_interrupts[this.pending_interrupts.length-1] == irq)
        return;
    this.pending_interrupts.push(irq);
};

GenericInterruptController.prototype.pick_interrupt = function() {
    var irq = this.pending_interrupts.shift();
    if (irq === null)
        throw "irq === null";
    //display.log(irq);
    this.sent_irqs.push(irq);
    return irq;
};

GenericInterruptController.prototype.dump = function() {
    var i;
    var name;
    var val;
    display.log("Enable=" + (this.enabled ? "enabled" : "disabled"));
    display.log("# of IRQs=" + this.n_supported_irqs + "(ITLinesNumber=" + this.ITLinesNumber + ")");
    display.log("# of CPUs=" + this.n_supported_cpus + "(CPUNumber=" + this.CPUNumber + ")");
    display.log("DCR=" + toStringHex32(this.data["DCR"]));
    display.log("ICTR=" + toStringHex32(this.data["ICTR"]));

    var header = "ICFR:\t";
    var msgs = new Array();
    for (i=0; i < 2*(this.ITLinesNumber+1); i++) {
        name = "ICFR" + i;
        val = this.data[name];
        msgs.push(toStringHex32(val));
    }
    display.log(header + msgs.join(" "));

    header = "IPTR:\t";
    msgs = new Array();
    for (i=0; i < 8*(this.ITLinesNumber+1); i++) {
        name = "IPTR" + i;
        val = this.data[name];
        msgs.push(toStringHex32(val));
    }
    display.log(header + msgs.join(" "));

    header = "IPR :\t";
    msgs = new Array();
    for (i=0; i < 8*(this.ITLinesNumber+1); i++) {
        name = "IPR" + i;
        val = this.data[name];
        msgs.push(toStringHex32(val));
    }
    display.log(header + msgs.join(" "));

    header = "ICER:\t";
    msgs = new Array();
    for (i=0; i < (this.ITLinesNumber+1); i++) {
        name = "ICER" + i;
        val = this.data[name];
        msgs.push(toStringHex32(val));
    }
    display.log(header + msgs.join(" "));

    header = "ISER:\t";
    msgs = new Array();
    for (i=0; i < (this.ITLinesNumber+1); i++) {
        name = "ISER" + i;
        val = this.data[name];
        msgs.push(toStringHex32(val));
    }
    display.log(header + msgs.join(" "));

    display.log("CICR=" + toStringHex32(this.data["CICR"]));
    display.log("IPMR=" + toStringHex32(this.data["IPMR"]));
};

/*
 * ARM Dual-Timer Module (SP804)
 */
function DualTimer(baseaddr, irq, gic) {
    this.baseaddr = baseaddr;
    this.irq = irq;
    this.gic = gic;

    this.TIMCLK = 100000;  // 1 MHz clock pluse input

    this.Load1    = this.baseaddr + 0x00;
    this.Load2    = this.baseaddr + 0x20;
    this.Value1   = this.baseaddr + 0x04;
    this.Value2   = this.baseaddr + 0x24;
    this.Control1 = this.baseaddr + 0x08;
    this.Control2 = this.baseaddr + 0x28;
    this.IntClr1  = this.baseaddr + 0x0c;
    this.IntClr2  = this.baseaddr + 0x2c;

    var that = this;

    // Load Register, TimerXLoad
    this.register_writable("Load1", 0, null, function(word) {
        // TODO
        that.data["Load1"] = word;
        that.data["Value1"] = word;
    });

    this.register_writable("Load2", 0, null, function(word) {
        // TODO
        that.data["Load2"] = word;
        that.data["Value2"] = word;
    });

    // Current Value Register, TimerXValue
    // Read-only
    this.register_writable("Value1", 0xffffffff, null, function(word) {
        // NOP
        // This is a Linux kernel bug??
    });

    this.register_writable("Value2", 0xffffffff, null, function(word) {
        // NOP
        // This is a Linux kernel bug??
    });

    // Control Register, TimerXControl
    this.data["Control1"] = {En:0, Mode:0, IntEnable:1, Pre:0, Size:0, OneShot:0, value:0};
    this.register_writeonly("Control1", this.write_Control1.bind(this));

    this.data["Control2"] = {En:0, Mode:0, IntEnable:1, Pre:0, Size:0, OneShot:0, value:0};
    this.register_writeonly("Control2", this.write_Control2.bind(this));

    // Interrupt Clear Register. TimerXIntClr
    this.register_writeonly("IntClr1", function(word) {
        // TODO
        //display.log("IntClr1: " + word);
    });

    this.register_writeonly("IntClr2", function(word) {
        // TODO
        //display.log("IntClr2: " + word);
    });
}

DualTimer.prototype = new Device();

DualTimer.prototype._write_Control1 = function(ctl) {
    this.data["Control1"] = ctl;
    if (ctl.En) {
        // Clear old timer
        clearTimeout(this.timeout_timer1.bind(this));
        var val = this.data["Value1"];
        if (val != 0xffffffff)
            setTimeout(this.timeout_timer1.bind(this), val * 1000 / this.TIMCLK);
    } else {
        clearTimeout(this.timeout_timer1.bind(this));
    }
};

DualTimer.prototype.write_Control1 = function(word) {
    this._write_Control1(this.parse_control_register(word));
};

DualTimer.prototype._write_Control2 = function(ctl) {
    this.data["Control2"] = ctl;
    if (ctl.En) {
        // Clear old timer
        clearTimeout(this.timeout_timer2.bind(this));
        var val = this.data["Value2"];
        if (val != 0xffffffff)
            setTimeout(this.timeout_timer2.bind(this), val * 1000 / this.TIMCLK);
    } else {
        clearTimeout(this.timeout_timer2.bind(this));
    }
};

DualTimer.prototype.write_Control2 = function(word) {
    this._write_Control2(this.parse_control_register(word));
};

DualTimer.prototype.restore = function(params) {
    Device.prototype.restore.call(this, params);
    this._write_Control1(this.data["Control1"]);
    this._write_Control2(this.data["Control2"]);
};

DualTimer.prototype.timeout_timer1 = function() {
    //display.log("timer1 timeout");
    if (this.data["Control1"].IntEnable)
        this.gic.send_interrupt(this.irq);
    if (!this.data["Control1"].OneShot) {
        var val = this.data["Value1"];
        if (val != 0xffffffff)
            setTimeout(this.timeout_timer1.bind(this), val * 1000 / this.TIMCLK);
    }
    // XXX: Linux uses timer1 as timer interrupt generator and timer2 as counter.
    // So we can update timer2 value on only timer1 interrupt.
    this.data["Value2"] -= this.data["Value1"];
    if (this.data["Value2"] < 0)
        this.data["Value2"] = 0xffffffff + this.data["Value2"];
};

DualTimer.prototype.timeout_timer2 = function() {
    //display.log("timer2 timeout");
    if (this.data["Control2"].IntEnable)
        this.gic.send_interrupt(this.irq);
    if (!this.data["Control2"].OneShot) {
        var val = this.data["Value1"];
        if (val != 0xffffffff)
            setTimeout(this.timeout_timer2.bind(this), val * 1000 / this.TIMCLK);
    }
};

DualTimer.prototype.parse_control_register = function(value) {
    var ctl = {En:0, Mode:0, IntEnable:0, Pre:0, Size:0, OneShot:0, value:0};
    ctl.En = bitops.get_bit(value, 7);
    ctl.Mode = bitops.get_bit(value, 6);
    ctl.IntEnable = bitops.get_bit(value, 5);
    ctl.Pre = bitops.get_bits(value, 3, 2);
    ctl.Size = bitops.get_bit(value, 1);
    ctl.OneShot = bitops.get_bit(value, 0);
    ctl.value = value;
    return ctl;
};

DualTimer.prototype.dump_timer = function(id) {
    var ctl = this.data["Control" + id];
    var header = "" + id + ": ";
    var msgs = new Array();
    msgs.push("value=" + toStringHex32(this.data["Value" + id]));
    msgs.push("load=" + toStringHex32(this.data["Load" + id]));
    msgs.push("En=" + (ctl.En ? "enabled" : "disabled"));
    msgs.push("Mode=" + (ctl.Mode ? "periodic" : "free-running"));
    msgs.push("IntEnable=" + (ctl.IntEnable ? "enabled" : "disabled"));
    switch (ctl.Pre) {
        case 0:
            // 0 stages of prescale, clock is divided by 1
            msgs.push("Pre=0:1");
            break;
        case 1:
            // 4 stages of prescale, clock is divided by 16
            msgs.push("Pre=4:16");
            break;
        case 2:
            // 8 stages of prescale, clock is divided by 256
            msgs.push("Pre=8:256");
            break;
        case 3:
        default:
            throw "Pre" + ctl.Pre;
            break;
    }
    msgs.push("Size=" + (ctl.Size ? "32bit" : "16bit"));
    msgs.push("OneShot=" + (ctl.OneShot ? "oneshot" : "wrapping"));
    display.log(header + msgs.join(', '));
};

DualTimer.prototype.dump = function() {
    this.dump_timer(1);
    this.dump_timer(2);
};

/*
 * PrimeXsys System Controller (SP810)
 */
function SystemController(baseaddr) {
    this.baseaddr = baseaddr;

    this.CTRL0 = this.baseaddr + 0x0000;
    this.CTRL1 = this.baseaddr + 0xa000;

    var ctrl0 = 0;
    ctrl0 = bitops.set_bit(ctrl0, 15, 1);
    ctrl0 = bitops.set_bit(ctrl0, 17, 1);
    ctrl0 = bitops.set_bit(ctrl0, 19, 1);
    ctrl0 = bitops.set_bit(ctrl0, 21, 1);
    this.register_readonly("CTRL0", ctrl0);

    this.register_readonly("CTRL1", 0);
}

SystemController.prototype = new Device();

/*
 * I/O
 */
function SystemIO(options) {
    this.read = new Array();
    this.write = new Array();
    this.name = new Array();
}

SystemIO.prototype.register_io = function(name, target) {
    var addr;
    for (addr in target.read) {
        this.read[addr] = target.read[addr];
        this.name[addr] = name;
    }
    for (addr in target.write) {
        this.write[addr] = target.write[addr];
        this.name[addr] = name;
    }
};

SystemIO.prototype.ld_byte = function(addr) {
    if (this.read[addr] === undefined)
        throw "Unknown IO read from: " + addr.toString(16);
    else if (typeof(this.read[addr]) == "function")
        return this.read[addr]();
    else
        return this.read[addr];
};

SystemIO.prototype.st_byte = function(addr, onebyte) {
    if (this.write[addr] === undefined)
        throw "Unknown IO write(" + onebyte.toString(16) + ") to: " + addr.toString(16);
    return this.write[addr](onebyte);
};

SystemIO.prototype.ld_halfword = function(addr) {
    if (this.read[addr] === undefined)
        throw "Unknown IO read from: " + addr.toString(16);
    else if (typeof(this.read[addr]) == "function")
        return this.read[addr]();
    else
        return this.read[addr];
};

SystemIO.prototype.st_halfword = function(addr, halfword) {
    if (this.write[addr] === undefined)
        throw "Unknown IO write(" + halfword.toString(16) + ") to: " + addr.toString(16);
    return this.write[addr](halfword);
};

SystemIO.prototype.ld_word = function(addr) {
    if (this.read[addr] === undefined)
        throw "Unknown IO read from: " + addr.toString(16);
    else if (typeof(this.read[addr]) == "function")
        return this.read[addr]();
    else
        return this.read[addr];
};

SystemIO.prototype.st_word = function(addr, word) {
    if (this.write[addr] === undefined)
        throw "Unknown IO write(" + word.toString(16) + ") to: " + addr.toString(16);
    return this.write[addr](word);
};

SystemIO.prototype.dump = function() {
    // FIXME
    //display.log("24MHz clock=" + this.sysregs.data["CLOCK_24MHZ"].clock.toString());
    var addr;
    display.log("Read:");
    for (addr in this.read) {
        display.log(toStringHex32(parseInt(addr, 10)) + ": " + this.name[addr]);
    }
    display.log("Write:");
    for (addr in this.write)
        display.log(toStringHex32(parseInt(addr, 10)) + ": " + this.name[addr]);
};

/*
 * UART
 */
function UART(id, baseaddr, irq, gic) {
    this.baseaddr = baseaddr;
    this.irq = irq;
    this.gic = gic;

    this.id = id;
    this.name = "UART" + id;
    this.write_to_terminal = null;

    this.DR    = this.baseaddr + 0x00;
    this.FR    = this.baseaddr + 0x18;
    this.IBRD  = this.baseaddr + 0x24;
    this.FBRD  = this.baseaddr + 0x28;
    this.LCR_H = this.baseaddr + 0x2c;
    this.CR    = this.baseaddr + 0x30;
    this.IFLS  = this.baseaddr + 0x34;
    this.IMSC  = this.baseaddr + 0x38;
    this.MIS   = this.baseaddr + 0x40;
    this.ICR   = this.baseaddr + 0x44;

    this.read[this.baseaddr + 0xfe0] = 0x11;
    this.read[this.baseaddr + 0xfe4] = 0x10;
    this.read[this.baseaddr + 0xfe8] = 0x34; // r1p5
    this.read[this.baseaddr + 0xfec] = 0x00;
    this.read[this.baseaddr + 0xff0] = 0x0d;
    this.read[this.baseaddr + 0xff4] = 0xf0;
    this.read[this.baseaddr + 0xff8] = 0x05;
    this.read[this.baseaddr + 0xffc] = 0xb1;

    // To CPU
    this.rx_fifo = new Array();
    // From CPU
    this.tx_fifo = new Array();

    this.enabled = false;
    this.fifo_length = 16;
    this.rx_fifo_level = this.fifo_length / 8;
    this.tx_fifo_level = this.fifo_length / 8;
    this.tx_int_enabled = false;
    this.rx_int_enabled = false;
    this.tx_enabled = false;
    this.rx_enabled = false;
    this.fifo_enabled = false;

    var that = this;

    this.register_writable("DR", 0, function() {
        //logger.log(that.name + ": read DR");
        if (that.rx_fifo.length > 0)
            return that.rx_fifo.shift();
        else
            return 0;
    }, function(onebyte) {
        if (!(onebyte >=0 && onebyte <= 127))
            throw "Invalid char: " + onebyte;
        if (onebyte >=0 && onebyte < 32 && onebyte != 8 && onebyte != 10 && onebyte != 13)
            display.log("Warning: not char: " + onebyte);
        var str = String.fromCharCode(onebyte);
        //display.log(str);
        that.output_char(str);
    });

    this.register_readonly("FR", 0, function() {
        var ret = 0;
        if (that.tx_fifo.length === 0)
            ret += (1 << 7);
        if (that.rx_fifo.length >= that.fifo_length)
            ret += (1 << 6);
        if (that.rx_fifo.length === 0)
            ret += (1 << 4);
        //logger.log("UART: read FR: " + ret.toString(16));
        return ret;
    });

    this.register_writable("CR", 0x300, function() {
        //logger.log(that.name + ": read CR");
        return that.data["CR"];
    }, function(halfword) {
        //logger.log(that.name + ": write CR: " + halfword.toString(16));
        var old = (that.data["CR"] & 1) ? true : false;
        that.enabled = (halfword & 1) ? true : false;
        that.data["CR"] = halfword;
        if (!old && that.enabled) {
            //logger.log(that.name + ": enabled");
            that.enable();
        }
        //display.log("RX" + bitops.get_bit(halfword, 9));
        //display.log("TX" + bitops.get_bit(halfword, 8));
        if (halfword & 0x200)
            that.rx_enabled = true;
        else
            that.rx_enabled = false;
        if (halfword & 0x100)
            that.tx_enabled = true;
        else
            that.tx_enabled = false;
    });

    this.register_writable("IBRD", 0);  // TODO
    this.register_writable("FBRD", 0);  // TODO

    this.register_writable("LCR_H", 0, null, function(onebyte) {
        //logger.log(that.name + ": write LCR_H: " + onebyte.toString(16));
        that.update_fifo_onoff(onebyte);
        that.data["LCR_H"] = onebyte;
    });

    this.register_writable("IFLS", 0, null, function(halfword) {
        //logger.log(that.name + ": write IFLS: " + halfword.toString(16));
        that.update_fifo_level(halfword);
        that.data["IFLS"] = halfword;
    });

    this.register_writable("IMSC", 0, null, function(halfword) {
        //logger.log(that.name + ": write IMSC: " + halfword.toString(16));
        that.tx_int_enabled = (halfword & 0x20) ? true : false;
        that.rx_int_enabled = (halfword & 0x10) ? true : false;
        if (that.tx_int_enabled && that.tx_fifo.length === 0)
            that.gic.send_interrupt(that.irq);
        that.data["IMSC"] = halfword;
    });

    this.register_readonly("MIS", 0, function() {
        var ret = 0;
        if (!that.tx_fifo.length)
            ret += (1 << 5);
        if (that.rx_fifo.length)
            ret += (1 << 4);
        //logger.log(that.name + ": read MIS: " + ret);
        return ret;
    });

    this.register_writeonly("ICR", function(halfword) {
        //logger.log(that.name + ": write ICR: " + halfword.toString(16));
        that.data["ICR"] = halfword;
    });
}

UART.prototype = new Device();

UART.prototype.enable = function() {
    if (this.write_to_terminal) {
        while (this.tx_fifo.length > 0)
            this.write_to_terminal(this.tx_fifo.shift());
    }
    // TODO
};

UART.prototype.output_char = function(str) {
    this.tx_fifo.push(str);
    //if (!this.enabled)
    //    return;
    if (this.write_to_terminal) {
        while (this.tx_fifo.length > 0)
            this.write_to_terminal(this.tx_fifo.shift());
    }
    //if (this.tx_int_enabled)
    //    if (!this.fifo_enabled || this.tx_fifo.length > this.tx_fifo_level)
};

UART.prototype.input_char = function(str) {
    this.rx_fifo.push(str);
    //if (!this.enabled)
    //    return;
    if (this.rx_int_enabled) {
        if (!this.fifo_enabled || this.rx_fifo.length > this.rx_fifo_level) {
            this.gic.send_interrupt(this.irq);
        } else {
            var that = this;
            setTimeout(function () {
                    if (that.rx_fifo.length > 0)
                        that.gic.send_interrupt(that.irq);
                }, 10);
        }
    }
};

UART.prototype.update_fifo_onoff = function(halfword) {
    this.fifo_enabled = (bitops.get_bit(halfword, 4) ? true : false);
};

UART.prototype.update_fifo_level = function(halfword) {
    switch (bitops.get_bits(halfword, 5, 3)) {
        case 0:
            this.rx_fifo_level = this.fifo_length / 8;
            break;
        case 1:
            this.rx_fifo_level = this.fifo_length / 4;
            break;
        case 2:
            this.rx_fifo_level = this.fifo_length / 2;
            break;
        case 3:
            this.rx_fifo_level = this.fifo_length * 3 / 4;
            break;
        case 4:
            this.rx_fifo_level = this.fifo_length * 7 / 8;
            break;
        default:
            throw "UART: unknown RX FIFO level: " + halfword;
            break;
    }
    switch (bitops.get_bits(halfword, 2, 0)) {
        case 0:
            this.tx_fifo_level = this.fifo_length / 8;
            break;
        case 1:
            this.tx_fifo_level = this.fifo_length / 4;
            break;
        case 2:
            this.tx_fifo_level = this.fifo_length / 2;
            break;
        case 3:
            this.tx_fifo_level = this.fifo_length * 3 / 4;
            break;
        case 4:
            this.tx_fifo_level = this.fifo_length * 7 / 8;
            break;
        default:
            throw "UART: unknown TX FIFO level: " + halfword;
            break;
    }
};

UART.prototype.save = function() {
    return Device.prototype.save.call(this);
    // FIXME
    //params.tx_fifo = this.tx_fifo;
    //params.rx_fifo = this.rx_fifo;
};

UART.prototype.restore = function(params) {
    Device.prototype.restore.call(this, params);
    this.update_fifo_onoff(this.data["LCR_H"]);
    this.enabled = (bitops.get_bit(this.data["CR"], 0) ? true : false);
    this.update_fifo_level(this.data["IFLS"]);
    this.tx_int_enabled = (bitops.get_bit(this.data["IMSC"], 5) ? true : false);
    this.rx_int_enabled = (bitops.get_bit(this.data["IMSC"], 4) ? true : false);
};

UART.prototype.dump = function() {
    display.log("Enabled=" + (this.enabled ? "yes" : "no"));
    display.log("FIFO=" + (this.fifo_enabled ? "enabled" : "disabled") + ", RX INT=" + (this.rx_int_enabled ? "enabled" : "disabled") + ", TX INT=" + (this.tx_int_enabled ? "enabled" : "disabled"));
    display.log("FIFO length=" + this.fifo_length);
    display.log("RX FIFO: " + this.rx_fifo.length);
    display.log("TX FIFO: " + this.tx_fifo.length);
    display.log("RX FIFO level=" + this.rx_fifo_level);
    display.log("TX FIFO level=" + this.tx_fifo_level);
};

/*
 * Physical Memory
 */
function Memory(size) {
    this.size = size;

    this.mem = null;
    this.mem_byte = null;
    this.mem_halfword = null;
    this.mem_word = null;
}

Memory.prototype.init = function(buffer) {
    if (buffer)
        this.mem = buffer;
    else
        this.mem = new ArrayBuffer(this.size);
    this.mem_byte = new Uint8Array(this.mem, 0, this.size);
    this.mem_halfword = new Uint16Array(this.mem, 0, this.size / 2);
    this.mem_word = new Uint32Array(this.mem, 0, this.size / 4);
};

/*
 * Memory Controller
 * Physical Memory Operations
 * I/O Operations
 */
function MemoryController(options, memory, io) {
    this.options = options;
    this.memory = memory;
    this.io = io;
}

MemoryController.prototype.ld_byte = function(addr) {
    if (this.io.read[addr] !== undefined)
        return this.io.ld_byte(addr);
    //assert(addr < this.memory.size, "ld_byte: addr < this.memory.size: " + toStringHex32(addr));
    return this.memory.mem_byte[addr];
};

MemoryController.prototype.ld_byte_fast = function(addr) {
    return this.memory.mem_byte[addr];
};

MemoryController.prototype.st_byte = function(addr, onebyte) {
    //assert(onebyte >= 0, "onebyte >= 0");
    if (this.io.write[addr] !== undefined) {
        this.io.st_byte(addr, onebyte);
        return;
    }
    //assert(addr < this.memory.size, "st_byte: addr < this.memory.size: " + toStringHex32(addr));
    this.memory.mem_byte[addr] = onebyte;
};

MemoryController.prototype.st_byte_fast = function(addr, onebyte) {
    this.memory.mem_byte[addr] = onebyte;
};

MemoryController.prototype.ld_halfword = function(addr) {
    if (this.io.read[addr] !== undefined)
        return this.io.ld_halfword(addr);
    //assert(addr < this.memory.size, "ld_halfword: addr < this.memory.size: " + toStringHex32(addr));
    if (addr & 1)
        throw "ld_halfword: alignment error!";
    return this.memory.mem_halfword[addr >> 1];
};

MemoryController.prototype.ld_halfword_fast = function(addr) {
    return this.memory.mem_halfword[addr >> 1];
};

MemoryController.prototype.st_halfword = function(addr, halfword) {
    //assert(halfword >= 0, "halfword >= 0");
    if (this.io.write[addr] !== undefined) {
        this.io.st_halfword(addr, halfword);
        return;
    }
    //assert(addr < this.memory.size, "st_halfword: addr < this.memory.size" + toStringHex32(addr));
    if (addr & 1)
        throw "st_halfword: alignment error!";
    this.memory.mem_halfword[addr >> 1] = halfword;
};

MemoryController.prototype.st_halfword_fast = function(addr, halfword) {
    this.memory.mem_halfword[addr >> 1] = halfword;
};

MemoryController.prototype.ld_word = function(addr) {
    if (this.io.read[addr] !== undefined)
        return this.io.ld_word(addr);

    //assert(addr < this.memory.size, "ld_word: addr < this.memory.size: " + toStringHex32(addr));
    if (addr & 3)
        throw "Unaligned ld_word: " + toStringHex32(addr);
    return this.memory.mem_word[addr >>> 2];
};

MemoryController.prototype.ld_word_fast = function(addr) {
    return this.memory.mem_word[addr >>> 2];
};

MemoryController.prototype.st_word = function(addr, word) {
    //assert(word >= 0, "word >= 0");
    if (this.io.write[addr] !== undefined) {
        this.io.st_word(addr, word);
        return;
    }

    //assert(addr < this.memory.size, "st_word: addr < this.memory.size: " + toStringHex32(addr));
    this.memory.mem_word[addr >>> 2] = word;
};

MemoryController.prototype.st_word_fast = function(addr, word) {
    this.memory.mem_word[addr >>> 2] = word;
};

MemoryController.prototype.st_word_unaligned = function(addr, word) {
    //assert(word >= 0, "word >= 0");
    if (this.io.write[addr] !== undefined) {
        this.io.st_word(addr, word);
        return;
    }

    //assert(addr < this.memory.size, "st_word: addr < this.memory.size: " + toStringHex32(addr));
    var align = addr & 3;
    if (align === 0) {
        this.memory.mem_word[addr >>> 2] = word;
    } else if (align == 2) {
        this.st_halfword(addr, word & 0xffff);
        this.st_halfword(addr+2, word >>> 16);
    } else {
        this.st_byte(addr, word & 0xff);
        this.st_byte(addr+1, (word >>> 8) & 0xff);
        this.st_byte(addr+2, (word >>> 16) & 0xff);
        this.st_byte(addr+3, word >>> 24);
    }
};

function System(configs, options) {
    this.configs = configs;
    this.options = options;

    this.is_booted = false;
    this.is_running = false;
    this.tick = 0;
    this.n_instructions = 0;
    this.n_interrupts = 0;
    this.stop_after = 0;
    this.function_stack = new Array();
    this.state_changed_cb = null;
    this.inst_counter = new Array(); 

    // Inherited object has to set own values
    this.irq_base = 0;
    this.taglist_start_addr = 0x0;
    this.io = null;
    this.sysregs = null;
    this.memory = null;
    this.memctlr = null;
    this.cpu = null;
    this.gic = null;
    this.uart0 = null;

    this.N_CONTIGUOUS_EXECUTION = 100000;
    // Chrome supports setTimeout with 1ms
    this.PAUSE_PERIOD = 1;  // in ms
    this.HALT_PERIOD = 10;  // in ms
}

System.prototype.load_binary = function(url, phyaddr, cb) {
    var that = this;
    $.get(url, null, function(data, textStatus, XMLHttpRequest) {
            var length = data.length;
            for (var i = 0; i < length; i++) {
                that.memctlr.st_byte(phyaddr + i, data.charCodeAt(i));
            }
            if (cb)
                cb(that);
        }, "binary");
};

System.prototype.run = function(system) {
    if (this.options.enable_logger) {
        system.cpu.log_regs(null);
        system.cpu.print_pc(system.cpu.regs[15], null);
    }
    setTimeout(system.loop.bind(system), system.PAUSE_PERIOD);
};

System.prototype.update_current_function_display = function() {
    var cpu = this.cpu;
    if (this.cpu.cpsr.m != 0x13)
        return;
    if (Symbols[cpu.branch_to]) {
        if (this.options.update_current_function)
            $('#function').val(Symbols[cpu.branch_to]);
        this.function_stack.push([cpu.branch_to, cpu.regs[15]]);
    } else if (this.function_stack.length) {
        var called_addr = this.function_stack[this.function_stack.length-1][1];
        if (cpu.branch_to == (called_addr + 4)) {
            this.function_stack.pop();
            if (this.options.update_current_function) {
                if (this.function_stack.length)
                    $('#function').val(Symbols[this.function_stack[this.function_stack.length-1][0]]);
                else
                    $('#function').val('');
            }
        }
    }
};

System.prototype.count_inst = function(inst_name) {
    if (!this.inst_counter[inst_name])
        this.inst_counter[inst_name] = 0;
    this.inst_counter[inst_name] += 1;
};

System.prototype.loop = function() {
    var cpu = this.cpu;
    var options = this.options;
    var gic = this.gic;
    var timeout = this.PAUSE_PERIOD;
    try {
        if (!this.is_running)
            return;
        var timeslice = this.N_CONTIGUOUS_EXECUTION;
        var remained = timeslice;
        if (options.enable_stopper && this.stop_after)
            remained = this.stop_after;
        var n_executed = 0;

        var suppress_interrupts = options.suppress_interrupts;
        var stop_address = options.enable_stopper ? options.stop_address : null;
        var stop_instruction = options.enable_stopper ? options.stop_instruction : null;
        var enable_logger = options.enable_logger;
        var update_current_function = options.update_current_function;
        var enable_branch_tracer = options.enable_branch_tracer;
        var stop_at_every_branch = options.enable_stopper && options.stop_at_every_branch;
        var stop_at_every_funccall = options.enable_stopper && options.stop_at_every_funccall;
        var stop_counter = options.enable_stopper ? options.stop_counter : null;
        var stop_after = options.enable_stopper && this.stop_after;
        var enable_instruction_counting = options.enable_instruction_counting;

        do {
            if (!suppress_interrupts &&
                !cpu.cpsr.i && gic.is_pending()) {
                var irq = gic.pick_interrupt();
                if (irq != null) {
                    this.n_interrupts += 1;
                    cpu.is_halted = false;
                    cpu.interrupt(irq);
                } else {
                    throw "irq == null";
                }
            }
            // See WFI instruction
            if (cpu.is_halted) {
                timeout = this.HALT_PERIOD;
                break;
            }

            var will_stop = false;
            cpu.branch_to = null;
            var pc = cpu.regs[15];
            //assert(pc >= 0 && pc < 0x100000000, pc);
            if (pc == stop_address)
                throw "STOP";

            /*
             * Fetch an instruction
             */
            var inst = null;
            try {
                inst = cpu.fetch_instruction(pc);
            } catch (e) {
                if (e.toString() == "PF") {
                    cpu.prefetch_abort();
                    continue;
                } else {
                    throw e;
                }
            }
            //assert(inst != undefined, "inst != undefined");

            if (inst == stop_instruction)
                throw "STOP";

            var oldregs;
            if (enable_logger) {
                oldregs = new Array();
                cpu.store_regs(oldregs);
            }
            if (cpu.is_valid(inst)) { // NOP or NULL?
                /*
                 * Decode an instruction
                 */
                var inst_name = null;
                try {
                    inst_name = cpu.decode(inst, pc);
                } catch (e) {
                    if (e.toString() == "UND") {
                        cpu.undefined_instruction();
                        continue;
                    } else {
                        throw e;
                    }
                }

                if (enable_instruction_counting)
                    this.count_inst(inst_name);

                /*
                 * Execute an instruction
                 */
                if (cpu.cond(inst)) {
                    try {
                        cpu.exec(inst_name, inst, pc);
                    } catch (e) {
                        if (e.toString() == "PF") {
                            cpu.data_abort();
                            continue;
                        } else if (e.toString() == "SUPERVISOR") {
                            cpu.supervisor();
                            continue;
                        } else {
                            throw e;
                        }
                    }
                }
            }

            if (cpu.branch_to) {
                //assert(cpu.branch_to <= 0xffffffff && cpu.branch_to > 0, cpu.branch_to);
                // FIXME: the stack of functions is not correct when interrupts happen
                if (update_current_function)
                    this.update_current_function_display();
                if (enable_branch_tracer)
                    btracer.log(cpu.branch_to, cpu.regs[15], this.function_stack.length);

                cpu.regs[15] = cpu.branch_to;
                cpu.print_pc(cpu.regs[15], pc);
                if (stop_at_every_branch)
                    will_stop = true;
                if (stop_at_every_funccall) {
                    if (Symbols[cpu.branch_to])
                        will_stop = true;
                }
            } else {
                cpu.regs[15] = pc + 4;
            }
            if (enable_logger)
                cpu.log_regs(oldregs);

            this.n_instructions += 1;

            if (this.n_instructions == stop_counter)
                will_stop = true;
            if (stop_after && --remained <= 0)
                will_stop = true;

            n_executed += 1;
            if (will_stop)
                throw "STOP";
        } while (--timeslice > 0);

        this.tick += n_executed;
        setTimeout(this.loop.bind(this), timeout);
    } catch (e) {
        this.tick += n_executed;
        if (e.toString() == "STOP") {
            this.stop_after = 0;
            var msg = "stopped at PC=" + cpu.regs[15].toString(16);
            if (Symbols[cpu.regs[15]])
                msg += " " + Symbols[cpu.regs[15]];
            display.log(msg);
        } else {
            display.log("Catch an exception(" + toStringHex32(cpu.regs[15]) + "): " + e);
            if (e.stack)
                display.log(e.stack);
        }
        this.is_running = false;
        this.state_changed();
    }
};

System.prototype.setup_tagged_list = function(params) {
    var start_addr = this.taglist_start_addr;
    var off = 0;
    // ATAG header = size(u32) + type(u32)
    // ATAG_CORE header
    this.memctlr.st_word_unaligned(start_addr + off, 2); // no data
    off += 4;
    this.memctlr.st_word_unaligned(start_addr + off, 0x54410001);
    off += 4;
    // ATAG_MEM header
    this.memctlr.st_word_unaligned(start_addr + off, 4);
    off += 4;
    this.memctlr.st_word_unaligned(start_addr + off, 0x54410002);
    off += 4;
    // ATAG_MEM
    this.memctlr.st_word_unaligned(start_addr + off, this.memory.size); // size
    off += 4;
    this.memctlr.st_word_unaligned(start_addr + off, 0); // start address
    off += 4;
    // ATAG_RAMDISK header
    this.memctlr.st_word_unaligned(start_addr + off, 5);
    off += 4;
    this.memctlr.st_word_unaligned(start_addr + off, 0x54410004);
    off += 4;
    // ATAG_RAMDISK
    this.memctlr.st_word_unaligned(start_addr + off, 0); // load
    off += 4;
    this.memctlr.st_word_unaligned(start_addr + off, params.initrd_decomp_size/1024); // decompressed size in _kilo_ bytes
    off += 4;
    this.memctlr.st_word_unaligned(start_addr + off, 0); // unused
    off += 4;
    // ATAG_INITRD2 header
    this.memctlr.st_word_unaligned(start_addr + off, 4);
    off += 4;
    this.memctlr.st_word_unaligned(start_addr + off, 0x54420005);
    off += 4;
    // ATAG_INITRD2
    this.memctlr.st_word_unaligned(start_addr + off, 0x00800000); // start address
    off += 4;
    this.memctlr.st_word_unaligned(start_addr + off, params.initrd_size); // size in bytes
    off += 4;
    // ATAG_CMDLINE header
    var size = params.cmdline.length;
    // FIXME
    this.memctlr.st_word_unaligned(start_addr + off, 2 + Math.ceil((size + 3)/4) + 1);
    off += 4;
    this.memctlr.st_word_unaligned(start_addr + off, 0x54410009);
    off += 4;
    // ATAG_CMDLINE
    for (var i in params.cmdline) {
        this.memctlr.st_byte(start_addr + off, params.cmdline.charCodeAt(i));
        off += 1;
    }
    // ATAG_NONE header
    this.memctlr.st_word_unaligned(start_addr + off, 0); // not 2
    off += 4;
    this.memctlr.st_word_unaligned(start_addr + off, 0x00000000);
    off += 4;
};

System.prototype.boot = function(params) {
    this.memory.init();
    this.setup_tagged_list(params);

    // Write platform specific procedure here

    this.is_booted = true;
    this.is_running = true;
    this.state_changed();
    display.log("booting up");
};

System.prototype.stop = function() {
    this.is_running = false;
    this.state_changed();
    display.log("stopped");
};

System.prototype.restart = function() {
    display.log("restarting");
    this.is_running = true;
    this.state_changed();
    this.run(this);
};

System.prototype.save_memory = function() {
    display.log("saving whole memory to a file");
    // Have to pass ArrayBufferView, not ArrayBuffer (deprecated)
    this.fs.fileWrite("mem.dat", this.memory.mem_byte, {text: false});
};

System.prototype.restore_memory = function(handler) {
    var that = this;
    var _handler = function(data) {
        that.memory = new Memory(data.byteLength);
        that.memory.init(data);
        that.memctlr.memory = that.memory;
        display.log("memory restored");
        handler();
    };
    display.log("restoring memory from a file");
    this.fs.fileRead("mem.dat", {text: false}, _handler);
};

System.prototype.save = function() {
    return;
};

System.prototype.restore = function() {
    return;
};

System.prototype.dump = function() {
    return;
};

System.prototype.dump_stack = function() {
    display.wipe();
    this.cpu.dump_stack();
};

System.prototype.dump_page_tables = function() {
    display.wipe();
    this.cpu.mmu.show_current_tables();
};

System.prototype.dump_phymem = function(addr) {
    display.wipe();
    this.cpu.mmu.dump_phymem(addr);
};

System.prototype.dump_virmem = function(addr) {
    display.wipe();
    this.cpu.mmu.dump_virmem(addr);
};

System.prototype.dump_io = function() {
    display.wipe();
    this.io.dump();
};

System.prototype.test_terminal = function() {
    for (var i=0; i < 128; i++) {
        var str = String.fromCharCode(i);
        display.log(str);
        this.uart0.write_to_terminal(str);
    }
};

System.prototype.state_changed = function() {
    if (this.state_changed_cb)
        this.state_changed_cb(this);
};

System.prototype.set_state_changed_cb = function(cb) {
    this.state_changed_cb = cb;
};

/*
 * Versatile Express Core Tile Cortex A9x4
 */
function VersatileExpress(configs, options) {
    this.configs = configs;
    this.options = options;

    this.irq_base = 32;
    this.taglist_start_addr = 0x100;

    this.io = new SystemIO(options);
    this.sysregs = new SystemRegisters(0x10000000, options);
    this.io.register_io("sysregs", this.sysregs);
    this.memory = new Memory(this.configs.memory_size);
    this.memctlr = new MemoryController(options, this.memory, this.io);
    this.cpu = new ARMv7_CPU(options, this.memctlr);
    this.gic = new GenericInterruptController(0x1e000000);
    this.io.register_io("GIC", this.gic);
    this.uart0 = new UART(0, 0x10009000, this.irq_base + 5, this.gic);
    this.io.register_io("UART0", this.uart0);
    this.timer0 = new DualTimer(0x10011000, this.irq_base + 2, this.gic);
    this.timer1 = new DualTimer(0x10012000, this.irq_base + 2, this.gic);
    this.io.register_io("DualTimer#0", this.timer0);
    this.io.register_io("DualTimer#1", this.timer1);
    this.sysctrl = new SystemController(0x10001000);
    this.io.register_io("SystemController", this.sysctrl);

    // Dummy for Virtio 9P. It will be override if HTML5 FileSystem is available.
    this.virtio_mmio = new UnimplementedDevice(0x10015000);
    this.io.register_io("VirtioMMIO (disabled)", this.virtio_mmio);

    this.fs = new HTML5FileSystem('/emulator', 50 * 1024 * 1024);
}

VersatileExpress.prototype = new System();

VersatileExpress.prototype.enable_virtio_9p = function() {
    this.virtio_mmio = new VirtioMMIO(0x10015000, this.irq_base + 15, this.gic);
    this.virtio_mmio.register_tagname("armjs");
    this.io.register_io("VirtioMMIO", this.virtio_mmio);
    this.virtio_vring = new VirtioVring(this.memctlr, this.virtio_mmio);
    this.virtio_9p = new Virtio9P(this.memctlr, this.virtio_vring);
};

VersatileExpress.prototype.boot = function(params) {
    this.memory.init();

    //this.setup_tagged_list(params);
    /*
     * from http://lxr.linux.no/linux/Documentation/arm/Booting
     * CPU register settings
     * r0 = 0,
     * r1 = machine type number discovered in (3) above.
     * r2 = physical address of tagged list in system RAM, or
     * physical address of device tree block (dtb) in system RAM
     */
    /*
    this.cpu.regs[0] = 0;
    this.cpu.regs[1] = 2272; // vexpress in arch/arm/tools/mach-types
    this.cpu.regs[2] = this.taglist_start_addr; // Typical place
    this.cpu.regs[13] = 0x00100000; // SP
    this.cpu.regs[15] = 0x00100000; // PC
    this.cpu.cpsr.m = 0x13; // 10011 Supervisor mode
    this.cpu.log_cpsr();
    this.load_binary(params.initrd_url, 0x00800000);
    this.load_binary(params.zImage_url, 0x00100000, this.run);
    */
    /*
     * from linux/arch/arm/kernel/head.S
     *
     * This is normally called from the decompressor code.  The requirements
     * are: MMU = off, D-cache = off, I-cache = dont care, r0 = 0,
     * r1 = machine nr, r2 = atags or dtb pointer.
     */
    this.cpu.regs[0] = 0;
    this.cpu.regs[1] = 2272; // vexpress in arch/arm/tools/mach-types
    this.cpu.regs[2] = this.taglist_start_addr; // Typical place
    this.cpu.regs[15] = 0x00008000; // PC
    this.cpu.cpsr.m = 0x13; // 10011 Supervisor mode
    this.cpu.log_cpsr();
    this.load_binary(params.initrd_url, 0x00800000);
    this.load_binary(params.dtb_url, this.taglist_start_addr);
    this.load_binary(params.Image_url, 0x00008000, this.run);

    this.is_booted = true;
    this.is_running = true;
    this.state_changed();
    display.log("booting up");
};

VersatileExpress.prototype.save = function() {
    var params = Object();
    // Marshal
    params.cpu = this.cpu.save();
    params.cp15 = this.cpu.coprocs[15].save();
    params.mmu = this.cpu.mmu.save();
    params.tick = this.tick;
    params.n_instructions = this.n_instructions;
    params.gic = this.gic.save();
    params.timer0 = this.timer0.save();
    params.timer1 = this.timer1.save();
    params.uart0 = this.uart0.save();
    params.sysctrl = this.sysctrl.save();
    params.virtio_mmio = this.virtio_mmio.save();

    var params_str = JSON.stringify(params);
    this.fs.fileWrite("system.json", params_str, {text: true});
    this.save_memory();
};

VersatileExpress.prototype.restore = function() {
    var that = this;
    var handler = function(data) {
        var params = JSON.parse(data);
        // Unmarshal
        that.cpu.restore(params.cpu);
        var cp15 = that.cpu.coprocs[15];
        cp15.restore(params.cp15);
        that.cpu.mmu.restore(params.mmu);
        that.tick = params.tick;
        that.n_instructions = params.n_instructions;
        that.gic.restore(params.gic);
        that.timer0.restore(params.timer0);
        that.timer1.restore(params.timer1);
        that.uart0.restore(params.uart0);
        that.sysctrl.restore(params.sysctrl);
        that.virtio_mmio.restore(params.virtio_mmio);

        that.restore_memory(function() {
            display.log("system restored");
            that.is_booted = true;
            that.is_running = false;
            that.state_changed();
        });
    };
    this.fs.fileRead("system.json", {text: true}, handler);
};

VersatileExpress.prototype.dump = function() {
    display.wipe();
    display.log("CPU:");
    this.cpu.dump();
    display.log("\nMMU:");
    this.cpu.mmu.dump();
    display.log("\nCP15:");
    this.cpu.coprocs[15].dump();
    display.log("\nGIC:");
    this.gic.dump();
    display.log("\nSysRegs:");
    this.sysregs.dump();
    display.log("\nTimer0:");
    this.timer0.dump();
    display.log("\nTimer1:");
    this.timer1.dump();
    display.log("\nUART0:");
    this.uart0.dump();
    display.log("\n");
    display.log("tick=" + this.tick);
    display.log("insts=" + this.n_instructions);
    display.log("interrupts=" + this.n_interrupts);
    display.log("pending interrupts=" + this.gic.pending_interrupts);
};

