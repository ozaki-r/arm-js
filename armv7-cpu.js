/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
function ARMv7_CPU(options, memctlr) {
    this.options = options;
    this.memctlr = memctlr;

    this.USR_MODE = 0x10;
    this.FIQ_MODE = 0x11;
    this.IRQ_MODE = 0x12;
    this.SVC_MODE = 0x13;
    this.MON_MODE = 0x16;
    this.ABT_MODE = 0x17;
    this.UND_MODE = 0x1b;
    this.SYS_MODE = 0x1f;

    this.mode2string = new Array();
    this.mode2string[this.USR_MODE] = "USR";
    this.mode2string[this.FIQ_MODE] = "FIQ";
    this.mode2string[this.IRQ_MODE] = "IRQ";
    this.mode2string[this.SVC_MODE] = "SVC";
    this.mode2string[this.MON_MODE] = "MON";
    this.mode2string[this.ABT_MODE] = "ABT";
    this.mode2string[this.UND_MODE] = "UND";
    this.mode2string[this.SYS_MODE] = "SYS";

    this.is_good_mode = new Object();
    this.is_good_mode[this.USR_MODE] = true;
    this.is_good_mode[this.FIQ_MODE] = true;
    this.is_good_mode[this.IRQ_MODE] = true;
    this.is_good_mode[this.SVC_MODE] = true;
    this.is_good_mode[this.ABT_MODE] = true;
    this.is_good_mode[this.UND_MODE] = true;
    this.is_good_mode[this.SYS_MODE] = true;

    this.regs = new Array();
    for (i = 0; i < 16; i++)
        this.regs[i] = 0;
    /*
     * regs[10]: SL:
     * regs[11]: FP:
     * regs[12]: IP: A general register
     * regs[13]: SP: Stack pointer
     * regs[14]: LR: Link register
     * regs[15]: PC: Program counter
     */

    this.regs_usr = new Array();
    for (i = 0; i < 16; i++)
        this.regs_usr[i] = 0;
    this.regs_svc = new Array();
    this.regs_svc[13] = 0;
    this.regs_svc[14] = 0;
    this.regs_mon = new Array();
    this.regs_mon[13] = 0;
    this.regs_mon[14] = 0;
    this.regs_abt = new Array();
    this.regs_abt[13] = 0;
    this.regs_abt[14] = 0;
    this.regs_und = new Array();
    this.regs_und[13] = 0;
    this.regs_und[14] = 0;
    this.regs_irq = new Array();
    this.regs_irq[13] = 0;
    this.regs_irq[14] = 0;
    this.regs_fiq = new Array();
    this.regs_fiq[8] = 0;
    this.regs_fiq[9] = 0;
    this.regs_fiq[10] = 0;
    this.regs_fiq[11] = 0;
    this.regs_fiq[12] = 0;
    this.regs_fiq[13] = 0;
    this.regs_fiq[14] = 0;

    // CPSR: Current program status register
    /*
     * bit[31]: N: Negative condition code flag (APSR)
     * bit[30]: Z: Zero condition code flag (APSR)
     * bit[29]: C: Carry condition code flag (APSR)
     * bit[28]: V: Overflow condition code flag (APSR)
     * bit[27]: Q: Cumulative saturation flag (APSR)
     * bits[26:25]: IT: If-Then execution state bits
     * bit[24]: J: Jazelle bit
     * bits[23:20]: Reserved
     * bits[19:16]: Greater than or Equal flags (APSR)
     * bit[9]: E: Endianness execution state bit
     * bit[8]: A: Asynchronous abort disable bit
     * bit[7]: I: Interrupt disable bit
     * bit[6]: F: Fast interrupt disable bit
     * bit[5]: T: Thumb execution state bit
     * bits[4:0]: M: Mode field
     */
    this.cpsr = {n:0, z:0, c:0, v:0, q:0, e:0, a:0, i:0, f:0, t:0, m:0};

    // SPSR: banked Saved Program Status Register
    this.spsr_svc = {n:0, z:0, c:0, v:0, q:0, e:0, a:0, i:0, f:0, t:0, m:0};
    this.spsr_mon = {n:0, z:0, c:0, v:0, q:0, e:0, a:0, i:0, f:0, t:0, m:0};
    this.spsr_abt = {n:0, z:0, c:0, v:0, q:0, e:0, a:0, i:0, f:0, t:0, m:0};
    this.spsr_und = {n:0, z:0, c:0, v:0, q:0, e:0, a:0, i:0, f:0, t:0, m:0};
    this.spsr_irq = {n:0, z:0, c:0, v:0, q:0, e:0, a:0, i:0, f:0, t:0, m:0};
    this.spsr_fiq = {n:0, z:0, c:0, v:0, q:0, e:0, a:0, i:0, f:0, t:0, m:0};

    this.mmu = new ARMv7_MMU(this, this.memctlr);
    this.coprocs = new Array();
    for (i = 0; i < 16; i++)
        this.coprocs[i] = null;
    this.coprocs[15] = new ARMv7_CP15(options, this);
    this.mmu.cp15 = this.coprocs[15];

    this.shift_t = 0;
    this.shift_n = 0;
    this.carry_out = 0;
    this.overflow = 0;

    this.SRType_LSL = 0;
    this.SRType_LSR = 1;
    this.SRType_ASR = 2;
    this.SRType_RRX = 3;
    this.SRType_ROR = 4;

    this.no_cond_insts = new Object();
    this.no_cond_insts["cps"] = true;
    this.no_cond_insts["clrex"] = true;
    this.no_cond_insts["dsb"] = true;
    this.no_cond_insts["dmb"] = true;
    this.no_cond_insts["isb"] = true;

    this.allow_unaligned = new Array();
    this.allow_unaligned["ldrh"] = true;
    this.allow_unaligned["ldrht"] = true;
    this.allow_unaligned["ldrsh_imm"] = true;
    this.allow_unaligned["ldrsh_reg"] = true;
    this.allow_unaligned["ldrsht"] = true;
    this.allow_unaligned["strh_imm"] = true;
    this.allow_unaligned["strh_reg"] = true;
    this.allow_unaligned["strht"] = true;
    this.allow_unaligned["tbh"] = true;
    this.allow_unaligned["ldr_imm"] = true;
    this.allow_unaligned["ldr_reg"] = true;
    this.allow_unaligned["ldr_lit"] = true;
    this.allow_unaligned["ldrt"] = true;
    this.allow_unaligned["str_imm"] = true;
    this.allow_unaligned["str_reg"] = true;
    this.allow_unaligned["strt"] = true;

    this.is_halted = false;
    this.current = "";
}

ARMv7_CPU.prototype.save = function() {
    var params = Object();
    params.regs = this.regs;
    params.regs_usr = this.regs_usr;
    params.regs_svc = this.regs_svc;
    params.regs_mon = this.regs_mon;
    params.regs_abt = this.regs_abt;
    params.regs_und = this.regs_und;
    params.regs_irq = this.regs_irq;
    params.regs_fiq = this.regs_fiq;
    params.spsr_svc = this.spsr_svc;
    params.spsr_mon = this.spsr_mon;
    params.spsr_abt = this.spsr_abt;
    params.spsr_und = this.spsr_und;
    params.spsr_irq = this.spsr_irq;
    params.spsr_fiq = this.spsr_fiq;
    params.cpsr = this.cpsr;
    params.spsr = this.spsr;
    params.is_halted = this.is_halted;
    return params;
};

ARMv7_CPU.prototype.restore = function(params) {
    this.regs = params.regs;
    this.regs_usr = params.regs_usr;
    this.regs_svc = params.regs_svc;
    this.regs_mon = params.regs_mon;
    this.regs_abt = params.regs_abt;
    this.regs_und = params.regs_und;
    this.regs_irq = params.regs_irq;
    this.regs_fiq = params.regs_fiq;
    this.spsr_svc = params.spsr_svc;
    this.spsr_mon = params.spsr_mon;
    this.spsr_abt = params.spsr_abt;
    this.spsr_und = params.spsr_und;
    this.spsr_irq = params.spsr_irq;
    this.spsr_fiq = params.spsr_fiq;
    this.cpsr = params.cpsr;
    this.spsr = params.spsr;
    this.is_halted = params.is_halted;
};

ARMv7_CPU.prototype.dump = function(params) {
    display.log("mode=" + this.mode2string[this.cpsr.m]);
    display.log("halted=" + this.is_halted);
    this.dump_regs(null);
    this.dump_banked_regs();
    this.dump_cpsr();
    this.dump_spsr();
};

ARMv7_CPU.prototype.dump_stack = function() {
    var sp = this.regs[13];
    display.wipe();
    display.log("Stack values:");
    for (var i = 0; i < 50; i++) {
        var addr = sp + i*4;
        var val = this.ld_word(addr);
        display.log("\t" + toStringHex32(addr) + ":\t" + toStringHex32(val) + "(" + val.toString(10) + ")");
    }
};

ARMv7_CPU.prototype.get_pc = function() {
    return this.regs[15] + 8;
};

ARMv7_CPU.prototype.reg = function(i) {
    if (i == 15)
        return this.get_pc();
    else
        return this.regs[i];
};

ARMv7_CPU.prototype.dump_banked_regs = function() {
    this.output_banked_regs(display);
};

ARMv7_CPU.prototype.output_banked_regs = function(target) {
    var indent = "                                                                      ";
    var msg = "USR: ";
    var i;
    for (i = 0; i <= 7; i++)
        msg += "[ " + i.toString() + "]=" + toStringHex32(this.regs_usr[i]) + " ";
    target.log(msg);
    msg = "     ";
    for (i = 8; i <= 9; i++)
        msg += "[ " + i.toString() + "]=" + toStringHex32(this.regs_usr[i]) + " ";
    for (i = 10; i <= 15; i++)
        msg += "[" + i.toString() + "]=" + toStringHex32(this.regs_usr[i]) + " ";
    target.log(msg);
    msg = "SVC: " + indent;
    for (i = 13; i <= 14; i++)
        msg += "[" + i.toString() + "]=" + toStringHex32(this.regs_svc[i]) + " ";
    target.log(msg);
    msg = "MON: " + indent;
    for (i = 13; i <= 14; i++)
        msg += "[" + i.toString() + "]=" + toStringHex32(this.regs_mon[i]) + " ";
    target.log(msg);
    msg = "ABT: " + indent;
    for (i = 13; i <= 14; i++)
        msg += "[" + i.toString() + "]=" + toStringHex32(this.regs_abt[i]) + " ";
    target.log(msg);
    msg = "UND: " + indent;
    for (i = 13; i <= 14; i++)
        msg += "[" + i.toString() + "]=" + toStringHex32(this.regs_und[i]) + " ";
    target.log(msg);
    msg = "IRQ: " + indent;
    for (i = 13; i <= 14; i++)
        msg += "[" + i.toString() + "]=" + toStringHex32(this.regs_irq[i]) + " ";
    target.log(msg);
    msg = "FIQ: ";
    for (i = 8; i <= 9; i++)
        msg += "[ " + i.toString() + "]=" + toStringHex32(this.regs_fiq[i]) + " ";
    for (i = 10; i <= 14; i++)
        msg += "[" + i.toString() + "]=" + toStringHex32(this.regs_fiq[i]) + " ";
    target.log(msg);
};

ARMv7_CPU.prototype.log_cpsr = function() {
    if (!this.options.enable_logger)
        return;
    this.output_cpsr(logger);
};

ARMv7_CPU.prototype.dump_cpsr = function() {
    this.output_cpsr(display);
};

ARMv7_CPU.prototype.dump_spsr = function() {
    this.output_spsr(display);
};

ARMv7_CPU.prototype.log_apsr = function() {
    if (!this.options.enable_logger)
        return;
    this.output_apsr(logger);
};

ARMv7_CPU.prototype.dump_apsr = function() {
    this.output_apsr(display);
};

ARMv7_CPU.prototype.output_apsr = function(target) {
    var msg = "APSR: ";
    msg += "N[" + this.cpsr.n + "] ";
    msg += "Z[" + this.cpsr.z + "] ";
    msg += "C[" + this.cpsr.c + "] ";
    msg += "V[" + this.cpsr.v + "] ";
    msg += "Q[" + this.cpsr.q + "] ";
    target.log(msg);
};

ARMv7_CPU.prototype.output_psr = function(name, psr, target) {
    var msg = name + ": ";
    msg += "N[" + psr.n + "] ";
    msg += "Z[" + psr.z + "] ";
    msg += "C[" + psr.c + "] ";
    msg += "V[" + psr.v + "] ";
    msg += "Q[" + psr.q + "] ";
    msg += "A[" + psr.a + "] ";
    msg += "I[" + psr.i + "] ";
    msg += "F[" + psr.f + "] ";
    msg += "M[" + psr.m.toString(2) + "] ";
    target.log(msg);
};

ARMv7_CPU.prototype.output_cpsr = function(target) {
    this.output_psr("CPSR", this.cpsr, target);
};

ARMv7_CPU.prototype.output_spsr = function(target) {
    this.output_psr("SPSR_svc", this.spsr_svc, target);
    this.output_psr("SPSR_mon", this.spsr_mon, target);
    this.output_psr("SPSR_abt", this.spsr_abt, target);
    this.output_psr("SPSR_und", this.spsr_und, target);
    this.output_psr("SPSR_irq", this.spsr_irq, target);
    this.output_psr("SPSR_fiq", this.spsr_fiq, target);
};

ARMv7_CPU.prototype.log_regs = function(oldregs) {
    if (!this.options.enable_logger)
        return;
    this.output_regs(logger, oldregs);
};

ARMv7_CPU.prototype.dump_regs = function(oldregs) {
    this.output_regs(display, oldregs);
};

ARMv7_CPU.prototype.output_regs = function(target, oldregs) {
    var i;
    var indent = "     ";
    var msg = indent;
    if (oldregs === null) {
        for (i = 0; i < 8; i++)
            msg += "[ " + i.toString() + "]=" + toStringHex32(this.regs[i]) + " ";
        target.log(msg);
        msg = indent;
        for (i = 8; i < 16; i++)
            msg += "[" + (i < 10 ? " " : "") + i.toString() + "]=" + toStringHex32(this.regs[i]) + " ";
        target.log(msg);
    } else {
        var changed = false;
        for (i = 0; i < 8; i++) {
            if (this.regs[i] == oldregs[i])
                //     " [10]=60000093"
                msg += "              ";
            else {
                msg += "[ " + i.toString() + "]=" + toStringHex32(this.regs[i]) + " ";
                changed = true;
            }
        }
        if (changed)
            target.log(msg);

        changed = false;
        msg = indent;
        for (i = 8; i < 15; i++) { // PC will change every execution, so don't show it
            if (this.regs[i] == oldregs[i]) {
                //     " [10]=60000093"
                msg += "              ";
            } else {
                msg += "[" + (i < 10 ? " " : "") + i.toString() + "]=" + toStringHex32(this.regs[i]) + " ";
                changed = true;
            }
        }
        if (changed)
            target.log(msg);
    }
};
ARMv7_CPU.prototype.dump_value = function(value, name) {
    this.output_value(display, value, name);
};

ARMv7_CPU.prototype.log_value = function(value, name) {
    if (!this.options.enable_logger)
        return;

    this.output_value(logger, value, name);
};

ARMv7_CPU.prototype.output_value = function(target, value, name) {
    if (name)
        target.log(name + "=" + value.toString(10) + "\t" + toStringHex32(value) + "(" + toStringBin32(value) + ")");
    else
        target.log("value=" + value.toString(10) + "\t" + toStringHex32(value) + "(" + toStringBin32(value) + ")");
};

ARMv7_CPU.prototype.is_bad_mode = function(mode) {
    switch (mode) {
        case this.SVC_MODE:
        case this.IRQ_MODE:
        case this.USR_MODE:
        case this.ABT_MODE:
        case this.FIQ_MODE:
        case this.UND_MODE:
        case this.SYS_MODE:
            return false;
        case this.MON_MODE: // !HaveSecurityExt()
        default:
            return true;
    }
};

ARMv7_CPU.prototype.is_priviledged = function() {
    var mode = this.cpsr.m;
    if (mode == this.USR_MODE)
        return false;
    else
        return true;
};

ARMv7_CPU.prototype.is_user_or_system = function() {
    var mode = this.cpsr.m;
    if (mode == this.USR_MODE || mode == this.SYS_MODE)
        return true;
    else
        return false;
};

ARMv7_CPU.prototype.is_secure = function() {
    return false;
};

ARMv7_CPU.prototype.scr_get_aw = function() {
    return 1; // the CPSR.A bit can be modified in any security state.
};

ARMv7_CPU.prototype.scr_get_fw = function() {
    return 1; // the CPSR.F bit can be modified in any security state.
};

ARMv7_CPU.prototype.nsacr_get_rfr = function() {
    return 0; // FIQ mode and the FIQ Banked registers are accessible in Secure and Non-secure security states.
};

ARMv7_CPU.prototype.sctlr_get_nmfi = function() {
    return this.coprocs[15].sctlr_get_nmfi();
};

ARMv7_CPU.prototype.parse_psr = function(value) {
    var psr = {n:0, z:0, c:0, v:0, q:0, e:0, a:0, i:0, f:0, t:0, m:0};
    psr.n = value >>> 31;
    psr.z = (value >>> 30) & 1;
    psr.c = (value >>> 29) & 1;
    psr.v = (value >>> 28) & 1;
    psr.q = (value >>> 27) & 1;
    psr.e = (value >>> 9) & 1;
    psr.a = (value >>> 8) & 1;
    psr.i = (value >>> 7) & 1;
    psr.f = (value >>> 6) & 1;
    psr.t = (value >>> 5) & 1;
    psr.m = value & 0x1f;
    return psr;
};

ARMv7_CPU.prototype.psr_to_value = function(psr) {
    var value = psr.m;
    value += psr.t << 5;
    value += psr.f << 6;
    value += psr.i << 7;
    value += psr.a << 8;
    value += psr.e << 9;
    value += psr.q << 27;
    value += psr.v << 28;
    value += psr.c << 29;
    value += psr.z << 30;
    value += psr.n << 31;
    return value;
};

ARMv7_CPU.prototype.clone_psr = function(src) {
    var dst = {n:0, z:0, c:0, v:0, q:0, e:0, a:0, i:0, f:0, t:0, m:0};
    dst.n = src.n;
    dst.z = src.z;
    dst.c = src.c;
    dst.v = src.v;
    dst.q = src.q;
    dst.e = src.e;
    dst.a = src.a;
    dst.i = src.i;
    dst.f = src.f;
    dst.t = src.t;
    dst.m = src.m;
    return dst;
};

ARMv7_CPU.prototype.set_current_spsr = function(spsr) {
    switch (this.cpsr.m) {
        case this.USR_MODE:
            throw "set_current_spsr user";
            break;
        case this.FIQ_MODE:
            this.spsr_fiq = spsr;
            break;
        case this.IRQ_MODE:
            this.spsr_irq = spsr;
            break;
        case this.SVC_MODE:
            this.spsr_svc = spsr;
            break;
        case this.MON_MODE:
            this.spsr_mon = spsr;
            break;
        case this.ABT_MODE:
            this.spsr_abt = spsr;
            break;
        case this.UND_MODE:
            this.spsr_und = spsr;
            break;
        case this.SYS_MODE:
            throw "set_current_spsr system user";
            break;
        default:
            throw "set_current_spsr unknown";
            break;
    }
};

ARMv7_CPU.prototype.get_current_spsr = function() {
    switch (this.cpsr.m) {
        case this.USR_MODE:
            throw "get_current_spsr user";
            break;
        case this.FIQ_MODE:
            return this.spsr_fiq;
        case this.IRQ_MODE:
            return this.spsr_irq;
        case this.SVC_MODE:
            return this.spsr_svc;
        case this.MON_MODE:
            return this.spsr_mon;
        case this.ABT_MODE:
            return this.spsr_abt;
        case this.UND_MODE:
            return this.spsr_und;
        case this.SYS_MODE:
            throw "get_current_spsr system user";
            break;
        default:
            throw "get_current_spsr unknown";
            break;
    }
    return null;
};

ARMv7_CPU.prototype.spsr_write_by_instr0 = function(spsr, psr, bytemask) {
    if (this.is_user_or_system())
        this.abort_unpredictable("spsr_write_by_instr0");
    if (bytemask & 8) {
        spsr.n = psr.n;
        spsr.z = psr.z;
        spsr.c = psr.c;
        spsr.v = psr.v;
        spsr.q = psr.q;
    }
    if (bytemask & 4) {
        spsr.ge = psr.ge;
    }
    if (bytemask & 2) {
        spsr.e = psr.e;
        spsr.a = psr.a;
    }
    if (bytemask & 1) {
        spsr.i = psr.i;
        spsr.f = psr.f;
        spsr.t = psr.t;
        if (!this.is_good_mode[psr.m])
            this.abort_unpredictable("spsr_write_by_instr0", psr.m);
        else
            spsr.m = psr.m;
    }
    return spsr;
};

ARMv7_CPU.prototype.spsr_write_by_instr = function(psr, bytemask) {
    var spsr = this.get_current_spsr();
    this.spsr_write_by_instr0(spsr, psr, bytemask);
    this.set_current_spsr(spsr); // XXX
};

ARMv7_CPU.prototype.cpsr_write_by_instr = function(psr, bytemask, affect_execstate) {
    var is_priviledged = this.is_priviledged();
    var nmfi = this.sctlr_get_nmfi() == 1;
    if (this.options.enable_logger) {
        var oldregs = new Array();
        this.store_regs(oldregs);
        this.log_cpsr();
    }

    if (bytemask & 8) {
        this.cpsr.n = psr.n;
        this.cpsr.z = psr.z;
        this.cpsr.c = psr.c;
        this.cpsr.v = psr.v;
        this.cpsr.q = psr.q;
    }
    if (bytemask & 2) {
        this.cpsr.e = psr.e;
        if (is_priviledged && (this.is_secure() || this.scr_get_aw() == 1))
            this.cpsr.a = psr.a;
    }
    if (bytemask & 1) {
        if (is_priviledged) {
            this.cpsr.i = psr.i;
        }
        if (is_priviledged && (this.is_secure() || this.scr_get_fw() == 1) && (!nmfi || psr.f === 0))
            this.cpsr.f = psr.f;
        if (affect_execstate)
            this.cpsr.t = psr.t;
        if (is_priviledged) {
            if (!this.is_good_mode[psr.m])
                this.abort_unpredictable("cpsr_write_by_instr", psr.m);
            else {
                if (!this.is_secure() && psr.m == this.MON_MODE)
                    this.abort_unpredictable("cpsr_write_by_instr", psr.m);
                if (!this.is_secure() && psr.m == this.FIQ_MODE && this.nsacr_get_rfr() == 1)
                    this.abort_unpredictable("cpsr_write_by_instr", psr.m);
                if (this.cpsr.m != psr.m)
                    this.change_mode(psr.m);
            }
        }
    }
    if (this.options.enable_logger) {
        this.log_cpsr();
        this.log_regs(oldregs);
    }
};

ARMv7_CPU.prototype.save_to_regs = function(mode) {
    switch (mode) {
        case this.USR_MODE:
            this.regs_usr[13] = this.regs[13];
            this.regs_usr[14] = this.regs[14];
            break;
        case this.FIQ_MODE:
            this.regs_fiq[8] = this.regs[8];
            this.regs_fiq[9] = this.regs[9];
            this.regs_fiq[10] = this.regs[10];
            this.regs_fiq[11] = this.regs[11];
            this.regs_fiq[12] = this.regs[12];
            this.regs_fiq[13] = this.regs[13];
            this.regs_fiq[14] = this.regs[14];
            break;
        case this.IRQ_MODE:
            this.regs_irq[13] = this.regs[13];
            this.regs_irq[14] = this.regs[14];
            break;
        case this.SVC_MODE:
            this.regs_svc[13] = this.regs[13];
            this.regs_svc[14] = this.regs[14];
            break;
        case this.MON_MODE:
            this.regs_mon[13] = this.regs[13];
            this.regs_mon[14] = this.regs[14];
            break;
        case this.ABT_MODE:
            this.regs_abt[13] = this.regs[13];
            this.regs_abt[14] = this.regs[14];
            break;
        case this.UND_MODE:
            this.regs_und[13] = this.regs[13];
            this.regs_und[14] = this.regs[14];
            break;
        case this.SYS_MODE:
            throw "save_to_regs system";
            break;
        default:
            throw "save_to_regs unknown: " + mode.toString(16);
            break;
    }
};

ARMv7_CPU.prototype.restore_from_regs = function(mode) {
    switch (mode) {
        case this.USR_MODE:
            this.regs[13] = this.regs_usr[13];
            this.regs[14] = this.regs_usr[14];
            break;
        case this.FIQ_MODE:
            this.regs[8] = this.regs_fiq[8];
            this.regs[9] = this.regs_fiq[9];
            this.regs[10] = this.regs_fiq[10];
            this.regs[11] = this.regs_fiq[11];
            this.regs[12] = this.regs_fiq[12];
            this.regs[13] = this.regs_fiq[13];
            this.regs[14] = this.regs_fiq[14];
            break;
        case this.IRQ_MODE:
            this.regs[13] = this.regs_irq[13];
            this.regs[14] = this.regs_irq[14];
            break;
        case this.SVC_MODE:
            this.regs[13] = this.regs_svc[13];
            this.regs[14] = this.regs_svc[14];
            break;
        case this.MON_MODE:
            this.regs[13] = this.regs_mon[13];
            this.regs[14] = this.regs_mon[14];
            break;
        case this.ABT_MODE:
            this.regs[13] = this.regs_abt[13];
            this.regs[14] = this.regs_abt[14];
            break;
        case this.UND_MODE:
            this.regs[13] = this.regs_und[13];
            this.regs[14] = this.regs_und[14];
            break;
        case this.SYS_MODE:
            throw "restore_from_regs system";
            break;
        default:
            throw "restore_from_regs unknown: " + mode.toString(16);
            break;
    }
};

ARMv7_CPU.prototype.change_mode = function(mode) {
    if (!mode)
        throw "Invalid mode: " + mode;
    if (this.options.enable_logger)
        logger.log("changing mode from " + this.mode2string[this.cpsr.m] + " to " + this.mode2string[mode]);
    this.save_to_regs(this.cpsr.m);
    this.cpsr.m = mode;
    this.restore_from_regs(this.cpsr.m);
};

ARMv7_CPU.prototype.set_apsr = function(val, set_overflow) {
    this.cpsr.n = val >>> 31;
    this.cpsr.z = (val === 0) ? 1 : 0;
    this.cpsr.c = this.carry_out;
    if (set_overflow)
        this.cpsr.v = this.overflow;
    if (this.options.enable_logger)
        this.log_apsr();
};

ARMv7_CPU.prototype.store_regs = function(regs) {
    for (var i = 0; i < 16; i++)
        regs[i] = this.regs[i];
};


/*
 * Coprocessors
 */
ARMv7_CPU.prototype.coproc_accepted = function(cp) {
    return cp == 15; // FIXME
};

ARMv7_CPU.prototype.coproc_get_word = function(cp, inst) {
    return this.coprocs[cp].get_word(inst);
};

ARMv7_CPU.prototype.coproc_send_word = function(cp, inst, word) {
    return this.coprocs[cp].send_word(inst, word);
};

ARMv7_CPU.prototype.coproc_internal_operation = function(cp, inst) {
    this.log_value(cp, "cp");
    throw "coproc";
    return this.coprocs[cp].internal_operation(inst);
};

/*
 * Alignment
 */
ARMv7_CPU.prototype.align = function(value, align) {
    assert((value & 3) === 0, "align");
    return value; // FIXME
};

ARMv7_CPU.prototype.unaligned_support = function() {
    return true;
};

/*
 * Instruction printers
 */
ARMv7_CPU.prototype.abort_unknown_inst = function(inst, addr) {
    display.log("\nUnknown instruction: " + toStringInst(inst));
    throw "UNKNOWN";
};

ARMv7_CPU.prototype.abort_simdvfp_inst = function(inst, addr) {
    display.log("\nSIMD or VFP instruction: " + toStringInst(inst));
    throw "SIMD or VFP";
};

ARMv7_CPU.prototype.abort_not_impl = function(name, inst, addr) {
    display.log("\n--" + name + " not implemented: " + toStringInst(inst));
    throw "NOT IMPLEMENTED: " + name;
};

ARMv7_CPU.prototype.abort_undefined_instruction = function(category, inst, addr) {
    display.log("\nUndefined instruction in " + category + ": " + toStringInst(inst));
    throw "UNDEFINED: " + category;
};

ARMv7_CPU.prototype.abort_unpredictable = function(category, value) {
    display.log("\nUnpredictable in " + category + ": " + value.toString(16) + "(" + value.toString(2) + ")");
    throw "UNPREDICTABLE: " + category;
};

ARMv7_CPU.prototype.abort_unpredictable_instruction = function(category, inst, addr) {
    display.log("\nUnpredictable instruction in " + category + ": " + inst.toString(16) + "(" + inst.toString(2) + ")");
    throw "UNPREDICTABLE: " + category;
};

ARMv7_CPU.prototype.abort_decode_error = function(inst, addr) {
    display.log("\nDecode error: " + toStringInst(inst));
    throw "Decode error";
};

ARMv7_CPU.prototype.print_inst = function(name, inst, addr) {
    if (!this.options.enable_logger)
        return;
    var msg = "\n@" + toStringHex32(addr) + ": ";
    if (name) {
        msg += toStringInst(inst) + ": " + name;
    } else {
        msg += toStringInst(inst);
    }
    logger.log(msg);
};

ARMv7_CPU.prototype.toRegName = function(i) {
    switch (i) {
        case 15: return "pc";
        case 14: return "lr";
        case 13: return "sp";
        case 12: return "ip";
        case 11: return "fp";
        case 10: return "sl";
        default: return "r" + i.toString();
    }
};

ARMv7_CPU.prototype.print_inst_unimpl = function(addr, inst, name) {
    if (!this.options.enable_tracer)
        return;
    var msg = toStringHex32(addr) + ":\t";
    msg += toStringHex32(inst) + "\t";
    var pf = this.cond_postfix(inst);
    msg += name + pf + "\t";
    tracer.log(msg, inst);
};

ARMv7_CPU.prototype.print_inst_uxtab = function(addr, inst, name, d, n, m, rotation) {
    if (!this.options.enable_tracer)
        return;
    var msg = toStringHex32(addr) + ":\t";
    msg += toStringHex32(inst) + "\t";
    var pf = this.cond_postfix(inst);
    msg += name + pf + "\t";
    var items = [];
    items.push(this.toRegName(d));
    if (n)
        items.push(this.toRegName(n));
    items.push(this.toRegName(m));
    if (rotation)
        items.push(rotation.toString());

    msg += items.join(', ');
    tracer.log(msg, inst);
};

ARMv7_CPU.prototype.print_inst_ubfx = function(addr, inst, name, d, n, msbit, lsbit) {
    if (!this.options.enable_tracer)
        return;
    var msg = toStringHex32(addr) + ":\t";
    msg += toStringHex32(inst) + "\t";
    var pf = this.cond_postfix(inst);
    msg += name + pf + "\t";
    var items = [];
    items.push(this.toRegName(d));
    if (n)
        items.push(this.toRegName(n));
    items.push("#" + msbit.toString());
    items.push("#" + lsbit.toString());
    msg += items.join(', ');
    tracer.log(msg, inst);
};

ARMv7_CPU.prototype.print_inst_mcrmrc = function(addr, inst, name, t, cp) {
    if (!this.options.enable_tracer)
        return;
    var opc1 = bitops.get_bits(inst, 23, 21);
    var crn = bitops.get_bits(inst, 19, 16);
    var opc2 = bitops.get_bits(inst, 7, 5);
    var crm = bitops.get_bits(inst, 3, 0);

    var msg = toStringHex32(addr) + ":\t";
    msg += toStringHex32(inst) + "\t";
    var pf = this.cond_postfix(inst);
    msg += name + pf + "\t";
    var items = [];
    items.push(cp.toString());
    items.push(opc1.toString());
    items.push(this.toRegName(t));
    items.push("cr" + crn.toString());
    items.push("cr" + crm.toString());
    //if (opc2)
        items.push("{" + opc2.toString() + "}");
    msg += items.join(', ');
    tracer.log(msg, inst);
};

ARMv7_CPU.prototype.print_inst_svc = function(addr, inst, val) {
    if (!this.options.enable_tracer)
        return;
    var msg = toStringHex32(addr) + ":\t";
    msg += toStringHex32(inst) + "\t";
    msg += "svc\t";
    msg += "0x" + toStringHex32(val);
    tracer.log(msg, inst);
};

ARMv7_CPU.prototype.print_inst_mrs = function(addr, inst, d) {
    if (!this.options.enable_tracer)
        return;
    var msg = toStringHex32(addr) + ":\t";
    msg += toStringHex32(inst) + "\t";
    msg += "mrs\t";
    msg += this.toRegName(d) + ", CPSR";
    tracer.log(msg, inst);
};

ARMv7_CPU.prototype.print_inst_msr = function(addr, inst, n, imm) {
    if (!this.options.enable_tracer)
        return;
    var msg = toStringHex32(addr) + ":\t";
    msg += toStringHex32(inst) + "\t";
    msg += "msr\t";
    if (n) {
        msg += "CPSR_c, " + this.toRegName(n);
    } else if (imm) {
        var imm_str = "#" + imm.toString();
        msg += "CPSR_c, " + imm_str;
    }
    tracer.log(msg, inst);
};

ARMv7_CPU.prototype.print_inst_ldstm = function(addr, inst, name, wback, t, reglist) {
    if (!this.options.enable_tracer)
        return;
    var msg = toStringHex32(addr) + ":\t";
    msg += toStringHex32(inst) + "\t";
    var pf = this.cond_postfix(inst);
    msg += name + pf + "\t";
    var items = [];
    if (t !== null)
        items.push(this.toRegName(t) + (wback ? "!" : ""));
    var _items = [];
    for (var i in reglist) {
        _items.push(this.toRegName(reglist[i]));
    }
    items.push("{" + _items.join(", ") + "}");
    msg += items.join(', ');
    tracer.log(msg, inst);
};

ARMv7_CPU.prototype.print_inst_rsr = function(addr, inst, name, s, d, n, m, stype, sn) {
    if (!this.options.enable_tracer)
        return;
    var msg = toStringHex32(addr) + ":\t";
    msg += toStringHex32(inst) + "\t";
    var pf = this.cond_postfix(inst);
    msg += name + pf + (s == 1 ? "s" : "") + "\t";
    var items = [];
    if (d)
        items.push(this.toRegName(d));
    if (n)
        items.push(this.toRegName(n));
    if (m)
        items.push(this.toRegName(m));
    items.push(this.shift_type_name(stype) + " " + this.toRegName(sn));
    msg += items.join(', ');
    tracer.log(msg, inst);
};

ARMv7_CPU.prototype.print_inst_mul = function(addr, inst, name, s, dhi, dlo, n, m) {
    if (!this.options.enable_tracer)
        return;
    var msg = toStringHex32(addr) + ":\t";
    msg += toStringHex32(inst) + "\t";
    var pf = this.cond_postfix(inst);
    msg += name + pf + (s == 1 ? "s" : "") + "\t";
    var items = [];
    if (dlo !== null)
        items.push(this.toRegName(dlo));
    if (dhi !== null)
        items.push(this.toRegName(dhi));
    if (n !== null)
        items.push(this.toRegName(n));
    if (m !== null)
        items.push(this.toRegName(m));
    msg += items.join(', ');
    tracer.log(msg, inst);
};
ARMv7_CPU.prototype.print_inst_reg = function(addr, inst, name, s, d, n, m, stype, sn, ldst, wback) {
    if (!this.options.enable_tracer)
        return;
    var msg = toStringHex32(addr) + ":\t";
    msg += toStringHex32(inst) + "\t";
    var pf = this.cond_postfix(inst);
    msg += name + pf + (s == 1 ? "s" : "") + "\t";
    var items = [];
    if (d !== null)
        items.push(this.toRegName(d));
    if (ldst) {
        var _items = [];
        if (n !== null)
            _items.push(this.toRegName(n));
        if (m !== null)
            _items.push(this.toRegName(m));
        if (sn)
            _items.push(this.shift_type_name(stype) + " #" + sn.toString());
        items.push("[" + _items.join(", ") + "]" + (wback ? "!" : ""));
    } else {
        if (n !== null)
            items.push(this.toRegName(n));
        if (m !== null)
            items.push(this.toRegName(m));
        if (sn)
            items.push(this.shift_type_name(stype) + " #" + sn.toString());
    }
    msg += items.join(', ');
    tracer.log(msg, inst);
};

ARMv7_CPU.prototype.print_inst_imm = function(addr, inst, name, s, d, n, imm, ldst, wback, add, index) {
    if (!this.options.enable_tracer)
        return;
    var is_add = add == undefined ? true : add;
    var is_index = index == undefined ? true : index;
    var imm_str = "#" + (is_add ? imm : -imm).toString();
    var msg = toStringHex32(addr) + ":\t";
    msg += toStringHex32(inst) + "\t";
    var pf = this.cond_postfix(inst);
    msg += name + pf + (s == 1 ? "s" : "") + "\t";
    var items = [];
    if (d !== null)
        items.push(this.toRegName(d));
    if (ldst) {
        if (is_index) {
            var _items = [];
            _items.push(this.toRegName(n));
            if (imm !== 0)
                _items.push(imm_str);
            items.push("[" + _items.join(", ") + "]" + (wback ? "!" : ""));
        } else {
            items.push("[" + this.toRegName(n) + "]");
            items.push(imm_str);
        }
    } else {
        if (n !== null)
            items.push(this.toRegName(n));
        items.push(imm_str);
    }
    msg += items.join(', ');
    tracer.log(msg, inst);
};

ARMv7_CPU.prototype.print_inst_branch = function(addr, inst, name, branch_to, reg) {
    if (!this.options.enable_tracer)
        return;
    var msg = toStringHex32(addr) + ":\t";
    msg += toStringHex32(inst) + "\t";
    var pf = this.cond_postfix(inst);
    msg += name + pf + "\t";
    if (reg) {
        msg += this.toRegName(reg);
        msg += "\t; " + toStringHex32(branch_to);
    } else {
        if (Symbols[branch_to])
            msg += toStringHex32(branch_to) + " <" + Symbols[branch_to] + ">";
        else
            msg += toStringHex32(branch_to);
    }
    tracer.log(msg, inst);
};

ARMv7_CPU.prototype.sp_used = function(name, inst) {
    if (!this.options.enable_logger)
        return;
    logger.log("SP: " + name + ": " + toStringInst(inst));
};

ARMv7_CPU.prototype.push_used = function(name, list) {
    if (!this.options.enable_logger)
        return;
    logger.log("PUSH: " + name + ": " + toStringBin16(list));
};

ARMv7_CPU.prototype.pop_used = function(name, list) {
    if (!this.options.enable_logger)
        return;
    logger.log("POP: " + name + ": " + toStringBin16(list));
};

ARMv7_CPU.prototype.print_pc = function(newpc, oldpc) {
    if (!this.options.enable_logger)
        return;
    if (oldpc)
        logger.log("PC: " + newpc.toString(16) + " from " + oldpc.toString(16) + "(" + (newpc-oldpc).toString(16) + ")");
    else
        logger.log("PC: " + newpc.toString(16));
};

ARMv7_CPU.prototype.call_supervisor = function() {
    throw "SUPERVISOR";
};

ARMv7_CPU.prototype.toStringSymbol = function(addr) {
    if (Symbols[addr])
        return Symbols[addr] + "(" + addr.toString(16) + ")";
    else
        return addr.toString(16);
};

/*
 * Load/Store operations
 */
ARMv7_CPU.prototype.allow_unaligned_access = function() {
    if (!this.mmu.check_unaligned)
        return true;
    else
        return false;
};

ARMv7_CPU.prototype.ld_word = function(addr) {
    if (addr == this.options.show_act_on_viraddr)
        display.log("@" + this.regs[15].toString(16) + ": " + this.toStringSymbol(addr) + ": read");

    var phyaddr;
    if (addr & 3) {
        if (!this.allow_unaligned_access()) {
            throw "Unaligned ld_word: " + this.current + "@" + toStringHex32(addr);
        } else {
            var val = 0;
            var mmu = this.mmu;
            var memctlr = this.memctlr;
            for (var i=0; i < 4; i++) {
                phyaddr = mmu.trans_to_phyaddr(addr + i);
                val = bitops.set_bits(val, 8*i+7, 8*i, memctlr.ld_byte(phyaddr));
            }
            return val;
        }
    } else {
        phyaddr = this.mmu.trans_to_phyaddr(addr);
        return this.memctlr.ld_word(phyaddr);
    }
};

ARMv7_CPU.prototype.st_word = function(addr, word) {
    if (addr == this.options.show_act_on_viraddr)
        display.log("@" + this.regs[15].toString(16) + ": " + this.toStringSymbol(addr) + ": write " + toStringNum(word));

    var phyaddr;
    if (addr & 3) {
        if (!this.allow_unaligned_access()) {
            throw "Unaligned st_word: " + this.current + "@" + toStringHex32(addr);
        } else {
            var mmu = this.mmu;
            var memctlr = this.memctlr;
            for (var i=0; i < 4; i++) {
                phyaddr = mmu.trans_to_phyaddr(addr + i);
                memctlr.st_byte(phyaddr, bitops.get_bits(word, 8*i+7, 8*i));
            }
        }
    } else {
        phyaddr = this.mmu.trans_to_phyaddr(addr, true);
        this.memctlr.st_word(phyaddr, word);
    }
};

ARMv7_CPU.prototype.ld_halfword = function(addr) {
    var phyaddr;
    if (addr & 1) {
        if (!this.allow_unaligned_access()) {
            throw "Unaligned ld_halfword: " + this.current + "@" + toStringHex32(addr);
        } else {
            var val = 0;
            var mmu = this.mmu;
            var memctlr = this.memctlr;
            for (var i=0; i < 2; i++) {
                phyaddr = mmu.trans_to_phyaddr(addr + i);
                val = bitops.set_bits(val, 8*i+7, 8*i, memctlr.ld_byte(phyaddr));
            }
            return val;
        }
    } else {
        phyaddr = this.mmu.trans_to_phyaddr(addr);
        return this.memctlr.ld_halfword(phyaddr);
    }
};

ARMv7_CPU.prototype.st_halfword = function(addr, hw) {
    var phyaddr;
    if (addr & 1) {
        if (!this.allow_unaligned_access()) {
            throw "Unaligned st_halfword: " + this.current + "@" + toStringHex32(addr);
        } else {
            var mmu = this.mmu;
            var memctlr = this.memctlr;
            for (var i=0; i < 2; i++) {
                phyaddr = mmu.trans_to_phyaddr(addr + i);
                memctlr.st_byte(phyaddr, bitops.get_bits(hw, 8*i+7, 8*i));
            }
        }
    } else {
        phyaddr = this.mmu.trans_to_phyaddr(addr, true);
        this.memctlr.st_halfword(phyaddr, hw);
    }
};

ARMv7_CPU.prototype.ld_byte = function(addr) {
    var phyaddr = this.mmu.trans_to_phyaddr(addr);
    return this.memctlr.ld_byte(phyaddr);
};

ARMv7_CPU.prototype.st_byte = function(addr, b) {
    var phyaddr = this.mmu.trans_to_phyaddr(addr, true);
    this.memctlr.st_byte(phyaddr, b);
};

ARMv7_CPU.prototype.fetch_instruction = function(addr) {
    var phyaddr = this.mmu.trans_to_phyaddr(addr);
    return this.memctlr.ld_word_fast(phyaddr);
};

/*
 * Shift Operations
 */
ARMv7_CPU.prototype.shift_type_name = function(type) {
    switch (type) {
        case this.SRType_LSL: return "lsl";
        case this.SRType_LSR: return "lsr";
        case this.SRType_ASR: return "asr";
        case this.SRType_RRX: return "rrx";
        case this.SRType_ROR: return "ror";
        default: return "unknown";
    }
};

ARMv7_CPU.prototype.shift = function(value, type, amount, carry_in) {
    return this.shift_c(value, type, amount, carry_in);
};

ARMv7_CPU.prototype.decode_imm_shift = function(type, imm5) {
    /*
     * 0: LSL
     * 1: LSR
     * 2: ASR
     * 3: RRX or ROR (ARM encoding)
     * 3: RRX (In this emulator)
     * 4: ROR (In this emulator)
     */
    switch (type) {
        case 0:
            this.shift_t = type;
            this.shift_n = imm5;
            break;
        case 1:
        case 2:
            this.shift_t = type;
            if (imm5 === 0)
                this.shift_n = 32;
            else
                this.shift_n = imm5;
            break;
        case 3:
            if (imm5 === 0) {
                this.shift_t = type;
                this.shift_n = 1;
            } else {
                this.shift_t = this.SRType_ROR;
                this.shift_n = imm5;
            }
            break;
        default:
            throw "decode_imm_shift";
            break;
    }
};

ARMv7_CPU.prototype.shift_c = function(value, type, amount, carry_in) {
    var res;
    var result;
    if (amount === 0) {
        this.carry_out = carry_in;
        return value;
    } else {
        switch (type) {
            // FIXME
            case 0: // LSL
                //assert(amount > 0, "lsl: amount > 0");
                var val64 = new Number64(0, value);
                var extended = val64.lsl(amount);
                this.carry_out = extended.high & 1;
                return extended.low;
            case 1: // LSR
                //assert(amount > 0, "lsr: amount > 0");
                this.carry_out = (amount == 32) ? 0 : ((value >>> (amount - 1)) & 1);
                result = bitops.lsr(value, amount);
                //assert(result >= 0, "lsr: result = " + result.toString());
                return result;
            case 2: // ASR
                //assert(amount > 0, "asr: amount > 0");
                this.carry_out = (amount == 32) ? 0 : ((value >>> (amount - 1)) & 1);
                result = bitops.asr(value, amount);
                return result;
            case 3: // RRX
                this.carry_out = value & 1;
                result = bitops.set_bit(value >>> 1, 31, carry_in);
                //assert(result >= 0, "rrx");
                return result;
            case 4: // ROR
                return this.ror_c(value, amount, true);
            default:
                throw "shift_c";
                return 0;
        }
    }
};

ARMv7_CPU.prototype.ror_c = function(value, amount, write) {
    //assert(amount !== 0);
    var result = bitops.ror(value, amount);
    //assert(result >= 0, "ror");
    if (write)
        this.carry_out = result >>> 31;
    return result;
};

ARMv7_CPU.prototype.ror = function(val, rotation) {
    if (rotation === 0)
        return val;
    return this.ror_c(val, rotation, false);
};

ARMv7_CPU.prototype.is_zero_bit = function(val) {
    if (val === 0)
        return 1;
    else
        return 0;
};

ARMv7_CPU.prototype.expand_imm_c = function(imm12, carry_in) {
    var unrotated_value = imm12 & 0xff;
    var amount = 2*(imm12 >>> 8);
    if (!amount) {
        this.carry_out = carry_in;
        return unrotated_value;
    }
    return this.ror_c(unrotated_value, amount, true);
};

ARMv7_CPU.prototype.expand_imm = function(imm12) {
    return this.expand_imm_c(imm12, this.cpsr.c);
};

ARMv7_CPU.prototype.add_with_carry = function(x, y, carry_in) {
    var unsigned_sum = x + y + carry_in;
    var signed_sum = (x|0) + (y|0) + carry_in;
    //var result = bitops.get_bits64(unsigned_sum, 31, 0);
    var result = unsigned_sum % 0x100000000;
    if (result < 0)
        result += 0x100000000;
    this.carry_out = (result == unsigned_sum) ? 0 : 1;
    this.overflow = ((result|0) == signed_sum) ? 0 : 1;
    return result;
};

ARMv7_CPU.prototype.decode_reg_shift = function(type) {
    this.shift_t = type;
    return type;
};

ARMv7_CPU.prototype.cond_postfix = function(inst) {
    var cond = bitops.get_bits(inst, 31, 28);
    switch (cond) {
        case 0: return "eq";
        case 1: return "ne";
        case 2: return "cs";
        case 3: return "cc";
        case 4: return "mi";
        case 8: return "hi";
        case 9: return "ls";
        case 0xa: return "ge";
        case 0xb: return "lt";
        case 0xc: return "gt";
        case 0xd: return "le";
        default:
            return "";
    }
};

ARMv7_CPU.prototype.is_valid = function(inst) {
    return (inst != 0xe1a00000 && inst !== 0); // NOP or NULL?
};

ARMv7_CPU.prototype.cond = function(inst) {
    var cond = inst >>> 28;
    var ret = false;
    switch (cond >> 1) {
        case 0:
            ret = this.cpsr.z == 1; // EQ or NE
            break;
        case 1:
            ret = this.cpsr.c == 1; // CS or CC
            break;
        case 2:
            ret = this.cpsr.n == 1; // MI or PL
            break;
        case 3:
            ret = this.cpsr.v == 1; // VS or VC
            break;
        case 4:
            ret = this.cpsr.c == 1 && this.cpsr.z === 0; // HI or LS
            break;
        case 5:
            ret = this.cpsr.n == this.cpsr.v; // GE or LT
            break;
        case 6:
            ret = this.cpsr.n == this.cpsr.v && this.cpsr.z === 0; // GT or LE
            break;
        case 7:
            ret = true; // AL
            break;
        default:
            break;
    }
    if ((cond & 1) && cond !== 0xf)
        ret = !ret;
    return ret;
};

/*
 *
 * Instruction Execution
 *
 */

/*
 * Immediate
 */
ARMv7_CPU.prototype.adc_imm = function(inst, addr) {
    this.print_inst("ADC (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;
    var imm32 = this.expand_imm(imm12);
    var ret = this.add_with_carry(this.reg(n), imm32, this.cpsr.c);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, true);
    }
    this.print_inst_imm(addr, inst, "adc", s, d, n, imm32);
};

ARMv7_CPU.prototype.add_imm = function(inst, addr) {
    this.print_inst("ADD (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;
    var imm32 = this.expand_imm(imm12);
    var ret = this.add_with_carry(this.reg(n), imm32, 0);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, true);
    }
    this.print_inst_imm(addr, inst, "add", s, d, n, imm32);
};

ARMv7_CPU.prototype.adr_a1 = function(inst, addr) {
    this.print_inst("ADR A1", inst, addr);
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;
    var imm32 = this.expand_imm(imm12);
    var ret = this.align(this.get_pc(), 4) + imm32;
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
    }
    this.print_inst_imm(addr, inst, "adr", null, d, null, imm32);
};

ARMv7_CPU.prototype.adr_a2 = function(inst, addr) {
    this.print_inst("ADR A2", inst, addr);
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;
    var imm32 = this.expand_imm(imm12);
    var ret = this.align(this.get_pc(), 4) - imm32;
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
    }
    this.print_inst_imm(addr, inst, "adr", null, d, null, imm32);
};

ARMv7_CPU.prototype.and_imm = function(inst, addr) {
    this.print_inst("AND (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;
    var imm32 = this.expand_imm_c(imm12, this.cpsr.c);

    var valn = this.reg(n);
    var ret = bitops.and(valn, imm32);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_imm(addr, inst, "and", s, d, n, imm32);
};

ARMv7_CPU.prototype.asr_imm = function(inst, addr) {
    this.print_inst("ASR (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var d = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var m = inst & 0xf;
    this.decode_imm_shift(2, imm5);
    var ret = this.shift_c(this.reg(m), this.SRType_ASR, this.shift_n, this.cpsr.c);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_imm(addr, inst, "asr", s, d, m, imm5);
};

ARMv7_CPU.prototype.bic_imm = function(inst, addr) {
    this.print_inst("BIC (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;

    var valn = this.reg(n);
    var imm32 = this.expand_imm_c(imm12, this.cpsr.c);
    var ret = bitops.and(valn, bitops.not(imm32));
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_imm(addr, inst, "bic", s, d, n, bitops.sint32(imm32));
};

ARMv7_CPU.prototype.b = function(inst, addr) {
    this.print_inst("B", inst, addr);
    var imm24 = inst & 0x00ffffff;
    //imm32 = SignExtend(imm24:'00', 32);
    //var imm32 = bitops.sign_extend(imm24 << 2, 26, 32);
    var imm26 = imm24 << 2;
    var imm32 = imm26;
    if (imm26 & 0x02000000)
        imm32 = imm26 | 0xfc000000;
    this.branch_to = this.get_pc() + imm32;
    if (this.branch_to >= 0x100000000)
        this.branch_to -= 0x100000000;
    this.print_inst_branch(addr, inst, "b", this.branch_to);
};

ARMv7_CPU.prototype.bl_imm = function(inst, addr) {
    this.print_inst("BL, BLX (immediate)", inst, addr);
    //var imm24 = bitops.get_bits(inst, 23, 0);
    //var imm32 = bitops.sign_extend(imm24 << 2, 26, 32);
    var imm24 = inst & 0x00ffffff;
    var imm26 = imm24 << 2;
    var imm32 = imm26;
    if (imm26 & 0x02000000)
        imm32 = imm26 | 0xfc000000;
    this.regs[14] = this.get_pc() - 4;
    // BranchWritePC(Align(PC,4) + imm32);
    this.branch_to = this.align(bitops.lsl((this.get_pc()) >>> 2, 2), 4) + imm32;
    if (this.branch_to >= 0x100000000)
        this.branch_to -= 0x100000000;
    this.print_inst_branch(addr, inst, "bl", this.branch_to);
};

ARMv7_CPU.prototype.cmn_imm = function(inst, addr) {
    this.print_inst("CMN (immediate)", inst, addr);
    var n = (inst >>> 16) & 0xf;
    var imm12 = inst & 0xfff;

    var valn = this.reg(n);
    var imm32 = this.expand_imm(imm12);
    var ret = this.add_with_carry(valn, imm32, 0);
    this.set_apsr(ret, true);
    this.print_inst_imm(addr, inst, "cmn", null, null, n, imm32);
};

ARMv7_CPU.prototype.cmp_imm = function(inst, addr) {
    this.print_inst("CMP (immediate)", inst, addr);
    var n = (inst >>>  16) & 0xf;
    var imm12 = inst & 0xfff;
    var valn = this.reg(n);
    var imm32 = this.expand_imm(imm12);
    var ret = this.add_with_carry(valn, bitops.not(imm32), 1);
    this.set_apsr(ret, true);
    this.print_inst_imm(addr, inst, "cmp", null, null, n, imm32);
};

ARMv7_CPU.prototype.eor_imm = function(inst, addr) {
    this.print_inst("EOR (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;
    var imm32 = this.expand_imm_c(imm12, this.cpsr.c);

    var valn = this.reg(n);
    var ret = bitops.xor(valn, imm32);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_imm(addr, inst, "eor", s, d, n, imm32);
};

ARMv7_CPU.prototype.ldr_imm = function(inst, addr) {
    this.print_inst("LDR (immediate)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm12 = (inst & 0xfff);

    if (n == 13 && p === 0 && u == 1 && w === 0 && imm12 === 4) {
        // POP A2
        if (t == 15)
            this.branch_to = this.ld_word(this.regs[13]);
        else
            this.regs[t] = this.ld_word(this.regs[13]);
        this.regs[13] = this.regs[13] + 4;
        this.print_inst_unimpl(addr, inst, "pop");
        return;
    }
    var imm32 = imm12;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn= this.reg(n);
    var offset_addr = valn + (is_add ? imm32 : -imm32);
    var address = is_index ? offset_addr : valn;
    var data = this.ld_word(address);
    if (is_wback)
        this.regs[n] = offset_addr;
    if (t == 15)
        this.branch_to = data;
    else
        this.regs[t] = data;
    this.print_inst_imm(addr, inst, "ldr", null, t, n, imm32, true, is_wback, is_add, is_index);
};

ARMv7_CPU.prototype.ldrb_imm = function(inst, addr) {
    this.print_inst("LDRB (immediate)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm32 = inst & 0xfff;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn= this.reg(n);
    var offset_addr = valn + (is_add ? imm32 : -imm32);
    var address = is_index ? offset_addr : valn;
    var data = this.ld_byte(address);
    this.regs[t] = data;
    if (is_wback)
        this.regs[n] = offset_addr;
    this.print_inst_imm(addr, inst, "ldrb", null, t, n, imm32, true, is_wback, is_add, is_index);
};

ARMv7_CPU.prototype.ldrd_imm = function(inst, addr) {
    this.print_inst("LDRD (immediate)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm4h = (inst >>> 8) & 0xf;
    var imm4l = inst & 0xf;
    var t2 = t + 1;
    var imm32 = (imm4h << 4) + imm4l;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn= this.reg(n);
    var offset_addr = valn + (is_add ? imm32 : -imm32);
    var address = is_index ? offset_addr : valn;
    this.regs[t] = this.ld_word(address);
    this.regs[t2] = this.ld_word(address+4);
    if (is_wback)
        this.regs[n] = offset_addr;
    this.print_inst_imm(addr, inst, "ldrd", null, t, n, imm32, true, is_wback, is_add, is_index);
};

ARMv7_CPU.prototype.ldrsh_imm = function(inst, addr) {
    this.print_inst("LDRSH (immediate)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm4h = (inst >>> 8) & 0xf;
    var imm4l = inst & 0xf;
    var imm32 = (imm4h << 4) + imm4l;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn= this.reg(n);
    var offset_addr = valn + (is_add ? imm32 : -imm32);
    var address = is_index ? offset_addr : valn;
    var data = this.ld_halfword(address);
    if (is_wback)
        this.regs[n] = offset_addr;
    this.regs[t] = bitops.sign_extend(data, 16, 32);
    this.print_inst_imm(addr, inst, "ldrsh", null, t, n, imm32, true, is_wback, is_add, is_index);
};

ARMv7_CPU.prototype.ldrsh_reg = function(inst, addr) {
    this.print_inst("LDRSH (register)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var m = inst & 0xf;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn= this.reg(n);
    var offset = this.shift(this.reg(m), this.SRType_LSL, 0, this.cpsr.c);
    var offset_addr = valn + (is_add ? offset : -offset);
    var address = is_index ? offset_addr : valn;
    var data = this.ld_halfword(address);
    if (is_wback)
        this.regs[n] = offset_addr;
    this.regs[t] = bitops.sign_extend(data, 16, 32);
    this.print_inst_reg(addr, inst, "ldrsh", null, t, n, m, this.SRType_LSL, 0);
};

ARMv7_CPU.prototype.lsl_imm = function(inst, addr) {
    this.print_inst("LSL (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var d = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var m = inst & 0xf;

    var valm = this.reg(m);
    this.decode_imm_shift(0, imm5);
    var ret = this.shift_c(valm, this.SRType_LSL, this.shift_n, this.cpsr.c);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_imm(addr, inst, "lsl", s, d, m, imm5);
};

ARMv7_CPU.prototype.lsr_imm = function(inst, addr) {
    this.print_inst("LSR (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var d = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var m = inst & 0xf;

    var valm = this.reg(m);
    this.decode_imm_shift(1, imm5);
    var ret = this.shift_c(valm, this.SRType_LSR, this.shift_n, this.cpsr.c);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_imm(addr, inst, "lsr", s, d, m, imm5);
};

ARMv7_CPU.prototype.mov_imm_a1 = function(inst, addr) {
    this.print_inst("MOV (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;
    var imm32 = this.expand_imm_c(imm12, this.cpsr.c);

    var ret = imm32;
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_imm(addr, inst, "mov", s, d, null, imm32);
};

ARMv7_CPU.prototype.mov_imm_a2 = function(inst, addr) {
    this.print_inst("MOV (immediate) A2", inst, addr);
    var imm4 = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;
    var imm32 = (imm4 << 12) + imm12;

    var ret = imm32;
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
    }
    this.print_inst_imm(addr, inst, "movw", false, d, null, imm32);
};

ARMv7_CPU.prototype.msr_imm_sys = function(inst, addr) {
    this.print_inst("MSR (immediate) (system level)", inst, addr);
    var r = inst & (1 << 22);
    var mask = (inst >>> 16) & 0xf;
    var imm12 = inst & 0xfff;
    var imm32 = this.expand_imm(imm12);

    if (r) {
        // SPSRWriteByInstr(R[n], mask);
        this.spsr_write_by_instr(this.parse_psr(imm32), mask);
    } else {
        // CPSRWriteByInstr(R[n], mask, FALSE);
        this.cpsr_write_by_instr(this.parse_psr(imm32), mask, false);
    }
    this.print_inst_msr(addr, inst, null, imm32);
};

ARMv7_CPU.prototype.mvn_imm = function(inst, addr) {
    this.print_inst("MVN (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;
    var imm32 = this.expand_imm_c(imm12, this.cpsr.c);

    var ret = bitops.not(imm32);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_imm(addr, inst, "mvn", s, d, null, imm32);
};

ARMv7_CPU.prototype.orr_imm = function(inst, addr) {
    this.print_inst("ORR (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;

    var valn = this.reg(n);
    var imm32 = this.expand_imm_c(imm12, this.cpsr.c);
    var ret = bitops.or(valn, imm32);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_imm(addr, inst, "orr", s, d, n, imm32);
};

ARMv7_CPU.prototype.hint_preload_data = function(address) {
    // FIXME
    this.log_value(address, "preload address");
};

ARMv7_CPU.prototype.pld_imm = function(inst, addr) {
    this.print_inst("PLD (immediate, literal)", inst, addr);
    var u = (inst >>> 23) & 1;
    var n = (inst >>> 16) & 0xf;
    var imm12 = inst & 0xfff;

    var valn = this.reg(n);
    var imm32 = imm12;
    var is_add = u == 1;
    var base = (n == 15) ? this.align(this.get_pc(), 4) : valn;
    var address = base + (is_add ? imm32 : -imm32);
    this.hint_preload_data(address);
    this.print_inst_imm(addr, inst, "pld", null, null, n, imm32, true, null, is_add, true);
};

ARMv7_CPU.prototype.rsb_imm = function(inst, addr) {
    this.print_inst("RSB (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;
    var imm32 = this.expand_imm(imm12);
    var valn = this.reg(n);
    var ret = this.add_with_carry(bitops.not(valn), imm32, 1);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, true);
    }
    this.print_inst_imm(addr, inst, "rsb", s, d, n, imm32);
};

ARMv7_CPU.prototype.rsc_imm = function(inst, addr) {
    this.print_inst("RSC (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;
    var imm32 = this.expand_imm(imm12);

    var valn = this.reg(n);
    var ret = this.add_with_carry(bitops.not(valn), imm32, this.cpsr.c);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, true);
    }
    this.print_inst_imm(addr, inst, "rsc", s, d, n, imm32);
};

ARMv7_CPU.prototype.ror_imm = function(inst, addr) {
    this.print_inst("ROR (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var d = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var m = inst & 0xf;

    var valm = this.reg(m);
    this.decode_imm_shift(3, imm5);
    var ret = this.shift_c(valm, this.SRType_ROR, this.shift_n, this.cpsr.c);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_imm(addr, inst, "ror", s, d, m, imm5);
};

ARMv7_CPU.prototype.rrx = function(inst, addr) {
    this.print_inst("RRX", inst, addr);
    var s = inst & 0x00100000;
    var d = (inst >>> 12) & 0xf;
    var m = inst & 0xf;

    var valm = this.reg(m);
    var ret = this.shift_c(valm, this.SRType_RRX, 1, this.cpsr.c);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    //this.print_inst_imm(addr, inst, "rrx", s, d, m, null);
    this.print_inst_unimpl(addr, inst, "rrx");
};

ARMv7_CPU.prototype.sbc_imm = function(inst, addr) {
    this.print_inst("SBC (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;
    var imm32 = this.expand_imm(imm12);

    var valn = this.reg(n);
    var ret = this.add_with_carry(valn, bitops.not(imm32), this.cpsr.c);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, true);
    }
    this.print_inst_imm(addr, inst, "sbc", s, d, n, imm32);
};

ARMv7_CPU.prototype.str_imm = function(inst, addr) {
    this.print_inst("STR (immediate)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;
    var address;
    if (n == 13 && p == 1 && u === 0 && w == 1 && imm12 == 4) {
        // PUSH A2
        var sp = this.reg(13);
        address = sp - 4;
        this.st_word(address, this.reg(t));
        this.regs[13] = sp - 4;
        return;
    }
    var imm32 = imm12;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;
    var valn= this.reg(n);
    var offset_addr = valn + (is_add ? imm32 : -imm32);
    address = is_index ? offset_addr : valn;
    var valt = this.reg(t);
    this.st_word(address, valt);
    if (is_wback)
        this.regs[n] = offset_addr;
    this.print_inst_imm(addr, inst, "str", null, t, n, imm32, true, is_wback, is_add, is_index);
};

ARMv7_CPU.prototype.strb_imm = function(inst, addr) {
    this.print_inst("STRB (immediate)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm32 = inst & 0xfff;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn= this.reg(n);
    var offset_addr = valn + (is_add ? imm32 : -imm32);
    var address = is_index ? offset_addr : valn;
    this.st_byte(address, this.reg(t) & 0xff);
    if (is_wback)
        this.regs[n] = offset_addr;
    this.print_inst_imm(addr, inst, "strb", null, t, n, imm32, true, is_wback, is_add, is_index);
};

ARMv7_CPU.prototype.sub_imm = function(inst, addr) {
    this.print_inst("SUB (immediate)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm12 = inst & 0xfff;
    var imm32 = this.expand_imm(imm12);

    var ret = this.add_with_carry(this.reg(n), bitops.not(imm32), 1);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, true);
    }
    this.print_inst_imm(addr, inst, "sub", s, d, n, imm32);
};

ARMv7_CPU.prototype.teq_imm = function(inst, addr) {
    this.print_inst("TEQ (immediate)", inst, addr);
    var n = (inst >>> 16) & 0xf;
    var imm12 = inst & 0xfff;

    var valn = this.reg(n);
    var imm32 = this.expand_imm_c(imm12, this.cpsr.c);
    var ret = bitops.xor(valn, imm32);
    this.set_apsr(ret, false);
    this.print_inst_imm(addr, inst, "teq", null, null, n, imm32);
};

ARMv7_CPU.prototype.tst_imm = function(inst, addr) {
    this.print_inst("TST (immediate)", inst, addr);
    var n = (inst >>> 16) & 0xf;
    var imm12 = inst & 0xfff;

    var valn = this.reg(n);
    var imm32 = this.expand_imm_c(imm12, this.cpsr.c);
    var ret = bitops.and(valn, imm32);
    this.set_apsr(ret, false);
    this.print_inst_imm(addr, inst, "tst", null, null, n, imm32);
};

/*
 * Literal
 */
ARMv7_CPU.prototype.ldr_lit = function(inst, addr) {
    this.print_inst("LDR (literal)", inst, addr);
    var u = inst & (1 << 23);
    var t = (inst >>> 12) & 0xf;
    var imm32 = inst & 0xfff;

    var base = this.align(this.get_pc(), 4);
    var address = base + (u ? imm32 : -imm32);
    var data = this.ld_word(address);
    if (t == 15)
        this.branch_to = data;
    else
        this.regs[t] = data;
    this.print_inst_imm(addr, inst, "ldr", null, t, 15, imm32, true, null, u, true);
};

/*
 * Register
 */
ARMv7_CPU.prototype.adc_reg = function(inst, addr) {
    this.print_inst("ADC (register)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var valn = this.reg(n);
    var valm = this.reg(m);
    this.decode_imm_shift(type, imm5);
    var shifted = this.shift(valm, this.shift_t, this.shift_n, this.cpsr.c);
    var ret = this.add_with_carry(valn, shifted, this.cpsr.c);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, true);
    }
    this.print_inst_reg(addr, inst, "adc", s, d, n, m, this.shift_t, this.shift_n);
};

ARMv7_CPU.prototype.add_reg = function(inst, addr) {
    this.print_inst("ADD (register)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var valn = this.reg(n);
    var valm = this.reg(m);
    this.decode_imm_shift(type, imm5);
    var shifted = this.shift(valm, this.shift_t, this.shift_n, this.cpsr.c);
    var ret = this.add_with_carry(valn, shifted, 0);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, true);
    }
    this.print_inst_reg(addr, inst, "add", s, d, n, m, this.shift_t, this.shift_n);
};

ARMv7_CPU.prototype.and_reg = function(inst, addr) {
    this.print_inst("AND (register)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var valn = this.reg(n);
    var valm = this.reg(m);
    this.decode_imm_shift(type, imm5);
    var shifted = this.shift_c(valm, this.shift_t, this.shift_n, this.cpsr.c);
    var ret = bitops.and(valn, shifted);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_reg(addr, inst, "and", s, d, n, m, this.shift_t, this.shift_n);
};

ARMv7_CPU.prototype.asr_reg = function(inst, addr) {
    this.print_inst("ASR (register)", inst, addr);
    var s = inst & 0x00100000;
    var d = (inst >>> 12) & 0xf;
    var m = (inst >>> 8) & 0xf;
    var n = inst & 0xf;

    var shift_n = bitops.get_bits(this.reg(m), 7, 0);
    var ret = this.shift_c(this.reg(n), this.SRType_ASR, shift_n, this.cpsr.c);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_reg(addr, inst, "asr", s, d, n, m);
};

ARMv7_CPU.prototype.bic_reg = function(inst, addr) {
    this.print_inst("BIC (register)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var valn = this.reg(n);
    var valm = this.reg(m);
    this.decode_imm_shift(type, imm5);
    var shifted = this.shift_c(valm, this.shift_t, this.shift_n, this.cpsr.c);
    var ret = bitops.and(valn, bitops.not(shifted));
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_reg(addr, inst, "bic", s, d, n, m, this.shift_t, this.shift_n);
};

ARMv7_CPU.prototype.bfc = function(inst, addr) {
    this.print_inst("BFC", inst, addr);
    var msbit = (inst >>> 16) & 0x1f;
    var d = (inst >>> 12) & 0xf;
    var lsbit = (inst >>> 7) & 0x1f;

    if (msbit >= lsbit)
        this.regs[d] = bitops.clear_bits(this.regs[d], msbit, lsbit);
    else
        this.abort_unpredictable("BFC", inst, addr);
    this.print_inst_ubfx(addr, inst, "bfc", d, null, msbit, lsbit);
};

ARMv7_CPU.prototype.bfi = function(inst, addr) {
    this.print_inst("BFI", inst, addr);
    var msbit = (inst >>> 16) & 0x1f;
    var d = (inst >>> 12) & 0xf;
    var lsbit = (inst >>> 7) & 0x1f;
    var n = inst & 0xf;

    if (msbit >= lsbit)
        this.regs[d] = bitops.set_bits(this.regs[d], msbit, lsbit, bitops.get_bits(this.reg(n), msbit-lsbit, 0));
    else
        this.abort_unpredictable("BFI", inst, addr);
    this.print_inst_ubfx(addr, inst, "bfi", d, n, msbit, lsbit);
};

ARMv7_CPU.prototype.blx_reg = function(inst, addr) {
    this.print_inst("BLX (register)", inst, addr);
    var m = inst & 0xf;

    var next_instr_addr = this.get_pc() - 4;
    this.regs[14] = next_instr_addr;
    this.branch_to = this.reg(m);
    //this.print_inst_reg(addr, inst, "blx", null, null, null, m);
    this.print_inst_branch(addr, inst, "blx", this.branch_to, m);
};

ARMv7_CPU.prototype.bx = function(inst, addr) {
    this.print_inst("BX", inst, addr);
    var m = inst & 0xf;

    this.branch_to = this.reg(m);
    this.print_inst_branch(addr, inst, "bx", this.branch_to, m);
};

ARMv7_CPU.prototype.cdp_a1 = function(inst, addr) {
    this.print_inst("CDP, CDP2 A1?", inst, addr);
    var t = (inst >>> 12) & 0xf;
    var cp = (inst >>> 8) & 0xf;

    if ((cp >> 1) == 5) {
        this.abort_simdvfp_inst(inst, addr);
    }
    if (!this.coproc_accepted(cp)) {
        throw "GenerateCoprocessorException(): " + cp;
    } else {
        this.coproc_internal_operation(cp, inst);
    }
    //this.print_inst_mcrmrc(inst, "cdp", t, cp);
    this.print_inst_unimpl(addr, inst, "cdp");
};

ARMv7_CPU.prototype.clz = function(inst, addr) {
    this.print_inst("CLZ", inst, addr);
    var d = (inst >>> 12) & 0xf;
    var m = inst & 0xf;

    this.regs[d] = bitops.count_leading_zero_bits(this.reg(m));
    this.print_inst_reg(addr, inst, "clz", null, d, null, m);
};

ARMv7_CPU.prototype.cmn_reg = function(inst, addr) {
    this.print_inst("CMN (register)", inst, addr);
    var n = (inst >>> 16) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var valn = this.reg(n);
    var valm = this.reg(m);
    this.decode_imm_shift(type, imm5);
    var shifted = this.shift(valm, this.shift_t, this.shift_n, this.cpsr.c);
    var ret = this.add_with_carry(valn, shifted, 0);
    this.set_apsr(ret, true);
    this.print_inst_reg(addr, inst, "cmn", null, null, n, m, this.shift_t, this.shift_n);
};

ARMv7_CPU.prototype.cmp_reg = function(inst, addr) {
    this.print_inst("CMP (register)", inst, addr);
    var n = (inst >>> 16) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var valn = this.reg(n);
    var valm = this.reg(m);
    this.decode_imm_shift(type, imm5);
    var shifted = this.shift(valm, this.shift_t, this.shift_n, this.cpsr.c);
    var ret = this.add_with_carry(valn, bitops.not(shifted), 1);
    this.set_apsr(ret, true);
    this.print_inst_reg(addr, inst, "cmp", null, null, n, m, this.shift_t, this.shift_n);
};

ARMv7_CPU.prototype.eor_reg = function(inst, addr) {
    this.print_inst("EOR (register)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var valn = this.reg(n);
    var valm = this.reg(m);
    this.decode_imm_shift(type, imm5);
    var shifted = this.shift_c(valm, this.shift_t, this.shift_n, this.cpsr.c);
    var ret = bitops.xor(valn, shifted);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_reg(addr, inst, "eor", s, d, n, m, this.shift_t, this.shift_n);
};

ARMv7_CPU.prototype.ldr_reg = function(inst, addr) {
    this.print_inst("LDR (register)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn = this.reg(n);
    this.decode_imm_shift(type, imm5);
    var offset = this.shift(this.reg(m), this.shift_t, this.shift_n, this.cpsr.c);
    var offset_addr = valn + (is_add ? offset : -offset);
    var address = is_index ? offset_addr : valn;
    address = bitops.get_bits64(address, 31, 0); // XXX
    var data = this.ld_word(address);
    if (is_wback)
        this.regs[n] = offset_addr;
    if (t == 15)
        this.branch_to = data;
    else
        this.regs[t] = data;
    this.print_inst_reg(addr, inst, "ldr", null, t, n, m, this.shift_t, this.shift_n, true, is_wback);
};

ARMv7_CPU.prototype.ldrb_reg = function(inst, addr) {
    this.print_inst("LDRB (register)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    this.decode_imm_shift(type, imm5);
    var valn = this.reg(n);
    var offset = this.shift(this.reg(m), this.shift_t, this.shift_n, this.cpsr.c);
    var offset_addr = valn + (is_add ? offset : -offset);
    var address = is_index ? offset_addr : valn;
    var data = this.ld_byte(address);
    this.regs[t] = data;
    if (is_wback)
        this.regs[n] = offset_addr;
    this.print_inst_reg(addr, inst, "ldrb", null, t, n, m, this.shift_t, this.shift_n, true, is_wback, is_index);
};

ARMv7_CPU.prototype.ldrd_reg = function(inst, addr) {
    this.print_inst("LDRD (register)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var m = inst & 0xf;
    var t2 = t + 1;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn = this.reg(n);
    var valm = this.reg(m);
    var offset_addr = valn + (is_add ? valm : -valm);
    var address = is_index ? offset_addr : valn;
    this.regs[t] = this.ld_word(address);
    this.regs[t2] = this.ld_word(address + 4);
    if (is_wback)
        this.regs[n] = offset_addr;
    this.print_inst_reg(addr, inst, "ldrd", null, t, n, m, null, null, true, is_wback, is_index);
};

ARMv7_CPU.prototype.ldrex = function(inst, addr) {
    this.print_inst("LDREX", inst, addr);
    var n = bitops.get_bits(inst, 19, 16);
    var t = bitops.get_bits(inst, 15, 12);

    var imm32 = 0;
    var address = this.reg(n) + imm32;
    // SetExclusiveMonitors(address,4);
    // R[t] = MemA[address,4];
    this.regs[t] = this.ld_word(address);
    this.print_inst_reg(addr, inst, "ldrex", null, t, n, null, null, null, true, false);
};

ARMv7_CPU.prototype.ldrt_a1 = function(inst, addr) {
    this.print_inst("LDRT A1", inst, addr);
    var u = (inst >>> 23) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm32 = inst & 0xfff;
    var is_add = u == 1;

    var valn = this.reg(n);
    var offset = imm32;
    var offset_addr = valn + (is_add ? offset : -offset);
    var address = valn;
    address = bitops.get_bits64(address, 31, 0); // XXX
    var data = this.ld_word(address);
    if (t == 15)
        this.branch_to = data;
    else
        this.regs[t] = data;
    //this.print_inst_reg(addr, inst, "ldrt", null, t, n, m, this.shift_t, this.shift_n, true, is_wback);
};

ARMv7_CPU.prototype.lsl_reg = function(inst, addr) {
    this.print_inst("LSL (register)", inst, addr);
    var s = inst & 0x00100000;
    var d = (inst >>> 12) & 0xf;
    var m = (inst >>> 8) & 0xf;
    var n = inst & 0xf;

    var shift_n = bitops.get_bits(this.reg(m), 7, 0);
    var ret = this.shift_c(this.reg(n), this.SRType_LSL, shift_n, this.cpsr.c);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_reg(addr, inst, "lsl", s, d, n, m);
};

ARMv7_CPU.prototype.lsr_reg = function(inst, addr) {
    this.print_inst("LSR (register)", inst, addr);
    var s = inst & 0x00100000;
    var d = (inst >>> 12) & 0xf;
    var m = (inst >>> 8) & 0xf;
    var n = inst & 0xf;

    var shift_n = bitops.get_bits(this.reg(m), 7, 0);
    var ret = this.shift_c(this.reg(n), this.SRType_LSR, shift_n, this.cpsr.c);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_reg(addr, inst, "lsr", s, d, n, m);
};

ARMv7_CPU.prototype.mcr_a1 = function(inst, addr) {
    this.print_inst("MCR, MCR2 A1", inst, addr);
    var t = (inst >>> 12) & 0xf;
    var cp = (inst >>> 8) & 0xf;

    if ((cp >> 1) == 5) {
        this.abort_simdvfp_inst(inst, addr);
    }
    if (!this.coproc_accepted(cp)) {
        throw "GenerateCoprocessorException()";
    } else {
        this.coproc_send_word(cp, inst, this.regs[t]);
    }
    this.print_inst_mcrmrc(addr, inst, "mcr", t, cp);
};

ARMv7_CPU.prototype.mla = function(inst, addr) {
    this.print_inst("MLA", inst, addr);
    var s = inst & 0x00100000;
    var d = (inst >>> 16) & 0xf;
    var a = (inst >>> 12) & 0xf;
    var m = (inst >>> 8) & 0xf;
    var n = inst & 0xf;

    var ope1 = this.reg(n);
    var ope2 = this.reg(m);
    var addend = this.reg(a);
    var n64_ope1 = new Number64(0, ope1);
    var n64_ope2 = new Number64(0, ope2);
    var n64_addend = new Number64(0, addend);
    var n64 = n64_ope1.mul(n64_ope2);
    var ret = n64.add(n64_addend);
    this.regs[d] = ret.low;
    if (s) {
        this.cpsr.n = (ret.low >>> 31) & 1;
        this.cpsr.z = (ret === 0) ? 1 : 0;
        this.log_apsr();
    }
    this.print_inst_reg(addr, inst, "mla", s, d, n, m); // FIXME
};


ARMv7_CPU.prototype.mls = function(inst, addr) {
    this.print_inst("MLS", inst, addr);
    var d = (inst >>> 16) & 0xf;
    var a = (inst >>> 12) & 0xf;
    var m = (inst >>> 8) & 0xf;
    var n = inst & 0xf;

    var ope1 = this.reg(n);
    var ope2 = this.reg(m);
    var addend = this.reg(a);
    var n64_ope1 = new Number64(0, ope1);
    var n64_ope2 = new Number64(0, ope2);
    var n64_addend = new Number64(0, addend);
    var n64 = n64_ope1.mul(n64_ope2);
    var ret = n64_addend.sub(n64);
    this.regs[d] = ret.low;
    this.print_inst_mul(addr, inst, "mls", null, n, d, m, a);
};

ARMv7_CPU.prototype.subs_pc_lr_a2 = function(inst, addr) {
    var opcode = (inst >>> 21) & 0xf;
    var n = (inst >>> 16) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    this.decode_imm_shift(type, imm5);
    var operand2 = this.shift(this.reg(m), this.shift_t, this.shift_n, this.cpsr.c);
    var ret;
    switch (opcode) {
        case 0:
            ret = bitops.and(this.reg(n), operand2);
            break;
        case 1:
            ret = bitops.xor(this.reg(n), operand2);
            break;
        case 2:
            ret = this.add_with_carry(this.reg(n), bitops.not(operand2), 1);
            break;
        case 3:
            ret = this.add_with_carry(bitops.not(this.reg(n)), operand2, 1);
            break;
        case 4:
            ret = this.add_with_carry(this.reg(n), operand2, 0);
            break;
        case 5:
            ret = this.add_with_carry(this.reg(n), operand2, this.cpsr.c);
            break;
        case 6:
            ret = this.add_with_carry(this.reg(n), bitops.not(operand2), this.cpsr.c);
            break;
        case 7:
            ret = this.add_with_carry(bitops.not(this.reg(n)), operand2, this.cpsr.c);
            break;
        case 0xc:
            ret = bitops.or(this.reg(n), operand2);
            break;
        case 0xd:
            ret = operand2;
            break;
        case 0xe:
            ret = bitops.and(this.reg(n), bitops.not(operand2));
            break;
        case 0xf:
            ret = bitops.not(operand2);
            break;
        default:
            throw "subs_pc_lr_a2: unknown opcode";
            break;
    }
    this.cpsr_write_by_instr(this.get_current_spsr(), 15, true);
    this.branch_to = ret;
    this.print_inst_unimpl(addr, inst, "subs");
};

ARMv7_CPU.prototype.mov_reg = function(inst, addr) {
    var s = inst & 0x00100000;
    var d = (inst >>> 12) & 0xf;
    var m = inst & 0xf;
    if (d == 15 && s) {
        this.print_inst("SUBS PC LR A2", inst, addr);
        this.subs_pc_lr_a2(inst, addr);
        return;
    }

    var ret = this.reg(m);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s) {
            this.cpsr.n = ret >>> 31;
            this.cpsr.z = (ret === 0) ? 1 : 0;
            // FIXME: APSR.C = carry;
            // I guess carry == 0
            //this.cpsr.c(bitops.get_bit(value, 29));
            //this.abort_not_impl("MOV (register) flag", inst, addr);
            this.log_apsr();
        }
    }
    this.print_inst_reg(addr, inst, "mov", s, d, null, m);
};

ARMv7_CPU.prototype.mrc_a1 = function(inst, addr) {
    var t = (inst >>> 12) & 0xf;
    var cp = (inst >>> 8) & 0xf;
    if ((cp >> 1) == 5) {
        this.abort_simdvfp_inst(inst, addr);
    }
    if (!this.coproc_accepted(cp)) {
        throw "GenerateCoprocessorException()";
    } else {
        var value = this.coproc_get_word(cp, inst);
        if (t != 15) {
            this.regs[t] = value;
        } else {
            this.cpsr.n = (value >>> 31) & 1;
            this.cpsr.z = (value >>> 30) & 1;
            this.cpsr.c = (value >>> 29) & 1;
            this.cpsr.v = (value >>> 28) & 1;
            this.log_apsr();
        }
    }
    this.print_inst_mcrmrc(addr, inst, "mrc", t, cp);
};

ARMv7_CPU.prototype.mrs = function(inst, addr) {
    this.print_inst("MRS", inst, addr);
    var read_spsr = inst & (1 << 22);
    var d = (inst >>> 12) & 0xf;

    if (read_spsr) {
        if (this.is_user_or_system())
            this.abort_unpredictable("MRS", inst, addr);
        else 
            this.regs[d] = this.psr_to_value(this.get_current_spsr());
    } else {
        // CPSR AND '11111000 11111111 00000011 11011111'
        this.regs[d] = bitops.and(this.psr_to_value(this.cpsr), 0xf8ff03df);
    }
    this.print_inst_mrs(addr, inst, d);
};

ARMv7_CPU.prototype.msr_reg_sys = function(inst, addr) {
    this.print_inst("MSR (register) (system level)", inst, addr);
    var r = inst & (1 << 22);
    var mask = (inst >>> 16) & 0xf;
    var n = inst & 0xf;

    if (r) {
        // SPSRWriteByInstr(R[n], mask);
        this.spsr_write_by_instr(this.parse_psr(this.reg(n)), mask);
    } else {
        // CPSRWriteByInstr(R[n], mask, FALSE);
        this.cpsr_write_by_instr(this.parse_psr(this.reg(n)), mask, false);
    }
    this.print_inst_msr(addr, inst, n);
};

ARMv7_CPU.prototype.mul = function(inst, addr) {
    this.print_inst("MUL", inst, addr);
    var s = inst & 0x00100000;
    var d = (inst >>> 16) & 0xf;
    var m = (inst >>> 8) & 0xf;
    var n = inst & 0xf;

    var ope1 = this.reg(n);
    var ope2 = this.reg(m);
    var n64_ope1 = new Number64(0, ope1);
    var n64_ope2 = new Number64(0, ope2);
    var ret = n64_ope1.mul(n64_ope2);
    this.regs[d] = ret.low;
    if (s) {
        //this.cpsr.n = bitops.get_bit(ret.low, 31);
        this.cpsr.n = ret.low >>> 31;
        this.cpsr.z = (ret === 0) ? 1 : 0;
        this.log_apsr();
    }
    this.print_inst_reg(addr, inst, "mul", s, d, n, m); // FIXME
};

ARMv7_CPU.prototype.mvn_reg = function(inst, addr) {
    this.print_inst("MVN (register)", inst, addr);
    var s = inst & 0x00100000;
    var d = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var valm = this.reg(m);
    this.decode_imm_shift(type, imm5);
    var shifted = this.shift_c(valm, this.shift_t, this.shift_n, this.cpsr.c);
    var ret = bitops.not(shifted);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_reg(addr, inst, "mvn", s, d, null, m, this.shift_t, this.shift_n);
};

ARMv7_CPU.prototype.orr_reg = function(inst, addr) {
    this.print_inst("ORR (register)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var valn = this.reg(n);
    var valm = this.reg(m);
    this.decode_imm_shift(type, imm5);
    var shifted = this.shift_c(valm, this.shift_t, this.shift_n, this.cpsr.c);
    var ret = bitops.or(valn, shifted);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, false);
    }
    this.print_inst_reg(addr, inst, "orr", s, d, n, m, this.shift_t, this.shift_n);
};

ARMv7_CPU.prototype.rev = function(inst, addr) {
    this.print_inst("REV", inst, addr);
    var d = bitops.get_bits(inst, 15, 12);
    var m = bitops.get_bits(inst, 3, 0);

    var valm = this.reg(m);
    var ret = 0;
    ret = bitops.set_bits(ret, 31, 24, bitops.get_bits(valm, 7, 0));
    ret = bitops.set_bits(ret, 23, 16, bitops.get_bits(valm, 15, 8));
    ret = bitops.set_bits(ret, 15, 8, bitops.get_bits(valm, 23, 16));
    ret = bitops.set_bits(ret, 7, 0, bitops.get_bits(valm, 31, 24));
    this.regs[d] = ret;
    this.print_inst_reg(addr, inst, "rev", null, d, null, m);
};

ARMv7_CPU.prototype.rev16 = function(inst, addr) {
    this.print_inst("REV16", inst, addr);
    var d = bitops.get_bits(inst, 15, 12);
    var m = bitops.get_bits(inst, 3, 0);

    var valm = this.reg(m);
    var ret = 0;
    ret = bitops.set_bits(ret, 31, 24, bitops.get_bits(valm, 23, 16));
    ret = bitops.set_bits(ret, 23, 16, bitops.get_bits(valm, 31, 24));
    ret = bitops.set_bits(ret, 15, 8, bitops.get_bits(valm, 7, 0));
    ret = bitops.set_bits(ret, 7, 0, bitops.get_bits(valm, 15, 8));
    this.regs[d] = ret;
    this.print_inst_reg(addr, inst, "rev16", null, d, null, m);
};

ARMv7_CPU.prototype.rsb_reg = function(inst, addr) {
    this.print_inst("RSB (register)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var valn = this.reg(n);
    var valm = this.reg(m);
    this.decode_imm_shift(type, imm5);
    var shifted = this.shift(valm, this.shift_t, this.shift_n, this.cpsr.c);
    var ret = this.add_with_carry(bitops.not(valn), shifted, 1);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, true);
    }
    this.print_inst_reg(addr, inst, "rsb", s, d, n, m, this.shift_t, this.shift_n);
};

ARMv7_CPU.prototype.sbc_reg = function(inst, addr) {
    this.print_inst("SBC (register)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var valn = this.reg(n);
    var valm = this.reg(m);
    this.decode_imm_shift(type, imm5);
    var shifted = this.shift(valm, this.shift_t, this.shift_n, this.cpsr.c);
    var ret = this.add_with_carry(valn, bitops.not(shifted), this.cpsr.c);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, true);
    }
    this.print_inst_reg(addr, inst, "sbc", s, d, n, m, this.shift_t, this.shift_n);
};

ARMv7_CPU.prototype.sbfx = function(inst, addr) {
    this.print_inst("SBFX", inst, addr);
    var widthminus1 = (inst >>> 16) & 0x1f;
    var d = (inst >>> 12) & 0xf;
    var lsbit = (inst >>> 7) & 0x1f;
    var n = inst & 0xf;

    var msbit = lsbit + widthminus1;
    if (msbit <= 31)
        this.regs[d] = bitops.sign_extend(bitops.get_bits(this.reg(n), msbit, lsbit), msbit-lsbit+1, 32);
    else
        this.abort_unpredictable("SBFX", inst, addr);
    this.print_inst_ubfx(addr, inst, "sbfx", d, n, lsbit, widthminus1 + 1);
};

ARMv7_CPU.prototype.smlal = function(inst, addr) {
    this.print_inst("SMLAL", inst, addr);
    var s = inst & 0x00100000;
    var dhi = (inst >>> 16) & 0xf;
    var dlo = (inst >>> 12) & 0xf;
    var m = (inst >>> 8) & 0xf;
    var n = inst & 0xf;

    var n64_n = new Number64(0, this.reg(n));
    var n64_m = new Number64(0, this.reg(m));
    var n64 = new Number64(this.reg(dhi), this.reg(dlo));
    var ret = n64_n.mul(n64_m).add(n64);
    this.regs[dhi] = ret.high;
    this.regs[dlo] = ret.low;
    if (s) {
        this.cpsr.n = bitops.get_bit(ret.high, 31);
        this.cpsr.z = ret.is_zero() ? 1 : 0;
        this.log_apsr();
    }
    this.print_inst_mul(addr, inst, "smlal", s, dhi, dlo, n, m);
};

ARMv7_CPU.prototype.smull = function(inst, addr) {
    this.print_inst("SMULL", inst, addr);
    var s = inst & 0x00100000;
    var dhi = (inst >>> 16) & 0xf;
    var dlo = (inst >>> 12) & 0xf;
    var m = (inst >>> 8) & 0xf;
    var n = inst & 0xf;

    var n64_n = new Number64(0, this.reg(n));
    var n64_m = new Number64(0, this.reg(m));
    var ret = n64_n.mul(n64_m);
    this.regs[dhi] = ret.high;
    this.regs[dlo] = ret.low;
    if (s) {
        this.cpsr.n = bitops.get_bit(ret.high, 31);
        this.cpsr.z = ret.is_zero() ? 1 : 0;
        this.log_apsr();
    }
    this.print_inst_mul(addr, inst, "smull", s, dhi, dlo, n, m);
};

ARMv7_CPU.prototype.strex = function(inst, addr) {
    this.print_inst("STREX", inst, addr);
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var t = inst & 0xf;
    var imm32 = 0;

    var address = this.reg(n) + imm32;
    // ExclusiveMonitorsPass(address,4)
    this.st_word(address, this.reg(t));
    this.regs[d] = 0;
    // FIXME
    this.print_inst_reg(addr, inst, "strex", null, t, n, d, null, null, true, false);
};

ARMv7_CPU.prototype.sub_reg = function(inst, addr) {
    this.print_inst("SUB (register)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var valn = this.reg(n);
    var valm = this.reg(m);
    this.decode_imm_shift(type, imm5);
    var shifted = this.shift(valm, this.shift_t, this.shift_n, this.cpsr.c);
    var ret = this.add_with_carry(valn, bitops.not(shifted), 1);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (s)
            this.set_apsr(ret, true);
    }
    this.print_inst_reg(addr, inst, "sub", s, d, n, m, this.shift_t, this.shift_n);
};

ARMv7_CPU.prototype.sxtb = function(inst, addr) {
    this.print_inst("SXTB", inst, addr);
    var d = (inst >>> 12) & 0xf;
    var m = inst & 0xf;
    var rotation = ((inst >>> 10) & 3) << 3;

    var rotated = this.ror(this.reg(m), rotation);
    this.regs[d] = bitops.sign_extend(bitops.get_bits64(rotated, 7, 0), 8, 32);
    this.print_inst_reg(addr, inst, "sxtb", null, d, null, m);
};

ARMv7_CPU.prototype.sxth = function(inst, addr) {
    this.print_inst("SXTH", inst, addr);
    var d = (inst >>> 12) & 0xf;
    var m = inst & 0xf;
    var rotation = ((inst >>> 10) & 3) << 3;

    var rotated = this.ror(this.reg(m), rotation);
    this.regs[d] = bitops.sign_extend(bitops.get_bits64(rotated, 15, 0), 16, 32);
    this.print_inst_reg(addr, inst, "sxth", null, d, null, m);
};

ARMv7_CPU.prototype.sxtah = function(inst, addr) {
    this.print_inst("SXTAH", inst, addr);
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var m = inst & 0xf;
    var rotation = ((inst >>> 10) & 3) << 3;

    var rotated = this.ror(this.reg(m), rotation);
    var n64 = new Number64(0, this.reg(n));
    this.regs[d] = n64.add(bitops.sign_extend(bitops.get_bits64(rotated, 15, 0), 16, 32)).low;
    this.print_inst_reg(addr, inst, "sxtah", null, d, null, m);
};

ARMv7_CPU.prototype.teq_reg = function(inst, addr) {
    this.print_inst("TEQ (register)", inst, addr);
    var n = (inst >>> 16) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var valn = this.reg(n);
    var valm = this.reg(m);
    this.decode_imm_shift(type, imm5);
    var shifted = this.shift(valm, this.shift_t, this.shift_n, this.cpsr.c);
    var ret = bitops.xor(valn, shifted);
    this.set_apsr(ret, false);
    this.print_inst_reg(addr, inst, "teq", null, null, n, m, this.shift_t, this.shift_n);
};

ARMv7_CPU.prototype.tst_reg = function(inst, addr) {
    this.print_inst("TST (register)", inst, addr);
    var n = (inst >>> 16) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    this.decode_imm_shift(type, imm5);
    var valn = this.reg(n);
    var valm = this.reg(m);
    var shifted = this.shift_c(valm, this.shift_t, this.shift_n, this.cpsr.c);
    var ret = bitops.and(valn, shifted);
    this.set_apsr(ret, false);
    this.print_inst_reg(addr, inst, "tst", null, null, n, m, this.shift_t, this.shift_n);
};

ARMv7_CPU.prototype.ubfx = function(inst, addr) {
    this.print_inst("UBFX", inst, addr);
    var widthminus1 = bitops.get_bits(inst, 20, 16);
    var d = bitops.get_bits(inst, 15, 12);
    var lsbit = bitops.get_bits(inst, 11, 7);
    var n = bitops.get_bits(inst, 3, 0);

    var msbit = lsbit + widthminus1;
    if (msbit <= 31)
        this.regs[d] = bitops.get_bits(this.reg(n), msbit, lsbit);
    else
        this.abort_unpredictable("UBFX", inst, addr);
    this.print_inst_ubfx(addr, inst, "ubfx", d, n, lsbit, widthminus1 + 1);
};

ARMv7_CPU.prototype.umlal = function(inst, addr) {
    this.print_inst("UMLAL", inst, addr);
    var s = inst & 0x00100000;
    var dhi = bitops.get_bits(inst, 19, 16);
    var dlo = bitops.get_bits(inst, 15, 12);
    var m = bitops.get_bits(inst, 11, 8);
    var n = bitops.get_bits(inst, 3, 0);
    
    var n64_n = new Number64(0, this.reg(n));
    var n64_m = new Number64(0, this.reg(m));
    var n64_d = new Number64(this.reg(dhi), this.reg(dlo));
    var ret = n64_n.mul(n64_m).add(n64_d);
    this.regs[dhi] = ret.high;
    this.regs[dlo] = ret.low;
    if (s) {
        this.cpsr.n = bitops.get_bit(ret.high, 31);
        this.cpsr.z = ret.is_zero() ? 1 : 0;
        this.log_apsr();
    }
    this.print_inst_mul(addr, inst, "umlal", s, dhi, dlo, n, m);
};

ARMv7_CPU.prototype.umull = function(inst, addr) {
    this.print_inst("UMULL", inst, addr);
    var s = inst & 0x00100000;
    var dhi = bitops.get_bits(inst, 19, 16);
    var dlo = bitops.get_bits(inst, 15, 12);
    var m = bitops.get_bits(inst, 11, 8);
    var n = bitops.get_bits(inst, 3, 0);

    var n64_n = new Number64(0, this.reg(n));
    var n64_m = new Number64(0, this.reg(m));
    var ret = n64_n.mul(n64_m);
    this.regs[dhi] = ret.high;
    this.regs[dlo] = ret.low;
    if (s) {
        this.cpsr.n = bitops.get_bit(ret.high, 31);
        this.cpsr.z = ret.is_zero() ? 1 : 0;
        this.log_apsr();
    }
    this.print_inst_mul(addr, inst, "umull", s, dhi, dlo, n, m);
};

ARMv7_CPU.prototype.unsigned_satq = function(i, n) {
    var ret;
    if (i > (Math.pow(2, n) - 1)) {
        ret = Math.pow(2, n) - 1;
        this.saturated = true;
    } else if (i < 0) {
        ret = 0;
        this.saturated = true;
    } else {
        ret = i;
        this.saturated = false;
    }
    return bitops.get_bits64(ret, 31, 0);
};

ARMv7_CPU.prototype.usat = function(inst, addr) {
    this.print_inst("USAT", inst, addr);
    var saturate_to = bitops.get_bits(inst, 20, 16);
    var d = bitops.get_bits(inst, 15, 12);
    var imm5 = bitops.get_bits(inst, 11, 7);
    var sh = bitops.get_bit(inst, 6);
    var n = bitops.get_bits(inst, 3, 0);
    this.decode_imm_shift(sh << 1, imm5);

    var operand = this.shift(this.reg(n), this.shift_t, this.shift_n, this.cpsr.c);
    var ret = this.unsigned_satq(this.sint32(operand), saturate_to);
    this.regs[n] = ret;
    if (this.saturated)
        this.cpsr.q = 1;
    this.print_inst_unimpl(addr, inst, "usat");
};

ARMv7_CPU.prototype.uxtab = function(inst, addr) {
    this.print_inst("UXTAB", inst, addr);
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var rotation = ((inst >>> 10) & 3) << 3;
    var m = inst & 0xf;

    var rotated = this.ror(this.reg(m), rotation);
    this.regs[d] = this.reg(n) + bitops.get_bits64(rotated, 7, 0);
    this.print_inst_uxtab(addr, inst, "uxtab", d, n, m, rotation);
};

ARMv7_CPU.prototype.uxtb = function(inst, addr) {
    this.print_inst("UXTB", inst, addr);
    var d = (inst >>> 12) & 0xf;
    var m = inst & 0xf;
    var rotation = ((inst >>> 10) & 3) << 3;

    var rotated = this.ror(this.reg(m), rotation);
    this.regs[d] = bitops.get_bits64(rotated, 7, 0);
    this.print_inst_uxtab(addr, inst, "uxtb", d, null, m, rotation);
};

ARMv7_CPU.prototype.uxth = function(inst, addr) {
    this.print_inst("UXTH", inst, addr);
    var d = (inst >>> 12) & 0xf;
    var m = inst & 0xf;
    var rotation = ((inst >>> 10) & 3) << 3;

    var rotated = this.ror(this.reg(m), rotation);
    this.regs[d] = bitops.get_bits64(rotated, 15, 0);
    this.print_inst_uxtab(addr, inst, "uxth", d, null, m, rotation);
};

/*
 * Register-shifted Register
 */
ARMv7_CPU.prototype.add_rsr = function(inst, addr) {
    this.print_inst("ADD (register-shifted register)", inst, addr);
    var sf = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var s = (inst >>> 8) & 0xf;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var shift_t = this.decode_reg_shift(type);
    var shift_n = bitops.get_bits(this.reg(s), 7, 0);
    var shifted = this.shift(this.reg(m), shift_t, shift_n, this.cpsr.c);
    var ret = this.add_with_carry(this.reg(n), shifted, 0);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (sf)
            this.set_apsr(ret, true);
    }
    this.print_inst_rsr(addr, inst, "add", sf, d, n, m, shift_t, s);
};

ARMv7_CPU.prototype.and_rsr = function(inst, addr) {
    this.print_inst("AND (register-shifted register)", inst, addr);
    var sf = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var s = (inst >>> 8) & 0xf;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var shift_t = this.decode_reg_shift(type);
    var shift_n = bitops.get_bits(this.reg(s), 7, 0);
    var shifted = this.shift_c(this.reg(m), shift_t, shift_n, this.cpsr.c);
    var ret = bitops.and(this.reg(n), shifted);
    this.regs[d] = ret;
    if (sf)
        this.set_apsr(ret, false);
    this.print_inst_rsr(addr, inst, "and", sf, d, n, m, shift_t, s);
};

ARMv7_CPU.prototype.bic_rsr = function(inst, addr) {
    this.print_inst("BIC (register-shifted register)", inst, addr);
    var sf = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var s = (inst >>> 8) & 0xf;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var shift_t = this.decode_reg_shift(type);
    var shift_n = bitops.get_bits(this.reg(s), 7, 0);
    var shifted = this.shift_c(this.reg(m), shift_t, shift_n, this.cpsr.c);
    var ret = bitops.and(this.reg(n), bitops.not(shifted));
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (sf)
            this.set_apsr(ret, false);
    }
    this.print_inst_rsr(addr, inst, "bic", sf, d, n, m, shift_t, s);
};

ARMv7_CPU.prototype.cmp_rsr = function(inst, addr) {
    this.print_inst("CMP (register-shifted register)", inst, addr);
    var n = (inst >>> 16) & 0xf;
    var s = (inst >>> 8) & 0xf;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var shift_t = this.decode_reg_shift(type);
    var shift_n = bitops.get_bits(this.reg(s), 7, 0);
    var shifted = this.shift(this.reg(m), shift_t, shift_n, this.cpsr.c);
    var ret = this.add_with_carry(this.reg(n), bitops.not(shifted), 1);
    this.set_apsr(ret, true);
    this.print_inst_rsr(addr, inst, "cmp", null, null, n, m, shift_t, s);
};

ARMv7_CPU.prototype.eor_rsr = function(inst, addr) {
    this.print_inst("EOR (register-shifted register)", inst, addr);
    var sf = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var s = (inst >>> 8) & 0xf;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var shift_t = this.decode_reg_shift(type);
    var shift_n = bitops.get_bits(this.reg(s), 7, 0);
    var shifted = this.shift_c(this.reg(m), shift_t, shift_n, this.cpsr.c);
    var ret = bitops.xor(this.reg(n), shifted);
    this.regs[d] = ret;
    if (sf)
        this.set_apsr(ret, false);
    this.print_inst_rsr(addr, inst, "eor", sf, d, n, m, shift_t, s);
};

ARMv7_CPU.prototype.mvn_rsr = function(inst, addr) {
    this.print_inst("MVN (register-shifted register)", inst, addr);
    var sf = inst & 0x00100000;
    var d = (inst >>> 12) & 0xf;
    var s = (inst >>> 8) & 0xf;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var shift_t = this.decode_reg_shift(type);
    var shift_n = bitops.get_bits(this.reg(s), 7, 0);
    var shifted = this.shift_c(this.reg(m), shift_t, shift_n, this.cpsr.c);
    var ret = bitops.not(shifted);
    this.regs[d] = ret;
    if (sf)
        this.set_apsr(ret, false);
    this.print_inst_rsr(addr, inst, "mvn", sf, d, null, m, shift_t, s);
};

ARMv7_CPU.prototype.orr_rsr = function(inst, addr) {
    this.print_inst("ORR (register-shifted register)", inst, addr);
    var sf = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var s = (inst >>> 8) & 0xf;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var shift_t = this.decode_reg_shift(type);
    var shift_n = bitops.get_bits(this.reg(s), 7, 0);
    var shifted = this.shift_c(this.reg(m), shift_t, shift_n, this.cpsr.c);
    var ret = bitops.or(this.reg(n), shifted);
    this.regs[d] = ret;
    if (sf)
        this.set_apsr(ret, false);
    this.print_inst_rsr(addr, inst, "orr", sf, d, n, m, shift_t, s);
};

ARMv7_CPU.prototype.rsb_rsr = function(inst, addr) {
    this.print_inst("RSB (register-shifted register)", inst, addr);
    var sf = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var s = (inst >>> 8) & 0xf;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var shift_t = this.decode_reg_shift(type);
    var shift_n = bitops.get_bits(this.reg(s), 7, 0);
    var shifted = this.shift(this.reg(m), shift_t, shift_n, this.cpsr.c);
    var ret = this.add_with_carry(bitops.not(this.reg(n)), shifted, 1);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (sf)
            this.set_apsr(ret, true);
    }
    this.print_inst_rsr(addr, inst, "rsb", sf, d, n, m, shift_t, s);
};

ARMv7_CPU.prototype.sbc_rsr = function(inst, addr) {
    this.print_inst("SBC (register-shifted register)", inst, addr);
    var sf = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var s = (inst >>> 8) & 0xf;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var shift_t = this.decode_reg_shift(type);
    var shift_n = bitops.get_bits(this.reg(s), 7, 0);
    var shifted = this.shift(this.reg(m), shift_t, shift_n, this.cpsr.c);
    var ret = this.add_with_carry(this.reg(n), bitops.not(shifted), this.cpsr.c);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (sf)
            this.set_apsr(ret, true);
    }
    this.print_inst_rsr(addr, inst, "sbc", sf, d, n, m, shift_t, s);
};

ARMv7_CPU.prototype.sub_rsr = function(inst, addr) {
    this.print_inst("SUB (register-shifted register)", inst, addr);
    var sf = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var d = (inst >>> 12) & 0xf;
    var s = (inst >>> 8) & 0xf;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var shift_t = this.decode_reg_shift(type);
    var shift_n = bitops.get_bits(this.reg(s), 7, 0);
    var shifted = this.shift(this.reg(m), shift_t, shift_n, this.cpsr.c);
    var ret = this.add_with_carry(this.reg(n), bitops.not(shifted), 1);
    if (d == 15) {
        this.branch_to = ret;
    } else {
        this.regs[d] = ret;
        if (sf)
            this.set_apsr(ret, true);
    }
    this.print_inst_rsr(addr, inst, "sub", sf, d, n, m, shift_t, s);
};

ARMv7_CPU.prototype.tst_rsr = function(inst, addr) {
    this.print_inst("TST (register-shifted register)", inst, addr);
    var s = inst & 0x00100000;
    var n = (inst >>> 16) & 0xf;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;

    var shift_t = this.decode_reg_shift(type);
    var shift_n = bitops.get_bits(this.reg(s), 7, 0);
    var shifted = this.shift_c(this.reg(m), shift_t, shift_n, this.cpsr.c);
    var ret = bitops.and(this.reg(n), shifted);
    this.set_apsr(ret, false);
    this.print_inst_rsr(addr, inst, "tst", null, null, n, m, shift_t, s);
};

/*
 * Load Store
 */
ARMv7_CPU.prototype.ldrh_imm = function(inst, addr) {
    this.print_inst("LDRH (immediate)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm4h = (inst >>> 8) & 0xf;
    var imm4l = inst & 0xf;
    var imm32 = (imm4h << 4) + imm4l;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn = this.reg(n);
    var offset_addr = valn + (is_add ? imm32 : -imm32);
    var address = is_index ? offset_addr : valn;
    // data = MemU[address,2];
    var data = this.ld_halfword(address);
    if (is_wback)
        this.regs[n] = offset_addr;
    this.regs[t] = data;
    this.log_regs(null);
    this.print_inst_imm(addr, inst, "ldrh", null, t, n, imm32, true, is_wback, is_add);
};

ARMv7_CPU.prototype.ldrh_reg = function(inst, addr) {
    this.print_inst("LDRH (register)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var m = inst & 0xf;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn = this.reg(n);
    var offset = this.shift(this.reg(m), this.SRType_LSL, 0, this.cpsr.c);
    var offset_addr = valn + (is_add ? offset : -offset);
    var address = is_index ? offset_addr : valn;
    // data = MemU[address,2];
    var data = this.ld_halfword(address);
    if (is_wback)
        this.regs[n] = offset_addr;
    this.regs[t] = data;
    this.print_inst_reg(addr, inst, "ldrh", null, t, n, m, this.SRType_LSL, 0, true, is_wback, is_add);
};

ARMv7_CPU.prototype.ldrsb_imm = function(inst, addr) {
    this.print_inst("LDRSB (immediate)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm4h = (inst >>> 8) & 0xf;
    var imm4l = inst & 0xf;
    var imm32 = (imm4h << 4) + imm4l;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn = this.reg(n);
    var offset_addr = valn + (is_add ? imm32 : -imm32);
    var address = is_index ? offset_addr : valn;
    this.regs[t] = bitops.sign_extend(this.ld_byte(address), 8, 32);
    if (is_wback)
        this.regs[n] = offset_addr;
    //this.print_inst_reg(addr, inst, "ldrsb", null, t, n, m, null, null, true, is_wback, is_add);
    this.print_inst_unimpl(addr, inst, "ldrsb");
};

ARMv7_CPU.prototype.ldrsb_reg = function(inst, addr) {
    this.print_inst("LDRSB (register)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var m = inst & 0xf;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var offset = this.shift(this.reg(m), this.SRType_LSL, 0, this.cpsr.c);
    var valn = this.reg(n);
    var offset_addr = valn + (is_add ? offset : -offset);
    var address = is_index ? offset_addr : valn;
    this.regs[t] = bitops.sign_extend(this.ld_byte(address), 8, 32);
    if (is_wback)
        this.regs[n] = offset_addr;
    //this.print_inst_reg(addr, inst, "ldrsb", null, t, n, m, null, null, true, is_wback, is_add);
    this.print_inst_unimpl(addr, inst, "ldrsb");
};

ARMv7_CPU.prototype.str_reg = function(inst, addr) {
    this.print_inst("STR (register)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    this.decode_imm_shift(type, imm5);
    var valn = this.reg(n);
    var offset = this.shift(this.reg(m), this.shift_t, this.shift_n, this.cpsr.c);
    var offset_addr = valn + (is_add ? offset : -offset);
    var address = is_index ? offset_addr : valn;
    address = bitops.get_bits64(address, 31, 0); // XXX
    var data = this.reg(t);
    this.st_word(address, data);
    if (is_wback)
        this.regs[n] = offset_addr;
    this.print_inst_reg(addr, inst, "str", null, t, n, m, this.shift_t, this.shift_n, true, is_wback);
};

ARMv7_CPU.prototype.strbt_a1 = function(inst, addr) {
    this.print_inst("STRBT A1", inst, addr);
    var u = inst & (1 << 23);
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm32 = inst & 0xfff;
    var is_add = u == 1;

    var valn = this.reg(n);
    var offset = imm32;
    var offset_addr = valn + (is_add ? offset : -offset);
    this.st_byte(valn, bitops.get_bits(this.reg(t), 7, 0));
    this.regs[n] = offset_addr;
    this.print_inst_reg(addr, inst, "strbt", null, t, n, m, this.shift_t, this.shift_n, true, true);
};

ARMv7_CPU.prototype.strbt_a2 = function(inst, addr) {
    this.print_inst("STRBT A2", inst, addr);
    var u = (inst >>> 23) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;
    var is_add = u == 1;
    this.decode_imm_shift(type, imm5);

    var valn = this.reg(n);
    var offset = this.shift(this.reg(m), this.shift_t, this.shift_n, this.cpsr.c);
    var offset_addr = valn + (is_add ? offset : -offset);
    this.st_byte(valn, bitops.get_bits(this.reg(t), 7, 0));
    this.regs[n] = offset_addr;
    this.print_inst_reg(addr, inst, "strbt", null, t, n, m, this.shift_t, this.shift_n, true, true);
};

ARMv7_CPU.prototype.strb_reg = function(inst, addr) {
    this.print_inst("STRB (register)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm5 = (inst >>> 7) & 0x1f;
    var type = (inst >>> 5) & 3;
    var m = inst & 0xf;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    this.decode_imm_shift(type, imm5);
    var valn = this.reg(n);
    var offset = this.shift(this.reg(m), this.shift_t, this.shift_n, this.cpsr.c);
    var offset_addr = valn + (is_add ? offset : -offset);
    var address = is_index ? offset_addr : valn;
    this.st_byte(address, bitops.get_bits(this.reg(t), 7, 0));
    if (is_wback)
        this.regs[n] = offset_addr;
    this.print_inst_reg(addr, inst, "strb", null, t, n, m, this.shift_t, this.shift_n, true, is_wback);
};

ARMv7_CPU.prototype.strd_reg = function(inst, addr) {
    this.print_inst("STRD (register)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var m = inst & 0xf;
    var t2 = t + 1;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn = this.reg(n);
    var valm = this.reg(m);
    var offset_addr = valn + (is_add ? valm : -valm);
    var address = is_index ? offset_addr : valn;
    this.st_word(address, this.reg(t));
    this.st_word(address + 4, this.reg(t2));
    if (is_wback)
        this.regs[n] = offset_addr;
    this.print_inst_reg(addr, inst, "strd", null, t, n, m, null, null, true, is_wback, is_index);
};

ARMv7_CPU.prototype.strd_imm = function(inst, addr) {
    this.print_inst("STRD (immediate)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm4h = (inst >>> 8) & 0xf;
    var imm4l = inst & 0xf;
    var t2 = t + 1;
    var imm32 = (imm4h << 4) + imm4l;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn = this.reg(n);
    var offset_addr = valn + (is_add ? imm32 : -imm32);
    var address = is_index ? offset_addr : valn;
    this.st_word(address, this.reg(t));
    this.st_word(address + 4, this.reg(t2));
    if (is_wback)
        this.regs[n] = offset_addr;
    this.print_inst_imm(addr, inst, "strd", null, t, n, imm32, true, is_wback, is_add);
};

ARMv7_CPU.prototype.strh_imm = function(inst, addr) {
    this.print_inst("STRH (immediate)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var imm4h = (inst >>> 8) & 0xf;
    var imm4l = inst & 0xf;
    var imm32 = (imm4h << 4) + imm4l;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn = this.reg(n);
    var offset_addr = valn + (is_add ? imm32 : -imm32);
    var address = is_index ? offset_addr : valn;
    this.st_halfword(address, bitops.get_bits(this.reg(t), 15, 0));
    if (is_wback)
        this.regs[n] = offset_addr;
    this.print_inst_imm(addr, inst, "strh", null, t, n, imm32, true, is_wback, is_add);
};

ARMv7_CPU.prototype.strh_reg = function(inst, addr) {
    this.print_inst("STRH (register)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var t = (inst >>> 12) & 0xf;
    var m = inst & 0xf;
    var is_index = p == 1;
    var is_add = u == 1;
    var is_wback = p === 0 || w == 1;

    var valn = this.reg(n);
    var offset = this.shift(this.reg(m), this.SRType_LSL, 0, this.cpsr.c);
    var offset_addr = valn + (is_add ? offset : -offset);
    var address = is_index ? offset_addr : valn;
    this.st_halfword(address, bitops.get_bits(this.reg(t), 15, 0));
    if (is_wback)
        this.regs[n] = offset_addr;
    this.print_inst_reg(addr, inst, "strh", null, t, n, m, this.SRType_LSL, 0, true, is_wback, is_add);
};

ARMv7_CPU.prototype.ldm = function(inst, addr) {
    this.print_inst("LDM / LDMIA / LDMFD", inst, addr);
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var register_list = inst & 0xffff;
    var n_registers = bitops.bit_count(register_list, 16);
    var is_pop = false;
    if (w && n == 13 && n_registers >= 2) {
        is_pop = true;
    }
    var is_wback = w == 1;

    var valn = this.reg(n);
    var address = valn;
    var reglist = [];
    for (var i=0; i < 15; i++) {
        if ((register_list >>> i) & 1) {
            reglist.push(i);
            this.regs[i] = this.ld_word(address);
            address += 4;
        }
    }
    //if ((register_list >>> 15) & 1) {
    if (register_list & 0x8000) {
        reglist.push(15);
        this.branch_to = this.ld_word(address);
    }
    if (is_wback)
        this.regs[n] = this.reg(n) + 4 * n_registers;
    this.log_regs(null);
    if (is_pop)
        this.print_inst_ldstm(addr, inst, "pop", is_wback, null, reglist);
    else
        this.print_inst_ldstm(addr, inst, "ldm", is_wback, n, reglist);
};

ARMv7_CPU.prototype.ldm_er = function(inst, addr) {
    this.print_inst("LDM (exception return)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var register_list = inst & 0x7fff;
    var n_registers = bitops.bit_count(register_list, 15);
    var is_wback = w == 1;
    var is_increment = u == 1;
    var is_wordhigher = p == u;

    var valn = this.reg(n);
    if (this.is_user_or_system())
        this.abort_unpredictable("LDM (exception return)", inst, addr);
    var length = 4*n_registers + 4;
    var address = valn + (is_increment ? 0 : -length);
    if (is_wordhigher)
        address += 4;
    var reglist = [];
    for (var i=0; i < 15; i++) {
        if ((register_list >>> i) & 1) {
            reglist.push(i);
            this.regs[i] = this.ld_word(address);
            address += 4;
        }
    }
    var new_pc = this.ld_word(address);

    if (is_wback)
        this.regs[n] = valn + (is_increment ? length : -length);
    this.log_regs(null);
    this.cpsr_write_by_instr(this.get_current_spsr(), 15, true);
    this.branch_to = new_pc;
    //this.print_inst_ldstm(addr, inst, "ldm", is_wback, n, reglist);
    this.print_inst_unimpl(addr, inst, "ldm");
};

ARMv7_CPU.prototype.ldm_ur = function(inst, addr) {
    this.print_inst("LDM (user registers)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var n = (inst >>> 16) & 0xf;
    var register_list = inst & 0x7fff;
    var n_registers = bitops.bit_count(register_list, 15);
    var is_increment = u == 1;
    var is_wordhigher = p == u;

    var valn = this.reg(n);
    if (this.is_user_or_system())
        this.abort_unpredictable("LDM (user registers)", inst, addr);
    var length = 4*n_registers;
    var address = valn + (is_increment ? 0 : -length);
    if (is_wordhigher)
        address += 4;
    var reglist = [];
    this.log_regs(null);
    for (var i=0; i < 15; i++) {
        if ((register_list >>> i) & 1) {
            reglist.push(i);
            // FIXME
            this.regs_usr[i] = this.ld_word(address);
            if (this.cpsr.m == this.FIQ_MODE) {
                if (!(i >= 8 && i <= 14))
                    this.regs[i] = this.regs_usr[i];
            } else {
                if (!(i >= 13 && i <= 14))
                    this.regs[i] = this.regs_usr[i];
            }
            address += 4;
        }
    }
    logger.log(reglist.toString());
    this.print_inst_unimpl(addr, inst, "ldm");
};

ARMv7_CPU.prototype.ldmda = function(inst, addr) {
    this.print_inst("LDMDA / LDMFA", inst, addr);
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var register_list = inst & 0xffff;
    var n_registers = bitops.bit_count(register_list, 16);

    var address = this.reg(n) - 4 * n_registers + 4;
    var reglist = [];
    for (var i=0; i < 15; i++) {
        if ((register_list >>> i) & 1) {
            reglist.push(i);
            this.regs[i] = this.ld_word(address);
            address += 4;
        }
    }
    if (register_list & 0x8000) {
        reglist.push(15);
        this.branch_to = this.ld_word(address);
    }
    if (w)
        this.regs[n] = this.reg(n) - 4 * n_registers;
    this.log_regs(null);
    this.print_inst_ldstm(addr, inst, "ldmda", w, n, reglist);
};

ARMv7_CPU.prototype.ldmdb = function(inst, addr) {
    this.print_inst("LDMDB / LDMEA", inst, addr);
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var register_list = inst & 0xffff;
    var n_registers = bitops.bit_count(register_list, 16);

    var address = this.reg(n) - 4 * n_registers;
    var reglist = [];
    for (var i=0; i < 15; i++) {
        if ((register_list >>> i) & 1) {
            reglist.push(i);
            this.regs[i] = this.ld_word(address);
            address += 4;
        }
    }
    if (register_list & 0x8000) {
        reglist.push(15);
        this.branch_to = this.ld_word(address);
    }
    if (w)
        this.regs[n] = this.reg(n) - 4 * n_registers;
    this.log_regs(null);
    this.print_inst_ldstm(addr, inst, "ldmdb", w, n, reglist);
};

ARMv7_CPU.prototype.ldmib = function(inst, addr) {
    this.print_inst("LDMIB / LDMED", inst, addr);
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var register_list = inst & 0xffff;
    var n_registers = bitops.bit_count(register_list, 16);

    var address = this.reg(n) + 4;
    var reglist = [];
    for (var i=0; i < 15; i++) {
        if ((register_list >>> i) & 1) {
            reglist.push(i);
            this.regs[i] = this.ld_word(address);
            address += 4;
        }
    }
    if (register_list & 0x8000) {
        reglist.push(15);
        this.branch_to = this.ld_word(address);
    }
    if (w)
        this.regs[n] = this.reg(n) + 4 * n_registers;
    this.log_regs(null);
    this.print_inst_ldstm(addr, inst, "ldmib", w, n, reglist);
};

ARMv7_CPU.prototype.stm = function(inst, addr) {
    this.print_inst("STM / STMIA / STMEA", inst, addr);
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var register_list = inst & 0xffff;
    var n_registers = bitops.bit_count(register_list, 16);

    this.log_regs(null);
    var address = this.reg(n);
    var reglist = [];
    for (var i=0; i < 15; i++) {
        if ((register_list >>> i) & 1) {
            reglist.push(i);
            this.st_word(address, this.regs[i]);
            address += 4;
        }
    }
    if (register_list & 0x8000) {
        reglist.push(15);
        this.st_word(address, this.get_pc());
    }
    if (w)
        this.regs[n] = this.reg(n) + 4 * n_registers;
    this.print_inst_ldstm(addr, inst, "stm", w, n, reglist);
};

ARMv7_CPU.prototype.stmdb = function(inst, addr) {
    this.print_inst("STMDB / STMFD", inst, addr);
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var register_list = inst & 0xffff;
    var n_registers = bitops.bit_count(register_list, 16);
    var is_push = false;
    var valn = this.reg(n);
    if (w && n == 13 && n_registers >= 2) {
        is_push = true;
    }

    this.log_regs(null);
    var address = valn - 4 * n_registers;
    var reglist = [];
    for (var i=0; i < 15; i++) {
        if ((register_list >>> i) & 1) {
            reglist.push(i);
            this.st_word(address, this.regs[i]);
            address += 4;
        }
    }
    if (register_list & 0x8000) {
        reglist.push(15);
        this.st_word(address, this.get_pc());
    }
    if (w || is_push)
        this.regs[n] = this.reg(n) - 4 * n_registers;
    if (is_push)
        this.print_inst_ldstm(addr, inst, "push", w, null, reglist);
    else
        this.print_inst_ldstm(addr, inst, "stmdb", w, n, reglist);
};

ARMv7_CPU.prototype.stmib = function(inst, addr) {
    this.print_inst("STMIB / STMFA", inst, addr);
    var w = (inst >>> 21) & 1;
    var n = (inst >>> 16) & 0xf;
    var register_list = inst & 0xffff;
    var n_registers = bitops.bit_count(register_list, 16);
    var valn = this.reg(n);
    this.log_regs(null);
    var address = valn + 4;
    var reglist = [];
    for (var i=0; i < 15; i++) {
        if ((register_list >>> i) & 1) {
            reglist.push(i);
            this.st_word(address, this.regs[i]);
            address += 4;
        }
    }
    if (register_list & 0x8000) {
        reglist.push(15);
        this.st_word(address, this.get_pc());
    }
    if (w)
        this.regs[n] = this.reg(n) + 4 * n_registers;
    this.print_inst_ldstm(addr, inst, "stmib", w, n, reglist);
};

ARMv7_CPU.prototype.stm_ur = function(inst, addr) {
    this.print_inst("STM (user registers)", inst, addr);
    var p = (inst >>> 24) & 1;
    var u = (inst >>> 23) & 1;
    var n = (inst >>> 16) & 0xf;
    var register_list = inst & 0xffff;
    var n_registers = bitops.bit_count(register_list, 16);
    var is_increment = u == 1;
    var is_wordhigher = p == u;
    if (n == 15 || n_registers < 1)
        this.abort_unpredictable("STM (user registers)", inst, addr);
    if (this.is_user_or_system())
        this.abort_unpredictable("STM (user registers)");

    var length = 4*n_registers;
    this.log_regs(null);
    var address = this.reg(n) + (is_increment ? 0 : -length);
    if (is_wordhigher)
        address += 4;
    var reglist = [];
    for (var i=0; i < 15; i++) {
        if ((register_list >>> i) & 1) {
            reglist.push(i);
            // XXX
            if (this.cpsr.m == this.FIQ_MODE) {
                if (i >= 8 && i <= 14)
                    this.st_word(address, this.regs_usr[i]);
                else
                    this.st_word(address, this.regs[i]);
            } else {
                if (i >= 13 && i <= 14)
                    this.st_word(address, this.regs_usr[i]);
                else
                    this.st_word(address, this.regs[i]);
            }
            address += 4;
        }
    }
    if (register_list & 0x8000) {
        reglist.push(15);
        //this.st_word(address, this.regs_usr[15] + 8);
        this.st_word(address, this.get_pc());
    }
    this.print_inst_ldstm(addr, inst, "stm_usr", null, n, reglist); // FIXME
};

ARMv7_CPU.prototype.cps = function(inst, addr) {
    this.print_inst("CPS", inst, addr);
    var imod = (inst >>> 18) & 3;
    var m = inst & (1 << 17);
    var a = inst & (1 << 8);
    var i = inst & (1 << 7);
    var f = inst & (1 << 6);
    var mode = inst & 0xf;
    var enable = imod == 2;
    var disable = imod == 3;

    if (this.is_priviledged()) {
        var new_cpsr = this.clone_psr(this.cpsr);
        if (enable) {
            if (a) new_cpsr.a = 0;
            if (i) new_cpsr.i = 0;
            if (f) new_cpsr.f = 0;
        }
        if (disable) {
            if (a) new_cpsr.a = 1;
            if (i) new_cpsr.i = 1;
            if (f) new_cpsr.f = 1;
        }
        if (m)
            new_cpsr.m = mode;
        this.cpsr_write_by_instr(new_cpsr, 15, true);
    }
    this.print_inst_unimpl(addr, inst, "cps");
};

ARMv7_CPU.prototype.svc = function(inst, addr) {
    this.print_inst("SVC (previously SWI)", inst, addr);
    var imm32 = inst & 0x00ffffff;
    this.print_inst_svc(inst, imm32);
    this.call_supervisor();
};

ARMv7_CPU.prototype.clrex = function(inst, addr) {
    this.print_inst("CLREX", inst, addr);
    // Clear Exclusive clears the local record of the executing processor that an address has had a request for an exclusive access.
    // FIXME: Need to do nothing?
    this.print_inst_unimpl(addr, inst, "clrex");
};

ARMv7_CPU.prototype.dsb = function(inst, addr) {
    this.print_inst("DSB", inst, addr);
    //var option = bitops.get_bits(inst, 3, 0);
    // Data Synchronization Barrier
    // FIXME: Need to do nothing?
    this.print_inst_unimpl(addr, inst, "dsb");
};

ARMv7_CPU.prototype.dmb = function(inst, addr) {
    this.print_inst("DMB", inst, addr);
    //var option = bitops.get_bits(inst, 3, 0);
    // Data Memory Barrier
    // FIXME: Need to do nothing?
    this.print_inst_unimpl(addr, inst, "dmb");
};

ARMv7_CPU.prototype.isb = function(inst, addr) {
    this.print_inst("ISB", inst, addr);
    //var option = bitops.get_bits(inst, 3, 0);
    // Instruction Synchronization Barrier
    // FIXME: Need to do nothing?
    this.print_inst_unimpl(addr, inst, "isb");
};

ARMv7_CPU.prototype.wfi = function(inst, addr) {
    this.print_inst("WFI", inst, addr);
    this.is_halted = true;
    this.cpsr.i = 0;
    this.print_inst_unimpl(addr, inst, "wfi");
};

ARMv7_CPU.prototype.vmrs = function(inst_name, inst, addr) {
    this.print_inst("VMRS", inst, addr);
    // XXX: VFP support v0.3: no double precision support                                   
    this.regs[6] = 1<<20;
    this.print_inst_unimpl(addr, inst, "vmrs");
};

ARMv7_CPU.prototype.nop = function(inst_name, inst, addr) {
    this.print_inst("NOP", inst, addr);
    this.print_inst_unimpl(addr, inst, "nop");
};

ARMv7_CPU.prototype.exec = function(inst_name, inst, addr) {
    this.current = inst_name;
    return this[inst_name](inst, addr);
};

/*
 *
 * Decoder
 *
 */
ARMv7_CPU.prototype.decode_uncond = function(inst, addr) {
    // Unconditional instructions
    var op = 0;
    var op1 = 0;
    var op2 = 0;
    var tmp = 0;

    op1 = (inst >>> 20) & 0xff;
    if ((op1 >> 7) === 0) {
        // [31:27]=11110
        // Miscellaneous instructions, memory hints, and Advanced SIMD instructions
        op1 = (inst >>> 20) & 0x7f;
        op = (inst >>> 16) & 1;
        op2 = (inst >>> 4) & 0xf;

        tmp = (op1 >>> 5) & 3;
        switch (tmp) {
            case 0:
                if (op1 == 0x10 && (op2 & 2) === 0) {
                    if (op) {
                        // SETEND
                        this.abort_not_impl("SETEND", inst, addr);
                    } else {
                        // CPS
                        return "cps";
                    }
                    break;
                }
                this.abort_unknown_inst(inst, addr);
                break;
            case 1:
                // Advanced SIMD data-processing instructions
                this.abort_simdvfp_inst(inst, addr);
                break;
            case 2:
                if ((op1 & 1) === 0) {
                    // Advanced SIMD element or structure load/store instructions
                    this.abort_simdvfp_inst(inst, addr);
                }
                switch (op1 >> 1 & 3) {
                    case 2:
                        if (op1 & 0x10) {
                            // PLD (immediate, literal)
                            return "pld_imm";
                        } else {
                            // PLI (immediate, literal)
                            this.abort_not_impl("PLI (immediate, literal)", inst, addr);
                        }
                        break;
                    case 3:
                        if ((op1 & 0x18) == 0x10) {
                            switch (op2) {
                                case 1:
                                    // CLREX
                                    return "clrex";
                                    // Clear Exclusive clears the local record of the executing processor that an address has had a request for an exclusive access.
                                    // FIXME: Need to do nothing?
                                    break;
                                case 4:
                                    // DSB
                                    return "dsb";
                                    //var option = bitops.get_bits(inst, 3, 0);
                                    // Data Synchronization Barrier
                                    // FIXME: Need to do nothing?
                                    break;
                                case 5:
                                    // DMB
                                    return "dmb";
                                    //var option = bitops.get_bits(inst, 3, 0);
                                    // Data Memory Barrier
                                    // FIXME: Need to do nothing?
                                    break;
                                case 6:
                                    // ISB
                                    return "isb";
                                    //var option = bitops.get_bits(inst, 3, 0);
                                    // Instruction Synchronization Barrier
                                    // FIXME: Need to do nothing?
                                    break;
                                default:
                                    // UNPREDICTABLE
                                    this.abort_unpredictable_instruction("Miscellaneous instructions, memory hints, and Advanced SIMD instructions", inst, addr);
                                    break;
                            }
                        } else {
                            // UNPREDICTABLE
                            this.abort_unpredictable_instruction("Miscellaneous instructions, memory hints, and Advanced SIMD instructions", inst, addr);
                        }
                        break;
                    default:
                        this.abort_unknown_inst(inst, addr);
                        break;
                }
                break;
            case 3:
                if ((op2 & 1) === 0) {
                    switch (op1 & 7) {
                        case 5:
                            if (op1 & 0x10) {
                                // PLD (register)
                                this.abort_not_impl("PLD (register)", inst, addr);
                            } else {
                                // PLI (register)
                                this.abort_not_impl("PLI (register)", inst, addr);
                            }
                            break;
                        case 7:
                            // UNPREDICTABLE
                            this.abort_unpredictable_instruction("Miscellaneous instructions, memory hints, and Advanced SIMD instructions", inst, addr);
                            break;
                        default:
                            this.abort_unknown_inst(inst, addr);
                            break;
                    }
                }
                break;
            default:
                this.abort_decode_error(inst, addr);
                break;
        }
    } else {
        switch (op1) {
            case 0xc4:
                // MCRR, MCRR2
                this.abort_not_impl("MCRR, MCRR2", inst, addr);
                break;
            case 0xc5:
                // MRRC, MRRC2
                this.abort_not_impl("MRRC, MRRC2", inst, addr);
                break;
            default:
                tmp = (op1 >>> 5) & 7;
                switch (tmp) {
                    case 4:
                        if (op1 & 4) {
                            if (!(op1 & 1)) {
                                // SRS
                                this.abort_not_impl("SRS", inst, addr);
                                break;
                            }
                        } else {
                            if (op1 & 1) {
                                // RFE
                                this.abort_not_impl("RFE", inst, addr);
                                break;
                            }
                        }
                        this.abort_unknown_inst(inst, addr);
                        break;
                    case 5:
                        // BL, BLX (immediate)
                        this.abort_not_impl("BL, BLX (immediate)", inst, addr);
                        break;
                    case 6:
                        if (op1 & 1) {
                            // LDC, LDC2 (immediate) & LDC, LDC2 (literal)
                            throw "UND";
                        } else {
                            // STC, STC2
                            throw "UND";
                        }
                    case 7:
                        if (!(op1 & 1<<4)) {
                            if (op & 1) {
                                if (op1 & 1) {
                                    // MRC, MRC2
                                    // TODO
                                    this.abort_not_impl("MRC, MRC2", inst, addr);
                                } else {
                                    // MCR, MCR2
                                    // TODO
                                    this.abort_not_impl("MCR, MCR2", inst, addr);
                                }
                            } else {
                                // CDP, CDP2
                                throw "UND";
                            }
                            break;
                        }
                        // Fall through
                    default:
                        this.abort_unknown_inst(inst, addr);
                        break;
                }
        }
    }
    this.abort_unknown_inst(inst, addr);
    return null;
};

ARMv7_CPU.prototype.decode_sync_prim = function(inst, addr) {
    // Synchronization primitives
    // [27:24]=0001 [7:4]=1001
    var op = (inst >>> 20) & 0xf;

    if ((op & 8) === 0) {
        if ((op & 3) === 0) {
            // SWP, SWPB
            this.abort_not_impl("SWP, SWPB", inst, addr);
        } else {
            this.abort_unknown_inst(inst, addr);
        }
    } else {
        switch (op & 7) {
            case 0:
                // STREX
                return "strex";
                break;
            case 1:
                // LDREX
                return "ldrex";
                break;
            case 2:
                // STREXD
                this.abort_not_impl("STREXD", inst, addr);
                break;
            case 3:
                // LDREXD
                this.abort_not_impl("LDREXD", inst, addr);
                break;
            case 4:
                // STREXB
                this.abort_not_impl("STREXB", inst, addr);
                break;
            case 5:
                // LDREXB
                this.abort_not_impl("LDREXB", inst, addr);
                break;
            case 6:
                // STREXH
                this.abort_not_impl("STREXH", inst, addr);
                break;
            case 7:
                // LDREXH
                this.abort_not_impl("LDREXH", inst, addr);
                break;
            default:
                break;
        }
    }
    this.abort_unknown_inst(inst, addr);
    return null;
};

ARMv7_CPU.prototype.decode_dataproc_imm = function(inst, addr) {
    // [27:25]=001
    // Data-processing (immediate)
    var op = (inst >>> 20) & 0x1f;
    var rn;
    switch (op >> 1) {
        case 0:
            // AND (immediate)
            return "and_imm";
            break;
        case 1:
            // EOR (immediate)
            return "eor_imm";
            break;
        case 2:
            rn = (inst >>> 16) & 0xf;
            if (rn == 0xf) {
                // [24:21]=0010
                // ADR A2
                return "adr_a2";
            } else {
                // SUB (immediate)
                return "sub_imm";
            }
            break;
        case 3:
            // RSB (immediate)
            return "rsb_imm";
            break;
        case 4:
            rn = (inst >>> 16) & 0xf;
            if (rn == 0xf) {
                // [24:21]=0100
                // ADR A1
                return "adr_a1";
            } else {
                // ADD (immediate)
                return "add_imm";
            }
            break;
        case 5:
            // ADC (immediate)
            return "adc_imm";
            break;
        case 6:
            // SBC (immediate)
            return "sbc_imm";
            break;
        case 7:
            // RSC (immediate)
            return "rsc_imm";
            break;
        case 8:
            if ((op & 1) === 0) {
                this.abort_unknown_inst(inst, addr);
            }
            // TST (immediate)
            return "tst_imm";
            break;
        case 9:
            if ((op & 1) === 0) {
                this.abort_unknown_inst(inst, addr);
            }
            // TEQ (immediate)
            return "teq_imm";
            break;
        case 0xa:
            if ((op & 1) === 0) {
                this.abort_unknown_inst(inst, addr);
            }
            // CMP (immediate)
            return "cmp_imm";
            break;
        case 0xb:
            if ((op & 1) === 0) {
                this.abort_unknown_inst(inst, addr);
            }
            // CMN (immediate)
            return "cmn_imm";
            break;
        case 0xc:
            // ORR (immediate)
            return "orr_imm";
            break;
        case 0xd:
            // MOV (immediate) A1
            return "mov_imm_a1";
            break;
        case 0xe:
            // BIC (immediate)
            return "bic_imm";
            break;
        case 0xf:
            // MVN (immediate)
            return "mvn_imm";
            break;
        default:
            break;
    }
    this.abort_unknown_inst(inst, addr);
    return null;
};

ARMv7_CPU.prototype.decode_msr_imm_and_hints = function(inst, addr) {
    // [27:23]=00110 [21:20]=10
    // MSR (immediate), and hints
    var op = inst & (1 << 22);
    var op1 = (inst >>> 16) & 0xf;
    var op2 = inst & 0xff;
    if (op) {
        // MSR (immediate) (system level)
        return "msr_imm_sys";
    } else {
        if ((op1 & 2)) {
            // MSR (immediate) (system level)
            return "msr_imm_sys";
        } else {
            if ((op1 & 1)) {
                // MSR (immediate) (system level)
                return "msr_imm_sys";
            } else {
                if (op1 & 8) {
                    // MSR (immediate) (application level)
                    this.abort_not_impl("MSR (immediate) (application level)", inst, addr);
                } else {
                    if (op1 & 4) {
                        // MSR (immediate) (application level)
                        this.abort_not_impl("MSR (immediate) (application level)", inst, addr);
                    } else {
                        if ((op2 & 0xf0) == 0xf0) {
                            // DBG
                            this.abort_not_impl("DBG", inst, addr);
                        } else {
                            switch (op2) {
                                case 0:
                                    // NOP
                                    return "nop";
                                case 1:
                                    // YIELD
                                    this.abort_not_impl("YIELD", inst, addr);
                                    break;
                                case 2:
                                    // WFE
                                    this.abort_not_impl("WFE", inst, addr);
                                    break;
                                case 3:
                                    // WFI
                                    return "wfi";
                                    break;
                                case 4:
                                    // SEV
                                    this.abort_not_impl("SEV", inst, addr);
                                    break;
                                default:
                                    this.abort_unknown_inst(inst, addr);
                                    break;
                            }
                        }
                    }
                }
            }
        }
    }
    this.abort_unknown_inst(inst, addr);
    return null;
};

ARMv7_CPU.prototype.decode_half_mul = function(inst, addr) {
    throw "decode_half_mul";
};

ARMv7_CPU.prototype.decode_misc = function(inst, addr) {
    // [27:23]=00010 [20]=0 [7]=0
    // Miscellaneous instructions
    var op = (inst >>> 21) & 0x3;
    var op1 = (inst >>> 16) & 0xf;
    var op2 = (inst >>> 4) & 0x7;
    switch (op2) {
        case 0:
            if (op & 1) {
                if (!((op & 2) == 2) && (op1 & 3) === 0) {
                    // MSR (register) (application level)
                    this.abort_not_impl("MSR (register) (application level)", inst, addr);
                } else {
                    // MSR (register) (system level)
                    return "msr_reg_sys";
                }
            } else {
                // MRS
                return "mrs";
            }
            break;
        case 1:
            switch (op) {
                case 1:
                    // BX
                    return "bx";
                    break;
                case 3:
                    // CLZ
                    return "clz";
                    break;
                default:
                    this.abort_unknown_inst(inst, addr);
                    break;
            }
            break;
        case 2:
            if (op != 1) {
                this.abort_unknown_inst(inst, addr);
            }
            // BXJ
            this.abort_not_impl("BXJ", inst, addr);
            break;
        case 3:
            if (op != 1) {
                this.abort_unknown_inst(inst, addr);
            }
            // BLX (register)
            return "blx_reg";
            break;
        case 5:
            // Saturating addition and subtraction
            this.abort_not_impl("Saturating addition and subtraction", inst, addr);
            break;
        case 7:
            switch (op) {
                case 1:
                    // BKPT
                    this.abort_not_impl("BKPT", inst, addr);
                    break;
                case 3:
                    // SMC (previously SMI)
                    this.abort_not_impl("SMC (previously SMI)", inst, addr);
                    break;
                default:
                    this.abort_unknown_inst(inst, addr);
                    break;
            }
            break;
        default:
            this.abort_unknown_inst(inst, addr);
            break;
    }
    this.abort_unknown_inst(inst, addr);
    return null;
};

ARMv7_CPU.prototype.decode_dataproc_reg = function(inst, addr) {
    // [27:25]=000 [4]=0
    // Data-processing (register)
    var op1 = (inst >>> 20) & 0x1f;
    var op2 = (inst >>> 7) & 0x1f;
    var op3 = (inst >>> 5) & 0x3;
    // op1 != 0b10xx0
    switch (op1 >> 1) {
        case 0:
            // AND (register)
            return "and_reg";
            break;
        case 1:
            // EOR (register)
            return "eor_reg";
            break;
        case 2:
            // SUB (register)
            return "sub_reg";
            break;
        case 3:
            // RSB (register)
            return "rsb_reg";
            break;
        case 4:
            // ADD (register)
            return "add_reg";
            break;
        case 5:
            // ADC (register)
            return "adc_reg";
            break;
        case 6:
            // SBC (register)
            return "sbc_reg";
            break;
        case 7:
            // RSC (register)
            this.abort_not_impl("RSC (register)", inst, addr);
            break;
        case 8:
            if ((op1 & 1) === 0) {
                this.abort_unknown_inst(inst, addr);
            }
            // TST (register)
            return "tst_reg";
            break;
        case 9:
            if ((op1 & 1) === 0) {
                this.abort_unknown_inst(inst, addr);
            }
            // TEQ (register)
            return "teq_reg";
            break;
        case 0xa:
            if ((op1 & 1) === 0) {
                this.abort_unknown_inst(inst, addr);
            }
            // CMP (register)
            return "cmp_reg";
            break;
        case 0xb:
            if ((op1 & 1) === 0) {
                this.abort_unknown_inst(inst, addr);
            }
            // CMN (register)
            return "cmn_reg";
            break;
        case 0xc:
            // ORR (register)
            return "orr_reg";
            break;
        case 0xd:
            switch (op3) {
                case 0:
                    if (op2 === 0) {
                        // MOV (register)
                        return "mov_reg";
                    } else {
                        // LSL (immediate)
                        return "lsl_imm";
                    }
                    break;
                case 1:
                    // LSR (immediate)
                    return "lsr_imm";
                    break;
                case 2:
                    // ASR (immediate)
                    return "asr_imm";
                    break;
                case 3:
                    if (op2 === 0) {
                        // RRX
                        return "rrx";
                    } else {
                        // ROR (immediate)
                        return "ror_imm";
                    }
                    break;
                default:
                    break;
            }
            break;
        case 0xe:
            // BIC (register)
            return "bic_reg";
            break;
        case 0xf:
            // MVN (register)
            return "mvn_reg";
            break;
        default:
            break;
    }
    this.abort_unknown_inst(inst, addr);
    return null;
};

ARMv7_CPU.prototype.decode_dataproc_rsr = function(inst, addr) {
    // [27:25]=000 [7]=0 [4]=1
    // Data-processing (register-shifted register)
    var op1 = (inst >>> 20) & 0x1f;
    var op2 = (inst >>> 5) & 0x3;
    // op1 != 0b10xx0
    switch (op1 >> 1) {
        case 0:
            // AND (register-shifted register)
            return "and_rsr";
            break;
        case 1:
            // EOR (register-shifted register)
            return "eor_rsr";
            break;
        case 2:
            // SUB (register-shifted register)
            return "sub_rsr";
            break;
        case 3:
            // RSB (register-shifted register)
            return "rsb_rsr";
            break;
        case 4:
            // ADD (register-shifted register)
            return "add_rsr";
            break;
        case 5:
            // ADC (register-shifted register)
            this.abort_not_impl("ADC (register-shifted register)", inst, addr);
            break;
        case 6:
            // SBC (register-shifted register)
            return "sbc_rsr";
            break;
        case 7:
            // RSC (register-shifted register)
            this.abort_not_impl("RSC (register-shifted register)", inst, addr);
            break;
        case 8:
            if ((op1 & 1) === 0) {
                this.abort_unknown_inst(inst, addr);
            }
            // TST (register-shifted register)
            return "tst_rsr";
            break;
        case 9:
            if ((op1 & 1) === 0) {
                this.abort_unknown_inst(inst, addr);
            }
            // TEQ (register-shifted register)
            this.abort_not_impl("TEQ (register-shifted register)", inst, addr);
            break;
        case 0xa:
            if ((op1 & 1) === 0) {
                this.abort_unknown_inst(inst, addr);
            }
            // CMP (register-shifted register)
            return "cmp_rsr";
            break;
        case 0xb:
            if ((op1 & 1) === 0) {
                this.abort_unknown_inst(inst, addr);
            }
            // CMN (register-shifted register)
            this.abort_not_impl("CMN (register-shifted register)", inst, addr);
            break;
        case 0xc:
            // ORR (register-shifted register)
            return "orr_rsr";
            break;
        case 0xd:
            switch (op2) {
                case 0:
                    // LSL (register)
                    return "lsl_reg";
                    break;
                case 1:
                    // LSR (register)
                    return "lsr_reg";
                    break;
                case 2:
                    // ASR (register)
                    return "asr_reg";
                    break;
                case 3:
                    // ROR (register)
                    this.abort_not_impl("ROR (register)", inst, addr);
                    break;
                default:
                    break;
            }
            break;
        case 0xe:
            // BIC (register-shifted register)
            return "bic_rsr";
            break;
        case 0xf:
            // MVN (register-shifted register)
            return "mvn_rsr";
            break;
        default:
            break;
    }
    this.abort_unknown_inst(inst, addr);
    return null;
};

ARMv7_CPU.prototype.decode_extra_ldst_unpriv1 = function(inst, addr) {
    // [27:24]=0000 [21]=1 [7]=1 [4]=1
    // [7:4]=1011
    // Extra load/store instructions (unprivileged) #1
    op = bitops.get_bit(inst, 20);
    //op2=01
    //if ((op2 & 3) === 0) {
    //    this.abort_unknown_inst(inst, addr);
    //}
    if (op) {
        // LDRHT
        this.abort_not_impl("LDRHT", inst, addr);
    } else {
        // STRHT
        this.abort_not_impl("STRHT", inst, addr);
    }
};

ARMv7_CPU.prototype.decode_extra_ldst_unpriv2 = function(inst, addr) {
    // [27:24]=0000 [21]=1 [7]=1 [4]=1
    // [7:4]=11x1
    // Extra load/store instructions (unprivileged) #2
    // op2=1x
    op2 = bitops.get_bits(inst, 6, 5);
    //if ((op2 & 3) === 0) {
    //    this.abort_unknown_inst(inst, addr);
    //}
    if (op) {
        switch (op2) {
            case 2:
                // LDRSBT
                this.abort_not_impl("LDRSBT", inst, addr);
                break;
            case 3:
                // LDRSHT
                this.abort_not_impl("LDRSHT", inst, addr);
                break;
            default:
                this.abort_unknown_inst(inst, addr);
                break;
        }
    } else {
        var rt = bitops.get_bits(inst, 15, 12);
        if (rt & 1) {
            // UNDEFINED
            this.abort_undefined_instruction("Extra load/store instructions (unprivileged) #2", inst, addr);
        } else {
            // UNPREDICTABLE
            this.abort_unpredictable_instruction("Extra load/store instructions (unprivileged) #2", inst, addr);
        }
    }
};

ARMv7_CPU.prototype.decode_extra_ldst1 = function(inst, addr) {
    // [27:25]=000 [7]=1 [4]=1
    // [7:4]=1011
    // Extra load/store instructions #1
    op1 = (inst >>> 20) & 0x1f;
    //op2 = bitops.get_bits(inst, 6, 5);
    //op2=01
    if (op1 & 1) {
        if (op1 & 4) {
            rn = (inst >>> 16) & 0xf;
            if (rn == 0xf) {
                // LDRH (literal)
                this.abort_not_impl("LDRH (literal)", inst, addr);
            } else {
                // LDRH (immediate)
                return "ldrh_imm";
            }
        } else {
            // LDRH (register)
            return "ldrh_reg";
        }
    } else {
        if (op1 & 4) {
            // STRH (immediate)
            return "strh_imm";
        } else {
            // STRH (register)
            return "strh_reg";
        }
    }
    this.abort_unknown_inst(inst, addr);
    return null;
};

ARMv7_CPU.prototype.decode_extra_ldst2 = function(inst, addr) {
    // [27:25]=000 [7]=1 [4]=1
    // [7:4]=11x1
    // Extra load/store instructions #2
    var op1 = (inst >>> 20) & 0x1f;
    var op2 = (inst >>> 5) & 0x3;
    //op2=1x
    var rn = (inst >>> 16) & 0xf;
    if (op2 & 1) {
        if (op1 & 1) {
            if (op1 & 4) {
                if (rn == 0xf) {
                    // LDRSH (literal)
                    this.abort_not_impl("LDRSH (literal)", inst, addr);
                } else {
                    // LDRSH (immediate)
                    return "ldrsh_imm";
                }
            } else {
                // LDRSH (register)
                return "ldrsh_reg";
            }
        } else {
            if (op1 & 4) {
                // STRD (immediate)
                return "strd_imm";
            } else {
                // STRD (register)
                return "strd_reg";
            }
        }
    } else {
        if (op1 & 1) {
            if (op1 & 4) {
                if (rn == 0xf) {
                    // LDRSB (literal)
                    this.abort_not_impl("LDRSB (literal)", inst, addr);
                } else {
                    // LDRSB (immediate)
                    return "ldrsb_imm";
                }
            } else {
                // LDRSB (register)
                return "ldrsb_reg";
            }
        } else {
            if (op1 & 4) {
                if (rn == 0xf) {
                    // LDRD (literal)
                    this.abort_not_impl("LDRD (literal)", inst, addr);
                } else {
                    // LDRD (immediate)
                    return "ldrd_imm";
                }
            } else {
                // LDRD (register)
                return "ldrd_reg";
            }
        }
    }
    this.abort_unknown_inst(inst, addr);
    return null;
};

ARMv7_CPU.prototype.decode_multi = function(inst, addr) {
    // [27:24]=0000 [7:4]=1001
    // Multiply and multiply-accumulate

    var op = (inst >>> 20) & 0xf;
    switch (op >> 1) {
        case 0:
            // MUL
            return "mul";
            break;
        case 1:
            // MLA
            return "mla";
            break;
        case 2:
            if (op & 1) {
                // UNDEFINED
                this.abort_undefined_instruction("Multiply and multiply-accumulate", inst, addr);
            } else {
                // UMAAL
                this.abort_not_impl("UMAAL", inst, addr);
            }
            break;
        case 3:
            if (op & 1) {
                // UNDEFINED
                this.abort_undefined_instruction("Multiply and multiply-accumulate", inst, addr);
            } else {
                // MLS
                return "mls";
            }
            break;
        case 4:
            // UMULL
            return "umull";
            break;
        case 5:
            // UMLAL
            return "umlal";
            break;
        case 6:
            // SMULL
            return "smull";
            break;
        case 7:
            // SMLAL
            return "smlal";
            break;
        default:
            break;
    }
    this.abort_unknown_inst(inst, addr);
    return null;
};

ARMv7_CPU.prototype.decode_datamisc = function(inst, addr) {
    // Data-processing and miscellaneous instructions
    var op = (inst >>> 25) & 1;
    var op1 = (inst >>> 20) & 0x1f;
    var op2 = (inst >>> 4) & 0xf;
    var rn = null;

    if (op) {
        //if ((op1 >> 3) == 2 && (op1 & 3) == 2) { // 10x10
        if (op1 == 0x12 || op1 == 0x16) { // 10x10
            return this.decode_msr_imm_and_hints(inst, addr);
        } else {
            switch (op1) {
                case 0x10:
                    // MOV (immediate) A2?
                    return "mov_imm_a2";
                    break;
                case 0x14:
                    // MOVT
                    this.abort_not_impl("MOVT", inst, addr);
                    break;
                default:
                    if ((op1 >> 3) == 2 && (op1 & 1) === 0) {
                        this.abort_unknown_inst(inst, addr);
                        return null;
                    } else { //if (!(op1 >> 3 == 2 && (op1 & 1) === 0)) {
                        // [27:25]=001
                        // Data-processing (immediate)
                        return this.decode_dataproc_imm(inst, addr);
                    }
                    break;
            }
        }
    } else {
        if (op2 & 1) {
            if (op2 >> 3) {
                if ((op2 & 4) == 4) {
                    if ((op1 >> 4) === 0 && (op1 & 2) == 2) { // 0xx1x
                        // Extra load/store instructions (unprivileged) #2
                        return this.decode_extra_ldst_unpriv2(inst, addr);
                    } else {
                        // Extra load/store instructions #2
                        return this.decode_extra_ldst2(inst, addr);
                    }
                } else {
                    if (op2 & 2) {
                        if ((op1 >> 4) === 0 && (op1 & 2) == 2) { // 0xx1x
                            // Extra load/store instructions (unprivileged) #1
                            return this.decode_extra_ldst_unpriv1(inst, addr);
                        } else {
                            // Extra load/store instructions #1
                            return this.decode_extra_ldst1(inst, addr);
                        }
                    } else {
                        if (op1 >> 4) {
                            // Synchronization primitives
                            return this.decode_sync_prim(inst, addr);
                        } else {
                            // Multiply and multiply-accumulate
                            return this.decode_multi(inst, addr);
                        }
                    }
                }
            } else {
                if ((op1 >> 3) == 2 && (op1 & 1) === 0) { // 10xx0
                    // Miscellaneous instructions
                    return this.decode_misc(inst, addr);
                } else {
                    // Data-processing (register-shifted register)
                    return this.decode_dataproc_rsr(inst, addr);
                }
            }
        } else {
            if ((op1 >> 3) == 2 && (op1 & 1) === 0) { // 10xx0
                if (op2 >> 3) {
                    // Halfword multiply and multiply-accumulate
                    this.abort_not_impl("Halfword multiply and multiply-accumulate", inst, addr);
                } else {
                    // Miscellaneous instructions
                    return this.decode_misc(inst, addr);
                }
            } else {
                // Data-processing (register)
                return this.decode_dataproc_reg(inst, addr);
            }
        }
    }
    this.abort_unknown_inst(inst, addr);
    return null;
};

ARMv7_CPU.prototype.decode_media = function(inst, addr) {
    // [27:25]=011 [4]=1
    // Media instructions
    var op1 = (inst >>> 20) & 0x1f;
    var op2 = (inst >>> 5) & 0x7;
    var tmp = op1 >> 3;
    var rn = null;
    var a = null;
    switch (tmp) {
        case 0:
            if (op1 & 4) {
                // [27:22]=011001 [4]=1
                // Parallel addition and subtraction, unsigned
                op1 = bitops.get_bits(inst, 21, 20);
                op2 = bitops.get_bits(inst, 7, 5);
                switch (op1) {
                    case 1:
                        switch (op2) {
                            case 0:
                                // UADD16
                                this.abort_not_impl("UADD16", inst, addr);
                                break;
                            case 1:
                                // UASX
                                this.abort_not_impl("UASX", inst, addr);
                                break;
                            case 2:
                                // USAX
                                this.abort_not_impl("USAX", inst, addr);
                                break;
                            case 3:
                                // USUB16
                                this.abort_not_impl("USUB16", inst, addr);
                                break;
                            case 4:
                                // UADD8
                                this.abort_not_impl("UADD8", inst, addr);
                                break;
                            case 7:
                                // USUB8
                                this.abort_not_impl("USUB8", inst, addr);
                                break;
                            default:
                                this.abort_unknown_inst(inst, addr);
                                break;
                        }
                        break;
                    case 2:
                        switch (op2) {
                            case 0:
                                // UQADD16
                                this.abort_not_impl("UQADD16", inst, addr);
                                break;
                            case 1:
                                // UQASX
                                this.abort_not_impl("UQASX", inst, addr);
                                break;
                            case 2:
                                // UQSAX
                                this.abort_not_impl("UQSAX", inst, addr);
                                break;
                            case 3:
                                // UQSUB16
                                this.abort_not_impl("UQSUB16", inst, addr);
                                break;
                            case 4:
                                // UQADD8
                                this.abort_not_impl("UQADD8", inst, addr);
                                break;
                            case 7:
                                // UQSUB8
                                this.abort_not_impl("UQSUB8", inst, addr);
                                break;
                            default:
                                this.abort_unknown_inst(inst, addr);
                                break;
                        }
                        break;
                    case 3:
                        switch (op2) {
                            case 0:
                                // UHADD16
                                this.abort_not_impl("UHADD16", inst, addr);
                                break;
                            case 1:
                                // UHASX
                                this.abort_not_impl("UHASX", inst, addr);
                                break;
                            case 2:
                                // UHSAX
                                this.abort_not_impl("UHSAX", inst, addr);
                                break;
                            case 3:
                                // UHSUB16
                                this.abort_not_impl("UHSUB16", inst, addr);
                                break;
                            case 4:
                                // UHADD8
                                this.abort_not_impl("UHADD8", inst, addr);
                                break;
                            case 7:
                                // UHSUB8
                                this.abort_not_impl("UHSUB8", inst, addr);
                                break;
                            default:
                                this.abort_unknown_inst(inst, addr);
                                break;
                        }
                    default:
                        this.abort_unknown_inst(inst, addr);
                        break;
                }
            } else {
                // [27:22]=011000 [4]=1
                // Parallel addition and subtraction, signed
                op1 = bitops.get_bits(inst, 21, 20);
                op2 = bitops.get_bits(inst, 7, 5);
                switch (op1) {
                    case 1:
                        switch (op2) {
                            case 0:
                                // SADD16
                                this.abort_not_impl("SADD16", inst, addr);
                                break;
                            case 1:
                                // SASX
                                this.abort_not_impl("SASX", inst, addr);
                                break;
                            case 2:
                                // SSAX
                                this.abort_not_impl("SSAX", inst, addr);
                                break;
                            case 3:
                                // SSUB16
                                this.abort_not_impl("SSUB16", inst, addr);
                                break;
                            case 4:
                                // SADD8
                                this.abort_not_impl("SADD8", inst, addr);
                                break;
                            case 7:
                                // SSUB8
                                this.abort_not_impl("SSUB8", inst, addr);
                                break;
                            default:
                                this.abort_unknown_inst(inst, addr);
                                break;
                        }
                        break;
                    case 2:
                        switch (op2) {
                            case 0:
                                // QADD16
                                this.abort_not_impl("QADD16", inst, addr);
                                break;
                            case 1:
                                // QASX
                                this.abort_not_impl("QASX", inst, addr);
                                break;
                            case 2:
                                // QSAX
                                this.abort_not_impl("QSAX", inst, addr);
                                break;
                            case 3:
                                // QSUB16
                                this.abort_not_impl("QSUB16", inst, addr);
                                break;
                            case 4:
                                // QADD8
                                this.abort_not_impl("QADD8", inst, addr);
                                break;
                            case 7:
                                // QSUB8
                                this.abort_not_impl("QSUB8", inst, addr);
                                break;
                            default:
                                this.abort_unknown_inst(inst, addr);
                                break;
                        }
                        break;
                    case 3:
                        switch (op2) {
                            case 0:
                                // SHADD16
                                this.abort_not_impl("SHADD16", inst, addr);
                                break;
                            case 1:
                                // SHASX
                                this.abort_not_impl("SHASX", inst, addr);
                                break;
                            case 2:
                                // SHSAX
                                this.abort_not_impl("SHSAX", inst, addr);
                                break;
                            case 3:
                                // SHSUB16
                                this.abort_not_impl("SHSUB16", inst, addr);
                                break;
                            case 4:
                                // SHADD8
                                this.abort_not_impl("SHADD8", inst, addr);
                                break;
                            case 7:
                                // SHSUB8
                                this.abort_not_impl("SHSUB8", inst, addr);
                                break;
                            default:
                                this.abort_unknown_inst(inst, addr);
                                break;
                        }
                        break;
                    default:
                        this.abort_unknown_inst(inst, addr);
                        break;
                }
            }
            break;
        case 1:
            // [27:23]=01101 [4]=1
            // Packing, unpacking, saturation, and reversal
            op1 = (inst >>> 20) & 0x7;
            op2 = (inst >>> 5) & 0x7;
            tmp = op1 >> 1;
            switch (tmp) {
                case 0:
                    if (op1) {
                        this.abort_unknown_inst(inst, addr);
                    }
                    if (op2 & 1) {
                        switch (op2 >> 1) {
                            case 1:
                                a = bitops.get_bits(inst, 19, 16);
                                if (a == 0xf) {
                                    // SXTB16
                                    this.abort_not_impl("SXTB16", inst, addr);
                                } else {
                                    // SXTAB16
                                    this.abort_not_impl("SXTAB16", inst, addr);
                                }
                                break;
                            case 2:
                                // SEL
                                this.abort_not_impl("SEL", inst, addr);
                                break;
                            default:
                                this.abort_unknown_inst(inst, addr);
                                break;
                        }
                    } else {
                        throw "PKH";
                    }
                    break;
                case 1:
                    if (op2 & 1) {
                        switch (op1) {
                            case 2:
                                switch (op2) {
                                    case 1:
                                        // SSAT16
                                        this.abort_not_impl("SSAT16", inst, addr);
                                        break;
                                    case 3:
                                        a = bitops.get_bits(inst, 19, 16);
                                        if (a == 0xf) {
                                                // SXTB
                                                return "sxtb";
                                        } else {
                                                // SXTAB
                                                this.abort_not_impl("SXTAB", inst, addr);
                                        }
                                        break;
                                    default:
                                        this.abort_unknown_inst(inst, addr);
                                        break;
                                }
                                break;
                            case 3:
                                switch (op2) {
                                    case 1:
                                        // REV
                                        return "rev";
                                        break;
                                    case 3:
                                        a = (inst >>> 16) & 0xf;
                                        if (a == 0xf) {
                                                // SXTH
                                                return "sxth";
                                        } else {
                                                // SXTAH
                                                return "sxtah";
                                        }
                                        break;
                                    case 5:
                                        // REV16
                                        return "rev16";
                                    default:
                                        this.abort_unknown_inst(inst, addr);
                                        break;
                                }
                                break;
                            default:
                                this.abort_unknown_inst(inst, addr);
                                break;
                        }
                    } else {
                        // SSAT
                        this.abort_not_impl("SSAT", inst, addr);
                    }
                    break;
                case 2:
                    if (op2 != 3) {
                        this.abort_unknown_inst(inst, addr);
                    }
                    a = bitops.get_bits(inst, 19, 16);
                    if (a == 0xf) {
                            // UXTB16
                            this.abort_not_impl("UXTB16", inst, addr);
                    } else {
                            // UXTAB16
                            this.abort_not_impl("UXTAB16", inst, addr);
                    }
                    break;
                case 3:
                    if (op2 & 1) {
                        switch (op1) {
                            case 6:
                                switch (op2) {
                                    case 1:
                                        // USAT16
                                        this.abort_not_impl("USAT16", inst, addr);
                                        break;
                                    case 3:
                                        a = (inst >>> 16) & 0xf;
                                        if (a == 0xf) {
                                                // UXTB
                                                return "uxtb";
                                        } else {
                                                // UXTAB
                                                return "uxtab";
                                        }
                                        break;
                                    default:
                                        this.abort_unknown_inst(inst, addr);
                                        break;
                                }
                                break;
                            case 7:
                                switch (op2) {
                                    case 1:
                                        // RBIT
                                        this.abort_not_impl("RBIT", inst, addr);
                                        break;
                                    case 3:
                                        a = (inst >>> 16) & 0xf;
                                        if (a == 0xf) {
                                                // UXTH
                                                return "uxth";
                                        } else {
                                                // UXTAH
                                                this.abort_not_impl("UXTAH", inst, addr);
                                        }
                                        break;
                                    case 5:
                                        // REVSH
                                        this.abort_not_impl("REVSH", inst, addr);
                                        break;
                                    default:
                                        this.abort_unknown_inst(inst, addr);
                                        break;
                                }
                                break;
                            default:
                                this.abort_unknown_inst(inst, addr);
                                break;
                        }
                    } else {
                        // USAT
                        return "usat";
                    }
                    break;
                default:
                    break;
            }
            break;
        case 2:
            // [27:23]=01110 [4]=1
            // Signed multiplies
            op1 = (inst >>> 20) & 0x7;
            op2 = (inst >>> 5) & 0x7;
            a = (inst >>> 12) & 0xf;
            switch (op1) {
                case 0:
                    switch (op2 >> 1) {
                        case 0:
                            if (a == 0xf) {
                                // SMUAD
                                this.abort_not_impl("SMUAD", inst, addr);
                            } else {
                                // SMLAD
                                this.abort_not_impl("SMLAD", inst, addr);
                            }
                            break;
                        case 1:
                            if (a == 0xf) {
                                // SMUSD
                                this.abort_not_impl("SMUSD", inst, addr);
                            } else {
                                // SMLSD
                                this.abort_not_impl("SMLSD", inst, addr);
                            }
                            break;
                        default:
                            this.abort_unknown_inst(inst, addr);
                            break;
                    }
                    break;
                case 4:
                    switch (op2 >> 1) {
                        case 0:
                            // SMLALD
                            this.abort_not_impl("SMLALD", inst, addr);
                            break;
                        case 1:
                            // SMLSLD
                            this.abort_not_impl("SMLSLD", inst, addr);
                            break;
                        default:
                            this.abort_unknown_inst(inst, addr);
                            break;
                    }
                    break;
                case 5:
                    switch (op2 >> 1) {
                        case 0:
                            if (a == 0xf) {
                                // SMMUL
                                this.abort_not_impl("SMMUL", inst, addr);
                            } else {
                                // SMMLA
                                this.abort_not_impl("SMMLA", inst, addr);
                            }
                            break;
                        case 3:
                            // SMMLS
                            this.abort_not_impl("SMMLS", inst, addr);
                            break;
                        default:
                            this.abort_unknown_inst(inst, addr);
                            break;
                    }
                    break;
                default:
                    this.abort_unknown_inst(inst, addr);
                    break;
            }
            break;
        case 3:
            if (op1 == 0x1f && op2 == 7) {
                // UNDEFINED
                this.abort_undefined_instruction("Signed multiplies", inst, addr);
            }
            switch (op1 >> 1 & 3) {
                case 0:
                    if ((op1 & 1) === 0 && op2 === 0) {
                        var rd = bitops.get_bits(inst, 15, 12);
                        if (rd == 0xf) {
                            // USAD8
                            this.abort_not_impl("USAD8", inst, addr);
                        } else {
                            // USADA8
                            this.abort_not_impl("USADA8", inst, addr);
                        }
                        break;
                    }
                    this.abort_unknown_inst(inst, addr);
                    break;
                case 1:
                    if ((op2 & 3) == 2) {
                        // SBFX
                        return "sbfx";
                    }
                    this.abort_unknown_inst(inst, addr);
                    break;
                case 2:
                    if ((op2 & 3) === 0) {
                        rn = inst & 0xf;
                        if (rn == 0xf) {
                            // BFC
                            return "bfc";
                        } else {
                            // BFI
                            return "bfi";
                        }
                        break;
                    }
                    this.abort_unknown_inst(inst, addr);
                    break;
                case 3:
                    if ((op2 & 3) == 2) {
                        // UBFX
                        return "ubfx";
                    }
                    this.abort_unknown_inst(inst, addr);
                    break;
                default:
                    break;
            }
            break;
        default:
            break;
    }
    this.abort_unknown_inst(inst, addr);
    return null;
};

ARMv7_CPU.prototype.decode = function(inst, addr) {
    /*
     *  bits[31:28]: cond
     *  bits[27:25]: op1
     *  bit[4]: op
     */
    var cond = inst >>> 28;
    var op = (inst >>> 4) & 1;
    var op1 = (inst >>> 25) & 7;
    var op2 = null;
    var tmp = null;
    var rn = null;
    var coproc = null;

    this.shift_t = 0;
    this.shift_n = 0;
    this.carry_out = 0;
    this.overflow = 0;

    if (inst == 0xeef06a10)
        return "vmrs";

    if (cond == 0xf) {
        // Unconditional instructions
        return this.decode_uncond(inst, addr);
    } else { // cond != 0xf
        switch (op1 >> 1) {
            case 0:
                // Data-processing and miscellaneous instructions
                return this.decode_datamisc(inst, addr);
                break;
            case 1:
                if (op1 & 1) {
                    if (op) {
                        // [27:25]=011 [4]=1
                        // Media instructions
                        return this.decode_media(inst, addr);
                    } else {
                        // [27:25]=011 [4]=0
                        // Load/store word and unsigned byte #2
                        op1 = (inst >>> 20) & 0x1f;
                        // A=1 B=0
                        if (op1 & 1) {
                            if (op1 & 4) { // xx1x1
                                if (op1 == 7 || op1 == 15) { // 0x111
                                    // LDRBT
                                    this.abort_not_impl("LDRBT", inst, addr);
                                } else {
                                    // LDRB (register)
                                    return "ldrb_reg";
                                }
                            } else { // xx0x1
                                if (op1 == 3 || op1 == 11) { // 0x011
                                    // LDRT
                                    this.abort_not_impl("LDRT A2", inst, addr);
                                } else {
                                    // LDR (register)
                                    return "ldr_reg";
                                }
                            }
                        } else {
                            if (op1 & 4) { // xx1x0
                                if (op1 == 6 || op1 == 14) { // 0x110
                                    // STRBT A2
                                    return "strbt_a2";
                                } else {
                                    // STRB (register)
                                    return "strb_reg";
                                }
                            } else { // xx0x0
                                if (op1 == 2 || op1 == 10) { // 0x010
                                    // STRT
                                    this.abort_not_impl("STRT", inst, addr);
                                } else {
                                    // STR (register)
                                    return "str_reg";
                                }
                            }
                        }
                    }
                } else {
                    // [27:25]=010 [4]=x
                    // Load/store word and unsigned byte #1
                    op1 = (inst >>> 20) & 0x1f;
                    // A=0 B=x
                    if (op1 & 1) {
                        if (op1 & 4) { // xx1x1
                            if (op1 == 7 || op1 == 15) { // 0x111
                                // LDRBT
                                this.abort_not_impl("LDRBT", inst, addr);
                            } else {
                                rn = (inst >>> 16) & 0xf;
                                if (rn == 0xf) {
                                    // LDRB (literal)
                                    this.abort_not_impl("LDRB (literal)", inst, addr);
                                } else {
                                    // LDRB (immediate)
                                    return "ldrb_imm";
                                }
                            }
                            //break;
                        } else { // xx0x1
                            if (op1 == 3 || op1 == 0xb) { // 0x011
                                // LDRT
                                return "ldrt_a1";
                            } else {
                                rn = (inst >>> 16) & 0xf;
                                if (rn == 0xf) {
                                    // LDR (literal)
                                    return "ldr_lit";
                                } else {
                                    // LDR (immediate)
                                    return "ldr_imm";
                                }
                            }
                        }
                    } else {
                        if (op1 & 4) { // xx1x0
                            if (op1 == 6 || op1 == 14) { // 0x110
                                // STRBT A1
                                return "strbt_a1";
                            } else {
                                // STRB (immediate)
                                return "strb_imm";
                            }
                        } else { // xx0x0
                            if (op1 == 2 || op1 == 10) { // 0x010
                                // STRT
                                this.abort_not_impl("STRT", inst, addr);
                            } else {
                                // STR (immediate)
                                return "str_imm";
                            }
                        }
                    }
                }
                break;
            case 2:
                // [27:26]=10
                // Branch, branch with link, and block data transfer
                op = (inst >>> 20) & 0x3f;
                if (op & 0x20) {
                    if (op & 0x10) {
                        // BL, BLX (immediate)
                        return "bl_imm";
                    } else {
                        // [27:24]=1010
                        // B (branch)
                        return "b";
                    }
                } else {
                    if (op & 4) {
                        if (op & 1) {
                            var r = (inst >>> 15) & 1;
                            if (r) {
                                // LDM (exception return)
                                return "ldm_er";
                            } else {
                                // LDM (user registers)
                                return "ldm_ur";
                            }
                        } else {
                            // STM (user registers)
                            return "stm_ur";
                        }
                    } else {
                        if (op & 1) {
                            switch (op >> 2 & 7) { // 0b11100
                                case 0:
                                    // LDMDA / LDMFA
                                    return "ldmda";
                                    break;
                                case 2:
                                    // LDM / LDMIA / LDMFD
                                    return "ldm";
                                    break;
                                case 4:
                                    // LDMDB / LDMEA
                                    return "ldmdb";
                                    break;
                                case 6:
                                    // LDMIB / LDMED
                                    return "ldmib";
                                    break;
                                default:
                                    this.abort_unknown_inst(inst, addr);
                                    break;
                            }
                        } else {
                            switch (op >> 2 & 7) { // 0b11100
                                case 0:
                                    // STMDA / STMED
                                    this.abort_not_impl("STMDA / STMED", inst, addr);
                                    break;
                                case 2:
                                    // STM / STMIA / STMEA
                                    return "stm";
                                    break;
                                case 4:
                                    // STMDB / STMFD
                                    return "stmdb";
                                    break;
                                case 6:
                                    // STMIB / STMFA
                                    return "stmib";
                                    break;
                                default:
                                    this.abort_unknown_inst(inst, addr);
                                    break;
                            }
                        }
                    }
                }
                break;
            case 3:
                // [27:26]=11
                // System call, and coprocessor instructions
                op1 = (inst >>> 20) & 0x3f;
                op = (inst >>> 4) & 1;
                if (op1 & 0x20) {
                    if (op1 & 0x10) {
                        // SVC (previously SWI)
                        return "svc";
                    } else {
                        coproc = (inst >>> 8) & 0xf;
                        if (op) {
                            if ((coproc >> 1) == 5) { // 0b101x
                                // Advanced SIMD, VFP
                                // 8, 16, and 32-bit transfer between ARM core and extension registers
                                this.abort_simdvfp_inst(inst, addr);
                            } else {
                                if (op1 & 1) {
                                    // cond != 1111
                                    // MRC, MRC2 A1
                                    return "mrc_a1";
                                } else {
                                    // cond != 1111
                                    // MCR, MCR2 A1
                                    return "mcr_a1";
                                }
                            }
                        } else {
                            if ((coproc >> 1) == 5) { // 0b101x
                                // VFP data-processing instructions
                                this.abort_simdvfp_inst(inst, addr);
                            } else {
                                // CDP, CDP2
                                throw "UND";
                            }
                        }
                    }
                } else {
                    if ((op1 >> 3) === 0 && (op1 & 2) === 0) { // 000x0x
                        switch (op1 >> 1) {
                            case 0:
                                // UNDEFINED
                                this.abort_undefined_instruction("System call, and coprocessor instructions", inst, addr);
                                break;
                            case 2:
                                coproc = bitops.get_bits(inst, 11, 8);
                                if ((coproc >> 1) == 5) { // 0b101x
                                    // 64-bit transfers between ARM core and extension registers
                                    this.abort_simdvfp_inst(inst, addr);
                                } else {
                                    if (op1 & 1) {
                                        // MRRC, MRRC2
                                        this.abort_not_impl("MRRC, MRRC2", inst, addr);
                                    } else {
                                        // MCRR, MCRR2
                                        this.abort_not_impl("MCRR, MCRR2", inst, addr);
                                    }
                                }
                                break;
                            default:
                                this.abort_unknown_inst(inst, addr);
                                break;
                        }
                    } else {
                        coproc = bitops.get_bits(inst, 11, 8);
                        if ((coproc >> 1) == 5) { // 0b101x
                            // Advanced SIMD, VFP
                            // Extension register load/store instructions
                            this.abort_simdvfp_inst(inst, addr);
                        } else {
                            if (op1 & 1) {
                                rn = bitops.get_bits(inst, 19, 16);
                                if (rn == 0xf) {
                                    // LDC, LDC2 (literal)
                                    throw "UND";
                                } else {
                                    // LDC, LDC2 (immediate)
                                    throw "UND";
                                }
                            } else {
                                // STC, STC2
                                throw "UND";
                            }
                        }
                    }
                }
                break;
            default:
                break;
        }
    }
    this.abort_unknown_inst(inst, addr);
    return null;
};

ARMv7_CPU.prototype.interrupt = function(irq) {
    logger.log("got interrupt");
    this.spsr_irq = this.clone_psr(this.cpsr);
    this.regs_irq[14] = this.get_pc() - 4;

    this.change_mode(this.IRQ_MODE);
    this.cpsr.i = 1;
    this.cpsr.a = 1;

    var cp15 = this.coprocs[15];
    this.regs[15] = cp15.interrupt_vector_address + 0x18;
};

ARMv7_CPU.prototype.data_abort = function() {
    logger.log("got data abort");
    this.spsr_abt = this.clone_psr(this.cpsr);
    this.regs_abt[14] = this.get_pc();

    this.change_mode(this.ABT_MODE);
    this.cpsr.i = 1;

    var cp15 = this.coprocs[15];
    this.regs[15] = cp15.interrupt_vector_address + 0x10;
};

ARMv7_CPU.prototype.prefetch_abort = function() {
    logger.log("got prefetch abort");
    this.spsr_abt = this.clone_psr(this.cpsr);
    this.regs_abt[14] = this.get_pc() - 4;

    this.change_mode(this.ABT_MODE);
    this.cpsr.i = 1;

    var cp15 = this.coprocs[15];
    this.regs[15] = cp15.interrupt_vector_address + 0x0c;
};

ARMv7_CPU.prototype.supervisor = function() {
    logger.log("got svc");
    this.spsr_svc = this.clone_psr(this.cpsr);
    this.regs_svc[14] = this.get_pc() - 4;

    this.change_mode(this.SVC_MODE);
    this.cpsr.i = 1;

    var cp15 = this.coprocs[15];
    this.regs[15] = cp15.interrupt_vector_address + 0x08;
};

ARMv7_CPU.prototype.undefined_instruction = function() {
    logger.log("undef instr");
    this.spsr_und = this.clone_psr(this.cpsr);
    this.regs_und[14] = this.get_pc() - 4;

    this.change_mode(this.UND_MODE);
    this.cpsr.i = 1;

    var cp15 = this.coprocs[15];
    this.regs[15] = cp15.interrupt_vector_address + 0x04;
};
