/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
/*
 * System Registers
 */
function SystemRegisters(baseaddr, options) {
    this.baseaddr = baseaddr;
    this.read = new Array();
    this.write = new Array();
    this.data = new Array();

    this.SYS_ID      = this.baseaddr + 0x00;
    this.SYS_SW      = this.baseaddr + 0x04;
    this.SYS_LED     = this.baseaddr + 0x08;
    this.CLOCK_24MHZ = this.baseaddr + 0x5c;
    this.PROCID0     = this.baseaddr + 0x84;

    var sys_id = 0;
    sys_id = bitops.set_bits(sys_id, 31, 28, 1); // Rev B
    sys_id = bitops.set_bits(sys_id, 27, 16, 0x190); // HBI
    sys_id = bitops.set_bits(sys_id, 15, 12, 0xf); // all builds
    sys_id = bitops.set_bits(sys_id, 11, 8, 0x5); // AXI
    sys_id = bitops.set_bits(sys_id, 7, 0, 0); // FPGA build
    this.read[this.SYS_ID] = sys_id;
    this.read[this.SYS_SW] = 0;
    this.read[this.SYS_LED] = 0;

    var procid0 = 0;
    //procid0 = bitops.set_bits(procid0, 31, 24, 0x12); // Cortex-A5
    procid0 = bitops.set_bits(procid0, 31, 24, 0x0c); // CA9x4
    procid0 = bitops.set_bits(procid0, 11, 0, 0x191); // CoreTile Express

    this.read[this.PROCID0] = function() {
        return procid0;
    };
    // 24 MHz clock
    this.data[this.CLOCK_24MHZ] = {
        clock: 0,
        time: (new Date()).getTime(),
        hz: 24*1000*1000
    };
    var sysregs = this;
    this.read[this.CLOCK_24MHZ] = function() {
        var now = (new Date()).getTime();
        var clock24mhz = sysregs.data[sysregs.CLOCK_24MHZ];
        var old = clock24mhz.time;
        clock24mhz.time = now;
        var passing_ticks = (now - old) * (clock24mhz.hz / 1000);
        clock24mhz.clock = (clock24mhz.clock + passing_ticks) % 0x100000000;
        return clock24mhz.clock;
    };
    // XXX: update clock to prevent overflow
    // FIXME: should stop when the emulator is stopped
    function update_clock() {
        sysregs.read[sysregs.CLOCK_24MHZ]();
        setTimeout(update_clock, 1000);
    }
    setTimeout(update_clock, 1000);
    this.write[sysregs.CLOCK_24MHZ] = function(word) {
        throw "24MHz clock write";
    };
}

function UnimplementedDevice(baseaddr) {
    this.baseaddr = baseaddr;

    this.read = new Array();
    this.write = new Array();

    this.read[this.baseaddr + 0xfe0] = 0;
    this.read[this.baseaddr + 0xfe4] = 0;
    this.read[this.baseaddr + 0xfe8] = 0;
    this.read[this.baseaddr + 0xfec] = 0;
    this.read[this.baseaddr + 0xff0] = 0;
    this.read[this.baseaddr + 0xff4] = 0;
    this.read[this.baseaddr + 0xff8] = 0;
    this.read[this.baseaddr + 0xffc] = 0;
};

/*
 * ARM PrimeCell Multimedia Card Interface (PL180)
 */
function PL180(baseaddr) {
    this.baseaddr = baseaddr;

    this.read = new Array();
    this.write = new Array();

    var pl180 = this;

    this.MCIPeriphID0 = this.baseaddr + 0xfe0;
    this[this.MCIPeriphID0] = 0;
    //this[this.MCIPeriphID0] = bitops.set_bits(this[this.MCIPeriphID0], 7, 0, 0x80);
    this.read[this.MCIPeriphID0] = function() {
        return pl180[pl180.MCIPeriphID0];
    };

    this.MCIPeriphID1 = this.baseaddr + 0xfe4;
    this[this.MCIPeriphID1] = 0;
    //this[this.MCIPeriphID1] = bitops.set_bits(this[this.MCIPeriphID1], 7, 4, 1);
    //this[this.MCIPeriphID1] = bitops.set_bits(this[this.MCIPeriphID1], 3, 0, 1);
    this.read[this.MCIPeriphID1] = function() {
        return pl180[pl180.MCIPeriphID1];
    };

    this.MCIPeriphID2 = this.baseaddr + 0xfe8;
    this[this.MCIPeriphID2] = 0;
    //this[this.MCIPeriphID2] = bitops.set_bits(this[this.MCIPeriphID2], 7, 4, 0);
    //this[this.MCIPeriphID2] = bitops.set_bits(this[this.MCIPeriphID2], 3, 0, 4);
    this.read[this.MCIPeriphID2] = function() {
        return pl180[pl180.MCIPeriphID2];
    };

    this.MCIPeriphID3 = this.baseaddr + 0xfec;
    this[this.MCIPeriphID3] = 0;
    //this[this.MCIPeriphID3] = bitops.set_bits(this[this.MCIPeriphID3], 7, 0, 0);
    this.read[this.MCIPeriphID3] = function() {
        return pl180[pl180.MCIPeriphID3];
    };

    this.MCIPCellID0 = this.baseaddr + 0xff0;
    this[this.MCIPCellID0] = 0;
    //this[this.MCIPCellID0] = bitops.set_bits(this[this.MCIPCellID0], 7, 0, 0x0d);
    this.read[this.MCIPCellID0] = function() {
        return pl180[pl180.MCIPCellID0];
    };

    this.MCIPCellID1 = this.baseaddr + 0xff4;
    this[this.MCIPCellID1] = 0;
    //this[this.MCIPCellID1] = bitops.set_bits(this[this.MCIPCellID1], 7, 0, 0xf0);
    this.read[this.MCIPCellID1] = function() {
        return pl180[pl180.MCIPCellID1];
    };

    this.MCIPCellID2 = this.baseaddr + 0xff8;
    this[this.MCIPCellID2] = 0;
    //this[this.MCIPCellID2] = bitops.set_bits(this[this.MCIPCellID2], 7, 0, 0x05);
    this.read[this.MCIPCellID2] = function() {
        return pl180[pl180.MCIPCellID2];
    };

    this.MCIPCellID3 = this.baseaddr + 0xffc;
    this[this.MCIPCellID3] = 0;
    //this[this.MCIPCellID3] = bitops.set_bits(this[this.MCIPCellID3], 7, 0, 0xb1);
    this.read[this.MCIPCellID3] = function() {
        return pl180[pl180.MCIPCellID3];
    };
}

/*
 * Synchronous Serial Port (PL022)
 */
function SSP(baseaddr, irq, gic) {
}

/*
 * PS2 Keyboard/Mouse Interface (PL050)
 */
function KMI(baseaddr, irq, gic) {
    this.baseaddr = baseaddr;
    this.irq = irq;
    this.gic = gic;

    kmi = this;
    this.read = new Array();
    this.write = new Array();
    this.char_buffer = new Array();

    this.CR = this.baseaddr + 0xfe0;
    this.STAT = this.baseaddr + 0xfe4;
    this.DATA = this.baseaddr + 0xfe8;
    this.CLKDIV = this.baseaddr + 0xfec;
    this.IR = this.baseaddr + 0xff0;

    // KMICR Control register.
    this.read[this.CR] = function() {
        return 0;
    };
    this.write[this.CR] = function(sixbits) {
        throw "KMI: write CR: " + sixbits.toString(2);
    };

    // KMISTAT Status register.
    //this.read[this.STAT] = 0x43;
    this.read[this.STAT] = function() {
        if (kmi.char_buffer.length > 0)
            return 1 << 4 | 0x43;
        else
            return 0x43;
    };
    // KMIDATA Received data (read)/ Data to be transmitted (write).
    this.read[this.DATA] = function() {
        if (kmi.char_buffer.length > 0)
            return kmi.char_buffer.shift().charCodeAt(0);
        else
            return 0;
    };
    this.write[this.DATA] = function(word) {
        throw "KMI: write DATA: " + word;
    };

    // KMICLKDIV Clock divisor register.
    this.read[this.CLKDIV] = function() {
        return 0;
    };
    this.write[this.CLKDIV] = function(fourbits) {
        throw "KMI: write CLKDIV: " + fourbits.toString(2);
        display.log("KMI: write CLKDIV: " + fourbits.toString(2));
        this[this.CLKDIV] = fourbits;
    };
    // KMIIR Interrupt status register.
    this.read[this.IR] = function() {
        return 0;
    };

    this.read[this.baseaddr + 0xff4] = 0;
    this.read[this.baseaddr + 0xff8] = 0;
    this.read[this.baseaddr + 0xffc] = 0;
}

KMI.prototype.receive_char = function(c) {
    display.log("KMI: received: " + c);
    this.char_buffer.push(c);
    this.gic.send_interrupt(this.irq);
};

/*
 * ARM PrimeCell Real Time Clock (PL031)
 */
function RTC() {
    this.read = new Array();
    this.write = new Array();
    this.read[0x10017fe0] = 0;
    this.read[0x10017fe4] = 0;
    this.read[0x10017fe8] = 0;
    this.read[0x10017fec] = 0;
    this.read[0x10017ff0] = 0;
    this.read[0x10017ff4] = 0;
    this.read[0x10017ff8] = 0;
    this.read[0x10017ffc] = 0;
}

function GenericInterruptController() {
    this.read = new Array();
    this.write = new Array();
    this.enabled = false;
    this.pending_interrupts = new Array();
    this.sent_irqs = new Array();

    this.n_supported_irqs = 64;
    // 64 = 32 * (ITLinesNumber + 1)
    this.ITLinesNumber = this.n_supported_irqs / 32 - 1;
    this.n_supported_cpus = 1;
    this.CPUNumber = 0;

    /*
     * Distributor registers
     */
    var gic = this;
    // Distributor Control Register (ICDDCR)
    this.ICDDCR = 0x1e001000;
    this[this.ICDDCR] = 0;
    this.read[this.ICDDCR] = function() {
        return gic[gic.ICDDCR];
    };
    this.write[this.ICDDCR] = function(word) {
        if (bitops.get_bit(word, 0)) {
            gic.enabled = true;
            display.log("GIC: started monitoring interrupts");
        } else {
            gic.enabled = false;
            display.log("GIC: stopped monitoring interrupts");
        }
        return gic[gic.ICDDCR] = word;
    };

    // Interrupt Controller Type Register (ICDICTR)
    // [4:0]: ITLinesNumber
    // TODO
    this.ICDICTR = 0x1e001004;
    this[this.ICDICTR] = 0;
    this[this.ICDICTR] = bitops.set_bits(this[this.ICDICTR], 7, 5, this.CPUNumber);
    this[this.ICDICTR] = bitops.set_bits(this[this.ICDICTR], 4, 0, this.ITLinesNumber);
    this.read[this.ICDICTR] = function() {
        return gic[gic.ICDICTR];
    };

    var i;
    // Interrupt Configuration Registers (ICDICFRn)
    for (i=0; i < 2*(this.ITLinesNumber+1); i++) {
        this["ICDICFR" + i] = 0x1e001c00 + i*4;
        this[gic["ICDICFR" + i]] = 0;
        this.read[this["ICDICFR" + i]] = function() {
            return gic[gic["ICDICFR" + i]];
        };
        this.write[this["ICDICFR" + i]] = function(word) {
            // TODO
            gic[gic["ICDICFR" + i]] = word;
        };
    }
    // Interrupt Processor Targets Registers (ICDIPTRn)
    for (i=0; i < 8*(this.ITLinesNumber+1); i++) {
        this["ICDIPTR" + i] = 0x1e001800 + i*4;
        this[gic["ICDIPTR" + i]] = 0;
        this.read[this["ICDIPTR" + i]] = function() {
            return gic[gic["ICDIPTR" + i]];
        };
        this.write[this["ICDIPTR" + i]] = function(word) {
            // TODO
            gic[gic["ICDIPTR" + i]] = word;
        };
    }
    // Interrupt Priority Registers (ICDIPRn)
    for (i=0; i < 8*(this.ITLinesNumber+1); i++) {
        this["ICDIPR" + i] = 0x1e001400 + i*4;
        this[gic["ICDIPR" + i]] = 0;
        this.read[this["ICDIPR" + i]] = function() {
            return gic[gic["ICDIPR" + i]];
        };
        this.write[this["ICDIPR" + i]] = function(word) {
            // TODO
            gic[gic["ICDIPR" + i]] = word;
        };
    }
    // Interrupt Clear-Enable Registers (ICDICERn)
    for (i=0; i < (this.ITLinesNumber+1); i++) {
        this["ICDICER" + i] = 0x1e001180 + i*4;
        this[gic["ICDICER" + i]] = 0;
        this.read[this["ICDICER" + i]] = function() {
            return gic[gic["ICDICER" + i]];
        };
        this.write[this["ICDICER" + i]] = function(word) {
            // TODO
            gic[gic["ICDICER" + i]] = word;
        };
    }
    // Interrupt Set-Enable Registers (ICDISERn)
    for (i=0; i < (this.ITLinesNumber+1); i++) {
        this["ICDISER" + i] = 0x1e001100 + i*4;
        this[gic["ICDISER" + i]] = 0;
        this.read[this["ICDISER" + i]] = function() {
            return gic[gic["ICDISER" + i]];
        };
        this.write[this["ICDISER" + i]] = function(word) {
            // TODO
            gic[gic["ICDISER" + i]] = word;
        };
    }

    /*
     * CPU interface registers
     */
    // CPU Interface Control Register (ICCICR)
    this.ICCICR = 0x1e000100;
    this[this.ICCICR] = 0;
    this.write[this.ICCICR] = function(word) {
        // TODO
        gic[gic.ICCICR] = word;
    };

    // Interrupt Priority Mask Register (ICCPMR)
    this.ICCPMR = 0x1e000104;
    this[this.ICCPMR] = 0;
    this.write[this.ICCPMR] = function(word) {
        // TODO
        gic[gic.ICCPMR] = word;
    };

    // Interrupt Acknowledge Register (ICCIAR)
    this.ICCIAR = 0x1e00010c;
    this.read[this.ICCIAR] = function() {
        if (gic.sent_irqs.length === 0) {
            // There is no pending IRQ
            return 1023;
        }
        var irq = gic.sent_irqs[0];
        //display.log("irq=" + irq);
        return irq;
    };

    // End of Interrupt Register (ICCEOIR)
    this.ICCEOIR = 0x1e000110;
    this.write[this.ICCEOIR] = function(word) {
        if (gic.sent_irqs.length === 0)
            return;
        var eoi = word & 0x3ff;
        if (gic.sent_irqs[0] == eoi)
            gic.sent_irqs.shift();
        else
            throw "irq != eoi";
    };
}

GenericInterruptController.prototype.save = function() {
    var params = new Object();
    params.ICDDCR = this[this.ICDDCR];
    var i;
    for (i=0; i < 2*(this.ITLinesNumber+1); i++)
        params["ICDICFR" + i] = this[this["ICDICFR" + i]];
    for (i=0; i < 8*(this.ITLinesNumber+1); i++)
        params["ICDIPTR" + i] = this[this["ICDIPTR" + i]];
    for (i=0; i < 8*(this.ITLinesNumber+1); i++)
        params["ICDIPR" + i] = this[this["ICDIPR" + i]];
    for (i=0; i < (this.ITLinesNumber+1); i++)
        params["ICDICER" + i] = this[this["ICDICER" + i]];
    for (i=0; i < (this.ITLinesNumber+1); i++)
        params["ICDISER" + i] = this[this["ICDISER" + i]];
    params.ICCICR = this[this.ICCICR];
    params.ICCPMR = this[this.ICCPMR];
    params.pending_interrupts = this.pending_interrupts;
    params.sent_irqs = this.sent_irqs;
    return params;
};

GenericInterruptController.prototype.restore = function(params) {
    var i;
    this[this.ICDDCR] = params.ICDDCR;
    if (bitops.get_bit(this[this.ICDDCR], 0))
        this.enabled = true;
    else
        this.enabled = false;
    for (i=0; i < 2*(this.ITLinesNumber+1); i++)
        this[this["ICDICFR" + i]] = params["ICDICFR" + i];
    for (i=0; i < 8*(this.ITLinesNumber+1); i++)
        this[this["ICDIPTR" + i]] = params["ICDIPTR" + i];
    for (i=0; i < 8*(this.ITLinesNumber+1); i++)
        this[this["ICDIPR" + i]] = params["ICDIPR" + i];
    for (i=0; i < (this.ITLinesNumber+1); i++)
        this[this["ICDICER" + i]] = params["ICDICER" + i];
    for (i=0; i < (this.ITLinesNumber+1); i++)
        this[this["ICDISER" + i]] = params["ICDISER" + i];
    this[this.ICCICR] = params.ICCICR;
    this[this.ICCPMR] = params.ICCPMR;
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
    if (!irq)
        throw "!irq";
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
    display.log("ICDDCR=" + toStringHex32(this[this.ICDDCR]));
    display.log("ICDICTR=" + toStringHex32(this[this.ICDICTR]));

    var header = "ICDICFR:\t";
    var msgs = new Array();
    for (i=0; i < 2*(this.ITLinesNumber+1); i++) {
        name = "ICDICFR" + i;
        val = this[this[name]];
        msgs.push(toStringHex32(val));
    }
    display.log(header + msgs.join(" "));

    header = "ICDIPTR:\t";
    msgs = new Array();
    for (i=0; i < 8*(this.ITLinesNumber+1); i++) {
        name = "ICDIPTR" + i;
        val = this[this[name]];
        msgs.push(toStringHex32(val));
    }
    display.log(header + msgs.join(" "));

    header = "ICDIPR :\t";
    msgs = new Array();
    for (i=0; i < 8*(this.ITLinesNumber+1); i++) {
        name = "ICDIPR" + i;
        val = this[this[name]];
        msgs.push(toStringHex32(val));
    }
    display.log(header + msgs.join(" "));

    header = "ICDICER:\t";
    msgs = new Array();
    for (i=0; i < (this.ITLinesNumber+1); i++) {
        name = "ICDICER" + i;
        val = this[this[name]];
        msgs.push(toStringHex32(val));
    }
    display.log(header + msgs.join(" "));

    header = "ICDISER:\t";
    msgs = new Array();
    for (i=0; i < (this.ITLinesNumber+1); i++) {
        name = "ICDISER" + i;
        val = this[this[name]];
        msgs.push(toStringHex32(val));
    }
    display.log(header + msgs.join(" "));

    display.log("ICCICR=" + toStringHex32(this[this.ICCICR]));
    display.log("ICCPMR=" + toStringHex32(this[this.ICCPMR]));
};

/*
 * ARM Dual-Timer Module (SP804)
 */
function SP804(baseaddr, irq, gic) {
    this.baseaddr = baseaddr;
    this.irq = irq;
    this.gic = gic;

    this.read = new Array();
    this.write = new Array();

    this.DIV = 10;

    sp804 = this;
    // Load Register, TimerXLoad
    this.TimerXLoad1 = this.baseaddr;
    this[this.TimerXLoad1] = 0;
    this.read[this.TimerXLoad1] = function() {
        return sp804[sp804.TimerXLoad1];
    };
    this.write[this.TimerXLoad1] = function(word) {
        // TODO
        sp804[sp804.TimerXLoad1] = word;
        sp804[sp804.TimerXValue1] = word;
    };

    this.TimerXLoad2 = this.baseaddr + 0x20;
    this[this.TimerXLoad2] = 0;
    this.read[this.TimerXLoad2] = function() {
        return sp804[sp804.TimerXLoad2];
    };
    this.write[this.TimerXLoad2] = function(word) {
        // TODO
        sp804[sp804.TimerXLoad2] = word;
        sp804[sp804.TimerXValue2] = word;
    };

    // Current Value Register, TimerXValue
    // Read-only
    this.TimerXValue1 = this.baseaddr + 0x04;
    this[this.TimerXValue1] = 0xffffffff;
    this.read[this.TimerXValue1] = function() {
        return sp804[sp804.TimerXValue1];
    };
    this.write[this.TimerXValue1] = function() {
        // NOP
        // This is a Linux kernel bug??
    };

    this.TimerXValue2 = this.baseaddr + 0x24;
    this[this.TimerXValue2] = 0xffffffff;
    this.read[this.TimerXValue2] = function() {
        return sp804[sp804.TimerXValue2];
    };
    this.write[this.TimerXValue2] = function() {
        // NOP
        // This is a Linux kernel bug??
    };

    // Control Register, TimerXControl
    this.TimerXControl1 = this.baseaddr + 0x08;
    this[this.TimerXControl1] = {TimerEn:0, TimerMode:0, IntEnable:1, TimerPre:0, TimerSize:0, OneShot:0, value:0};
    this.write[this.TimerXControl1] = function(word) {
        sp804.write_TimerXControl1(word);
    };

    this.TimerXControl2 = this.baseaddr + 0x28;
    this[this.TimerXControl2] = {TimerEn:0, TimerMode:0, IntEnable:1, TimerPre:0, TimerSize:0, OneShot:0, value:0};
    this.write[this.TimerXControl2] = function(word) {
        sp804.write_TimerXControl2(word);
    };

    // Interrupt Clear Register. TimerXIntClr
    this.TimerXIntClr1 = this.baseaddr + 0x0c;
    this.write[this.TimerXIntClr1] = function(word) {
        // TODO
        //display.log("TimerXIntClr1: " + word);
    };

    this.TimerXIntClr2 = this.baseaddr + 0x2c;
    this.write[this.TimerXIntClr2] = function(word) {
        // TODO
        //display.log("TimerXIntClr2: " + word);
    };
}

SP804.prototype._write_TimerXControl1 = function(ctl) {
    this[this.TimerXControl1] = ctl;
    if (ctl.TimerEn) {
        // Clear old timer
        clearTimeout(this.timeout_timer1.bind(this));
        var val = this[this.TimerXValue1];
        if (val != 0xffffffff)
            setTimeout(this.timeout_timer1.bind(this), val/this.DIV); // FIXME
    } else {
        clearTimeout(this.timeout_timer1.bind(this));
    }
};

SP804.prototype.write_TimerXControl1 = function(word) {
    this._write_TimerXControl1(this.parse_control_register(word));
};

SP804.prototype._write_TimerXControl2 = function(ctl) {
    this[this.TimerXControl2] = ctl;
    if (ctl.TimerEn) {
        // Clear old timer
        clearTimeout(this.timeout_timer2.bind(this));
        var val = this[this.TimerXValue2];
        if (val != 0xffffffff)
            setTimeout(this.timeout_timer2.bind(this), val/this.DIV); // FIXME
    } else {
        clearTimeout(this.timeout_timer2.bind(this));
    }
};

SP804.prototype.write_TimerXControl2 = function(word) {
    this._write_TimerXControl2(this.parse_control_register(word));
};

SP804.prototype.save = function() {
    var params = new Object();
    params.TimerXLoad1 = this[this.TimerXLoad1];
    params.TimerXLoad2 = this[this.TimerXLoad2];
    params.TimerXValue1 = this[this.TimerXValue1];
    params.TimerXValue2 = this[this.TimerXValue2];
    params.TimerXControl1 = this[this.TimerXControl1];
    params.TimerXControl2 = this[this.TimerXControl2];
    return params;
};

SP804.prototype.restore = function(params) {
    this[this.TimerXLoad1] = params.TimerXLoad1;
    this[this.TimerXLoad2] = params.TimerXLoad2;
    this[this.TimerXValue1] = params.TimerXValue1;
    this[this.TimerXValue2] = params.TimerXValue2;
    this._write_TimerXControl1(params.TimerXControl1);
    this._write_TimerXControl2(params.TimerXControl2);
};

SP804.prototype.timeout_timer1 = function() {
    //display.log("timer1 timeout");
    if (this[this.TimerXControl1].IntEnable)
        this.gic.send_interrupt(this.irq);
    if (!this[this.TimerXControl1].OneShot) {
        var val = this[this.TimerXValue1];
        if (val != 0xffffffff)
            setTimeout(this.timeout_timer1.bind(this), val/this.DIV);
    }
    // XXX
    this[this.TimerXValue2] -= this[this.TimerXValue1];
};

SP804.prototype.timeout_timer2 = function() {
    //display.log("timer2 timeout");
    if (this[this.TimerXControl2].IntEnable)
        this.gic.send_interrupt(this.irq);
    if (!this[this.TimerXControl2].OneShot) {
        var val = this[this.TimerXValue1];
        if (val != 0xffffffff)
            setTimeout(this.timeout_timer2.bind(this), val/this.DIV);
    }
};

SP804.prototype.parse_control_register = function(value) {
    var ctl = {TimerEn:0, TimerMode:0, IntEnable:0, TimerPre:0, TimerSize:0, OneShot:0, value:0};
    ctl.TimerEn = bitops.get_bit(value, 7);
    ctl.TimerMode = bitops.get_bit(value, 6);
    ctl.IntEnable = bitops.get_bit(value, 5);
    ctl.TimerPre = bitops.get_bits(value, 3, 2);
    ctl.TimerSize = bitops.get_bit(value, 1);
    ctl.OneShot = bitops.get_bit(value, 0);
    ctl.value = value;
    return ctl;
};

SP804.prototype.dump_timer = function(id) {
    var ctl = this[this["TimerXControl" + id]];
    var header = "" + id + ": ";
    var msgs = new Array();
    msgs.push("value=" + toStringHex32(this[this["TimerXValue" + id]]));
    msgs.push("load=" + toStringHex32(this[this["TimerXLoad" + id]]));
    msgs.push("TimerEn=" + (ctl.TimerEn ? "enabled" : "disabled"));
    msgs.push("TimerMode=" + (ctl.TimerMode ? "periodic" : "free-running"));
    msgs.push("IntEnable=" + (ctl.IntEnable ? "enabled" : "disabled"));
    switch (ctl.TimerPre) {
        case 0:
            // 0 stages of prescale, clock is divided by 1
            msgs.push("TimerPre=0:1");
            break;
        case 1:
            // 4 stages of prescale, clock is divided by 16
            msgs.push("TimerPre=4:16");
            break;
        case 2:
            // 8 stages of prescale, clock is divided by 256
            msgs.push("TimerPre=8:256");
            break;
        case 3:
        default:
            throw "TimerPre" + ctl.TimerPre;
            break;
    }
    msgs.push("TimerSize=" + (ctl.TimerSize ? "32bit" : "16bit"));
    msgs.push("OneShot=" + (ctl.OneShot ? "oneshot" : "wrapping"));
    display.log(header + msgs.join(', '));
};

SP804.prototype.dump = function() {
    this.dump_timer(1);
    this.dump_timer(2);
};

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
    //display.log("24MHz clock=" + this.sysregs.data[this.sysregs.CLOCK_24MHZ].clock.toString());
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
    this.id = id;
    this.name = "UART" + id;
    this.baseaddr = baseaddr;
    this.irq = irq;
    this.gic = gic;

    this.read = new Array();
    this.write = new Array();
    this.data = new Array();
    this.write_to_terminal = null;

    this.DR = this.baseaddr + 0;
    this.FR = this.baseaddr + 0x18;
    this.IBRD = this.baseaddr + 0x24;
    this.FBRD = this.baseaddr + 0x28;
    this.LCR_H = this.baseaddr + 0x2c;
    this.CR = this.baseaddr + 0x30;
    this.IFLS = this.baseaddr + 0x34;
    this.IMSC = this.baseaddr + 0x38;
    this.MIS = this.baseaddr + 0x40;
    this.ICR = this.baseaddr + 0x44;

    var uart = this;
    this.write[this.DR] = function(onebyte) {
        if (!(onebyte >=0 && onebyte <= 127))
            throw "Invalid char: " + onebyte;
        if (onebyte >=0 && onebyte < 32 && onebyte != 10 && onebyte != 13)
            display.log("Warning: not char: " + onebyte);
        var str = String.fromCharCode(onebyte);
        //display.log(str);
        uart.output_char(str);
    };
    this.read[this.DR] = function() {
        //logger.log(uart.name + ": read DR");
        if (uart.rx_fifo.length > 0)
            return uart.rx_fifo.shift().charCodeAt(0);
        else
            return 0;
    };

    this.read[this.FR] = function() {
        var ret = 0;
        //ret = bitops.set_bit(ret, 7, (uart.tx_fifo.length === 0 ? 1 : 0));
        if (uart.tx_fifo.length === 0)
            ret += (1 << 7);
        //ret = bitops.set_bit(ret, 6, (uart.rx_fifo.length >= uart.fifo_length ? 1 : 0));
        if (uart.rx_fifo.length >= uart.fifo_length)
            ret += (1 << 6);
        //ret = bitops.set_bit(ret, 5, (uart.tx_fifo.length >= uart.fifo_length ? 1 : 0));
        //ret = bitops.set_bit(ret, 4, (uart.rx_fifo.length === 0 ? 1 : 0));
        if (uart.rx_fifo.length === 0)
            ret += (1 << 4);
        //logger.log("UART: read FR: " + ret.toString(16));
        return ret;
    };

    this.data[this.CR] = 0x300;
    this.read[this.CR] = function() {
        //logger.log(uart.name + ": read CR");
        return uart.data[uart.CR];
    };

    this.write[this.CR] = function(halfword) {
        //logger.log(uart.name + ": write CR: " + halfword.toString(16));
        var old = (uart.data[uart.CR] & 1) ? true : false;
        uart.enabled = (halfword & 1) ? true : false;
        uart.data[uart.CR] = halfword;
        if (!old && uart.enabled) {
            //logger.log(uart.name + ": enabled");
            uart.enable();
        }
        //display.log("RX" + bitops.get_bit(halfword, 9));
        //display.log("TX" + bitops.get_bit(halfword, 8));
        if (halfword & 0x200)
            uart.rx_enabled = true;
        else
            uart.rx_enabled = false;
        if (halfword & 0x100)
            uart.tx_enabled = true;
        else
            uart.tx_enabled = false;
    };

    this.write[this.IBRD] = function(halfword) {
        //logger.log(uart.name + ": write IBRD: " + halfword.toString(16));
        uart.data[uart.IBRD] = halfword;
    };

    this.write[this.FBRD] = function(onebyte) {
        //logger.log(uart.name + ": write FBRD: " + onebyte.toString(16));
        uart.data[uart.FBRD] = onebyte;
    };

    this.write[this.LCR_H] = function(onebyte) {
        //logger.log(uart.name + ": write LCR_H: " + onebyte.toString(16));
        uart.update_fifo_onoff(onebyte);
        uart.data[uart.LCR_H] = onebyte;
    };

    this.data[this.IFLS] = 0;
    this.write[this.IFLS] = function(halfword) {
        //logger.log(uart.name + ": write IFLS: " + halfword.toString(16));
        uart.update_fifo_level(halfword);
        uart.data[uart.IFLS] = halfword;
    };

    this.data[this.IMSC] = 0;
    this.read[this.IMSC] = function() {
        //logger.log(uart.name + ": read IMSC");
        return uart.data[uart.IMSC];
    };
    this.write[this.IMSC] = function(halfword) {
        //logger.log(uart.name + ": write IMSC: " + halfword.toString(16));
        uart.tx_int_enabled = (halfword & 0x20) ? true : false;
        uart.rx_int_enabled = (halfword & 0x10) ? true : false;
        if (uart.tx_int_enabled && uart.tx_fifo.length === 0)
            uart.gic.send_interrupt(uart.irq);
        uart.data[uart.IMSC] = halfword;
    };

    this.sending_rx_irq = false;
    this.read[this.MIS] = function() {
        var ret = 0;
        if (!uart.tx_fifo.length)
            ret += (1 << 5);
        if (uart.sending_rx_irq)
            ret += (1 << 4);
        //logger.log(uart.name + ": read MIS: " + ret);
        return ret;
    };

    this.data[this.ICR] = 0;
    this.write[this.ICR] = function(halfword) {
        //logger.log(uart.name + ": write ICR: " + halfword.toString(16));
        if (halfword & 0x10)
            uart.sending_rx_irq = false;
        uart.data[uart.ICR] = halfword;
    };

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
}

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
            var uart = this;
            setTimeout(function () {
                    if (uart.rx_fifo.length > 0)
                        uart.gic.send_interrupt(uart.irq);
                }, 100);
        }
        this.sending_rx_irq = true;
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
    var params = new Object();
    for (var i in this.data) {
        params[i] = this.data[i];
    }
    return params;
    // FIXME
    //params.tx_fifo = this.tx_fifo;
    //params.rx_fifo = this.rx_fifo;
};

UART.prototype.restore = function(params) {
    for (var i in this.data) {
        this.data[i] = params[i];
    }
    this.update_fifo_onoff(this.data[this.LCR_H]);
    this.enabled = (bitops.get_bit(this.data[this.CR], 0) ? true : false);
    this.update_fifo_level(this.data[this.IFLS]);
    this.tx_int_enabled = (bitops.get_bit(this.data[this.IMSC], 5) ? true : false);
    this.rx_int_enabled = (bitops.get_bit(this.data[this.IMSC], 4) ? true : false);
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
    //ea += ((15 + 3) & ~3);
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
    if (this.io.read[addr])
        return this.io.ld_byte(addr);
    //assert(addr < this.memory.size, "ld_byte: addr < this.memory.size: " + toStringHex32(addr));
    return this.memory.mem_byte[addr];
};

MemoryController.prototype.st_byte = function(addr, onebyte) {
    //assert(onebyte >= 0, "onebyte >= 0");
    if (this.io.write[addr]) {
        this.io.st_byte(addr, onebyte);
        return;
    }
    //assert(addr < this.memory.size, "st_byte: addr < this.memory.size: " + toStringHex32(addr));
    this.memory.mem_byte[addr] = onebyte;
};

MemoryController.prototype.ld_halfword = function(addr) {
    if (this.io.read[addr])
        return this.io.ld_halfword(addr);
    //assert(addr < this.memory.size, "ld_halfword: addr < this.memory.size: " + toStringHex32(addr));
    if (addr & 1)
        throw "ld_halfword: alignment error!";
    return this.memory.mem_halfword[addr >> 1];
};

MemoryController.prototype.st_halfword = function(addr, halfword) {
    //assert(halfword >= 0, "halfword >= 0");
    if (this.io.write[addr]) {
        this.io.st_halfword(addr, halfword);
        return;
    }
    //assert(addr < this.memory.size, "st_halfword: addr < this.memory.size" + toStringHex32(addr));
    if (addr & 1)
        throw "st_halfword: alignment error!";
    this.memory.mem_halfword[addr >> 1] = halfword;
};

MemoryController.prototype.ld_word = function(addr) {
    //if (this.io.read[addr])
    // FIXME
    if (addr >= 0x10000000)
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
    if (this.io.write[addr]) {
        this.io.st_word(addr, word);
        return;
    }

    //assert(addr < this.memory.size, "st_word: addr < this.memory.size: " + toStringHex32(addr));
    this.memory.mem_word[addr >>> 2] = word;
};

MemoryController.prototype.st_word_unaligned = function(addr, word) {
    //assert(word >= 0, "word >= 0");
    if (this.io.write[addr]) {
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
    this.decode_cache_size = 1000;
    this.decode_cache = new Array();
    this.decode_cache_list = new Array();
    this.decode_cache_hit = 0;
    this.decode_cache2 = new Array();
    this.decode_cache2_list = new Array();
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
}

System.prototype.load_binary = function(url, phyaddr, cb) {
    var system = this;
    $.get(url, null, function(data, textStatus, XMLHttpRequest) {
            var length = data.length;
            for (var i = 0; i < length; i++) {
                system.memctlr.st_byte(phyaddr + i, data.charCodeAt(i));
            }
            if (cb)
                cb(system);
        }, "binary");
};

System.prototype.run = function(system) {
    if (this.options.enable_logger) {
        system.cpu.log_regs(null);
        system.cpu.print_pc(system.cpu.regs[15], null);
    }
    setTimeout(system.loop.bind(system), 10);
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
    var timeout = 10;
    try {
        if (!this.is_running)
            return;
        var timeslice = 1000;
        var remained = 1000;
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
                if (irq) {
                    this.n_interrupts += 1;
                    cpu.is_halted = false;
                    cpu.interrupt(irq);
                } else {
                    throw "irq == null";
                }
            }
            // See WFI instruction
            if (cpu.is_halted) {
                timeout = 100;
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
                var inst_name = cpu.decode(inst, pc);

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
    writeToFile("mem.dat", this.memory.mem, this.memory.size, false);
};

System.prototype.restore_memory = function() {
    var system = this;
    var handler = function(e) {
        system.memory = new Memory(this.result.byteLength);
        system.memory.init(this.result);
        system.memctlr.memory = system.memory;
        display.log("memory restored");
    };
    display.log("restoring memory from a file");
    readFromFile("mem.dat", this.memory.size, handler, false);
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
    this.cpu = new CPU_ARMv7(options, this, this.memctlr);
    this.gic = new GenericInterruptController();
    this.io.register_io("GIC", this.gic);
    this.pl180 = new PL180(0x10005000);
    this.io.register_io("PL180", this.pl180);
    this.keyboard = new KMI(0x10006000, this.irq_base + 12, this.gic);
    this.io.register_io("Keyboard", this.keyboard);
    this.mouse = new KMI(0x10007000, this.irq_base + 13, this.gic);
    this.io.register_io("Mouse", this.mouse);
    this.rtc = new RTC();
    this.io.register_io("RTC", this.rtc);
    this.uart0 = new UART(0, 0x10009000, this.irq_base + 5, this.gic);
    this.uart1 = new UART(1, 0x1000a000, this.irq_base + 6, this.gic);
    this.uart2 = new UART(2, 0x1000b000, this.irq_base + 7, this.gic);
    this.uart3 = new UART(3, 0x1000c000, this.irq_base + 8, this.gic);
    this.io.register_io("UART0", this.uart0);
    this.io.register_io("UART1", this.uart1);
    this.io.register_io("UART2", this.uart2);
    this.io.register_io("UART3", this.uart3);
    this.timer0 = new SP804(0x10001000, this.irq_base + 2, this.gic);
    this.timer1 = new SP804(0x10011000, this.irq_base + 2, this.gic);
    this.io.register_io("SP804#0", this.timer0);
    this.io.register_io("SP804#1", this.timer1);

    // Unimplemented Devices
    this.aaci = new UnimplementedDevice(0x10004000);
    this.io.register_io("AACI", this.aaci);
    this.unknown0 = new UnimplementedDevice(0x1000f000);
    this.io.register_io("Unknown#0", this.unknown0);
    this.unknown1 = new UnimplementedDevice(0x1001b000);
    this.io.register_io("Unknown#1", this.unknown1);
    this.CLCDC = new UnimplementedDevice(0x10020000);
    this.io.register_io("CLCDC", this.CLCDC);
    this.DMC = new UnimplementedDevice(0x100e0000);
    this.io.register_io("DMC", this.DMC);
    this.SMC = new UnimplementedDevice(0x100e1000);
    this.io.register_io("SMC", this.SMC);
    this.GPIO = new UnimplementedDevice(0x100e8000);
    this.io.register_io("GPIO", this.GPIO);
}

VersatileExpress.prototype = new System();

VersatileExpress.prototype.boot = function(params) {
    this.memory.init();

    this.setup_tagged_list(params);
    /*
     * from http://lxr.linux.no/linux/Documentation/arm/Booting
     * CPU register settings
     * r0 = 0,
     * r1 = machine type number discovered in (3) above.
     * r2 = physical address of tagged list in system RAM, or
     * physical address of device tree block (dtb) in system RAM
     */
    this.cpu.regs[0] = 0;
    //this.cpu.regs[1] = 387; // versatile_pb in arch/arm/tools/mach-types
    this.cpu.regs[1] = 2272; // vexpress in arch/arm/tools/mach-types
    this.cpu.regs[2] = this.taglist_start_addr; // Typical place
    this.cpu.regs[13] = 0x00100000; // SP
    this.cpu.regs[15] = 0x00100000; // PC
    this.cpu.cpsr.m = 0x13; // 10011 Supervisor mode
    this.cpu.log_cpsr();
    //this.load_binary("initrd.img-2.6.32-5-versatile.mini.bin", 0x00800000);
    //this.load_binary("zImage-3.3.2-debug-nofs-nonet-lzo-v7-printk", 0x00100000, this.run);
    this.load_binary(params.initrd_url, 0x00800000);
    this.load_binary(params.zImage_url, 0x00100000, this.run);

    this.is_booted = true;
    this.is_running = true;
    this.state_changed();
    //this.cpu.run();
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
    params.uart1 = this.uart1.save();
    params.uart2 = this.uart2.save();
    params.uart3 = this.uart3.save();

    var params_str = JSON.stringify(params);
    writeToFile("system.json", params_str, params_str.length, true);
    this.save_memory();
};

VersatileExpress.prototype.restore = function() {
    var system = this;
    var handler = function(e) {
        var params = JSON.parse(this.result);
        // Unmarshal
        system.cpu.restore(params.cpu);
        var cp15 = system.cpu.coprocs[15];
        cp15.restore(params.cp15);
        system.cpu.mmu.restore(params.mmu);
        system.tick = params.tick;
        system.n_instructions = params.n_instructions;
        if (params.gic) {
            system.gic.restore(params.gic);
            system.timer0.restore(params.timer0);
            system.timer1.restore(params.timer1);
        }
        if (params.uart0) {
            system.uart0.restore(params.uart0);
            system.uart1.restore(params.uart1);
            system.uart2.restore(params.uart2);
            system.uart3.restore(params.uart3);
        }

        system.restore_memory();
        display.log("system restored");
        system.is_booted = true;
        system.is_running = false;
        system.state_changed();
    };
    readFromFile("system.json", 50*1024*1024, handler, true);
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
    //display.log("\nIO:");
    //this.io.dump();
    display.log("Timer0:");
    this.timer0.dump();
    display.log("Timer1:");
    this.timer1.dump();
    display.log("\nUART0:");
    this.uart0.dump();
    display.log("\n");
    display.log("tick=" + this.tick);
    display.log("insts=" + this.n_instructions);
    display.log("decode cache hit=" + this.decode_cache_hit);
    display.log("interrupts=" + this.n_interrupts);
    display.log("pending interrupts=" + this.gic.pending_interrupts);
};

