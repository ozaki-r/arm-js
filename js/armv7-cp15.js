/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
/*
 * CP15 System Control Coprocessor
 */
function ARMv7_CP15(options, cpu) {
    this.options = options;
    this.cpu = cpu;

    this.interrupt_vector_address = 0;
    this.read = new Object();
    this.write = new Object();
    this.data = new Object();

    this.TRANS_FAULT_SECTION = 5; // 0b00101
    this.TRANS_FAULT_PAGE = 7; // 0b00111
    this.PERMISSION_FAULT_SECTION = 0xd; // 0b01101
    this.PERMISSION_FAULT_PAGE = 0xf; // 0b01111

    // crn, opc1, crm, opc2
    this.MIDR =       [0, 0, 0, 0];
    this.CTR =        [0, 0, 0, 1];
    this.ID_PFR0 =    [0, 0, 1, 0];
    this.ID_MMFR0 =   [0, 0, 1, 4];
    this.ID_MMFR1 =   [0, 0, 1, 5];
    this.CCSIDR =     [0, 1, 0, 0];
    this.CLIDR =      [0, 1, 0, 1];
    this.CSSELR =     [0, 2, 0, 0];
    this.SCTLR =      [1, 0, 0, 0];
    this.CPACR =      [1, 0, 0, 2];
    this.TTBR0 =      [2, 0, 0, 0];
    this.TTBR1 =      [2, 0, 0, 1];
    this.TTBCR =      [2, 0, 0, 2];
    this.ICIALLU =    [7, 0, 5, 0];
    this.ICIMVAU =    [7, 0, 5, 1];
    this.BPIALL =     [7, 0, 5, 6];
    this.BPIMVA =     [7, 0, 5, 7];
    this.ISB =        [7, 0, 5, 4];
    this.DCCMVAC =    [7, 0,10, 1];
    this.DSB =        [7, 0,10, 4];
    this.DMB =        [7, 0,10, 5];
    this.DCCMVAU =    [7, 0,11, 1];
    this.DCCIMVAC =   [7, 0,14, 1];
    this.DACR =       [3, 0, 0, 0];
    this.DFSR =       [5, 0, 0, 0];
    this.IFSR =       [5, 0, 0, 1]; // Instruction Fault Status Register (IFSR)
    this.DFAR =       [6, 0, 0, 0]; // Data Fault Address Register (DFAR)
    this.IFAR =       [6, 0, 0, 2]; // Instruction Fault Address Register (IFAR)
    this.ITLBIALL =   [8, 0, 5, 0];
    this.ITLBIMVA =   [8, 0, 5, 1];
    this.ITLBIASID =  [8, 0, 5, 2];
    this.DTLBIALL =   [8, 0, 6, 0];
    this.DTLBIMVA =   [8, 0, 6, 1];
    this.DTLBIASID =  [8, 0, 6, 2];
    this.UTLBIALL =   [8, 0, 7, 0];
    this.UTLBIMVA =   [8, 0, 7, 1];
    this.UTLBIASID =  [8, 0, 7, 2];
    this.PRRR =       [10, 0, 2, 0]; // c10, Primary Region Remap Register (PRRR)
    this.NMRR =       [10, 0, 2, 1]; // c10, Normal Memory Remap Register (NMRR)
    this.CONTEXTIDR = [13, 0, 0, 1];
    this.TPIDRURW =   [13, 0, 0, 2]; // User Read/Write Thread ID Register, TPIDRURW
    this.TPIDRURO =   [13, 0, 0, 3]; // User Read-only Thread ID Register, TPIDRURO

    var mmu = this.cpu.mmu;
    var that = this;

    // [31:24]=Implementor [23:20]=Variant [19:16]=Architecture [15:4]=Primary part number [3:0]=Revision
    // MRC p15,0,<Rd>,c0,c0,0 ; Read CP15 Main ID Register
    var midr = 0;
    midr = bitops.set_bits(midr, 31, 24, 0x41); // ARM Limited
    midr = bitops.set_bits(midr, 23, 20, 0x1); // Major Revison Number
    midr = bitops.set_bits(midr, 19, 16, 0xf); // Defined by CPUID scheme
    // [15:12] != 0x0 and != 0x7
    midr = bitops.set_bits(midr, 15, 12, 0xf);
    midr = bitops.set_bits(midr, 3, 0, 0x1); // Minor Revison Number
    this.register_readonly("MIDR", midr);

    /*
     * CTR: Cache Type Register
     * Bits [31:29]: Set to 0b100 for the ARMv7 register format.
     * CWG, bits [27:24]: Cache Writeback Granule
     * ERG, bits [23:20]: Exclusives Reservation Granule // Manual is wrong :-)
     * DminLine, bits [19:16]: Log2 of the number of words in the smallest cache line of all the data caches and unified caches that are controlled by the core.
     * L1Ip, bits [15:14]: Level 1 instruction cache policy.
     * IminLine, bits [3:0]: Log2 of the number of words in the smallest cache line of all the instruction caches that are controlled by the core.
     */
    var ctr = 0;
    ctr = bitops.set_bits(ctr, 31, 29, 4);
    ctr = bitops.set_bits(ctr, 27, 24, 0);
    ctr = bitops.set_bits(ctr, 23, 20, 0);
    ctr = bitops.set_bits(ctr, 19, 16, 0); // FIXME
    ctr = bitops.set_bits(ctr, 15, 14, 1); // ASID-tagged Virtual Index, Virtual Tag (AIVIVT)
    ctr = bitops.set_bits(ctr, 3, 0, 0); // FIXME
    this.register_readonly("CTR", ctr);

    // TODO
    var sctlr = 0;
    sctlr = bitops.set_bit(sctlr, 31, 0); // UNK/SBZP
    sctlr = bitops.set_bit(sctlr, 30, 0); // TE: Thumb Exception enable
    sctlr = bitops.set_bit(sctlr, 29, 0); // AFE: Access Flag Enable bit
    sctlr = bitops.set_bit(sctlr, 28, 0); // TRE: TEX Remap Enable bit
    sctlr = bitops.set_bit(sctlr, 27, 0); // NMFI: Non-maskable Fast Interrupts enable
    sctlr = bitops.set_bit(sctlr, 25, 0); // EE: Exception Endianness bit
    sctlr = bitops.set_bit(sctlr, 24, 0); // VE: Interrupt Vectors Enable bit
    sctlr = bitops.set_bit(sctlr, 22, 1); // U: In ARMv7 this bit is RAO/SBOP
    sctlr = bitops.set_bit(sctlr, 21, 0); // FI: Fast Interrupts configuration enable bit
    sctlr = bitops.set_bit(sctlr, 17, 0); // HA: Hardware Access Flag Enable bit
    sctlr = bitops.set_bit(sctlr, 14, 0); // RR: Round Robin bit
    sctlr = bitops.set_bit(sctlr, 13, 0); // V: Vectors bit
    sctlr = bitops.set_bit(sctlr, 12, 0); // I: Instruction cache enable bit
    sctlr = bitops.set_bit(sctlr, 11, 0); // Z: Branch prediction enable bit
    sctlr = bitops.set_bit(sctlr, 7, 0); // B: In ARMv7 this bit is RAZ/SBZP
    sctlr = bitops.set_bit(sctlr, 2, 0); // C: Cache enable bit
    sctlr = bitops.set_bit(sctlr, 1, 0); // A: Alignment bit
    sctlr = bitops.set_bit(sctlr, 0, 0); // M: MMU enable bit
    this.register_writable("SCTLR", sctlr, function (word) {
        that.data["SCTLR"] = word;
        if (word & 1) {
            mmu.enabled = true;
        } else {
            mmu.enabled = false;
        }
        if (!(word & 0x01000000)) { // SCTLR.VE[24]
            if (word & 0x00002000) { // SCTLR.V[13]
                that.interrupt_vector_address = 0xffff0000;
            } else {
                that.interrupt_vector_address = 0x00000000;
            }
        }
        if (word & 2) {// SCTLR.A[1]
            mmu.check_unaligned = true;
            throw "Check unaligned access!";
        } else {
            mmu.check_unaligned = false;
        }
        // Always 1
        that.data["SCTLR"] = bitops.set_bit(that.data["SCTLR"], 22, 1);
    });

    var id_pfr0 = 0;
    id_pfr0 = bitops.set_bits(id_pfr0, 3, 0, 1); // ARM instruction set supported
    this.register_readonly("ID_PFR0", id_pfr0);

    var id_mmfr0 = 0;
    id_mmfr0 = bitops.set_bits(id_mmfr0, 31, 28, 0); // Reserved, Read-As-Zero
    id_mmfr0 = bitops.set_bits(id_mmfr0, 37, 24, 0); // FCSE support
    id_mmfr0 = bitops.set_bits(id_mmfr0, 23, 20, 0); // Auxiliary registers
    // ARMv7 requires this setting.
    id_mmfr0 = bitops.set_bits(id_mmfr0, 19, 16, 1); // TCM support
    id_mmfr0 = bitops.set_bits(id_mmfr0, 15, 12, 0); // Outer Shareable
    id_mmfr0 = bitops.set_bits(id_mmfr0, 11, 8, 0); // Cache coherence
    id_mmfr0 = bitops.set_bits(id_mmfr0, 7, 4, 0); // PMSA support
    // VMSAv7 supported, with support for remapping and the access flag. ARMv7-A profile.
    id_mmfr0 = bitops.set_bits(id_mmfr0, 3, 0, 3); // VMSA support
    this.register_readonly("ID_MMFR0", id_mmfr0);

    var id_mmfr1 = 0;
    // For execution correctness, Branch Predictor requires no flushing at any time.
    id_mmfr1 = bitops.set_bits(id_mmfr1, 31, 28, 4); // Branch Predictor
    // None supported. This is the required setting for ARMv7.
    id_mmfr1 = bitops.set_bits(id_mmfr1, 37, 24, 0); // L1 cache Test and Clean
    // None supported. This is the required setting for ARMv7, because ARMv7 requires a hierarchical cache implementation.
    id_mmfr1 = bitops.set_bits(id_mmfr1, 23, 20, 0); // L1 unified cache
    id_mmfr1 = bitops.set_bits(id_mmfr1, 19, 16, 0); // L1 Harvard cache
    id_mmfr1 = bitops.set_bits(id_mmfr1, 15, 12, 0); // L1 unified cache s/w
    id_mmfr1 = bitops.set_bits(id_mmfr1, 11, 8, 0); // L1 Harvard cache s/w
    id_mmfr1 = bitops.set_bits(id_mmfr1, 7, 4, 0); // L1 unified cache VA
    id_mmfr1 = bitops.set_bits(id_mmfr1, 3, 0, 0); // L1 Harvard cache VA
    this.register_readonly("ID_MMFR1", id_mmfr1);
    
    // c0, Cache Size ID Registers (CCSIDR)
    /*
     * WT, bit [31]: Indicates whether the cache level supports Write-Through
     * WB, bit [30]: Indicates whether the cache level supports Write-Back
     * RA, bit [29]: Indicates whether the cache level supports Read-Allocation
     * WA, bit [28]: Indicates whether the cache level supports Write-Allocation
     * NumSets, bits [27:13]: Number of sets in cache
     * Associativity, bits [12:3]: Associativity of cache
     * LineSize, bits [2:0]: Log2(Number of words in cache line)
     */
    var ccsidr = 0;
    ccsidr = bitops.set_bit(ccsidr, 31, 1);
    ccsidr = bitops.set_bit(ccsidr, 30, 1);
    ccsidr = bitops.set_bit(ccsidr, 29, 1);
    ccsidr = bitops.set_bit(ccsidr, 28, 1);
    ccsidr = bitops.set_bits(ccsidr, 27, 13, 0); // One set
    ccsidr = bitops.set_bits(ccsidr, 12, 3, 1); // Two set associative
    ccsidr = bitops.set_bits(ccsidr, 2, 0, 0); // 4 words length
    this.register_readonly("CCSIDR", ccsidr);

    // Cache Level ID Register
    var clidr = 0;
    clidr = bitops.set_bits(clidr, 29, 27, 0); // LoU: Level of Unification for the cache hierarchy
    clidr = bitops.set_bits(clidr, 26, 24, 0); // LoC: Level of Coherency for the cache hierarchy
    clidr = bitops.set_bits(clidr, 23, 21, 0); // Ctype8
    clidr = bitops.set_bits(clidr, 20, 18, 0); // Ctype7
    clidr = bitops.set_bits(clidr, 17, 15, 0); // Ctype6
    clidr = bitops.set_bits(clidr, 14, 12, 0); // Ctype5
    clidr = bitops.set_bits(clidr, 11, 9, 0); // Ctype4
    clidr = bitops.set_bits(clidr, 8, 6, 0); // Ctype3
    clidr = bitops.set_bits(clidr, 5, 3, 0); // Ctype2
    clidr = bitops.set_bits(clidr, 2, 0, 0); // Ctype1
    this.register_readonly("CLIDR", clidr);

    // CSSELR, Cache Size Selection Register
    var csselr = 0;
    csselr = bitops.set_bits(csselr, 3, 1, 0); // Level: Cache level of required cache
    csselr = bitops.set_bit(csselr, 0, 0); // InD: Instruction not Data bit
    this.register_writable("CSSELR", csselr);

    /*
     * Translation Table Base Register 0 (TTBR0)
     * bits[31:14-N]: Translation table base 0 address
     * bit[5]: NOS: Not Outer Shareable bit
     * bits[4:3]: RGN: Region bits
     * bit[2]: IMP: Implementation defined bit
     * bit[1]: S: Shareable bit
     * bit[0]: C: Cacheable bit
     */
    this.register_writable("TTBR0", 0, function (word) {
        display.log("TTBR0");
        that.data["TTBR0"] = word;
        mmu.baseaddr0 = bitops.clear_bits(word, 13 - mmu.width, 0);
        if (that.options.enable_logger) {
            that.log_value(word, "ttbr0");
            that.log_value(mmu.baseaddr0, "baseaddr0 in ttbr0");
        }
    });

    /*
     * Translation Table Base Register 1 (TTBR1)
     * bits[31:14]: Translation table base 1 address
     * bit[5]: NOS: Not Outer Shareable bit
     * bits[4:3]: RGN: Region bits
     * bit[2]: IMP: Implementation defined bit
     * bit[1]: S: Shareable bit
     * bit[0]: C: Cacheable bit
     */
    this.register_writable("TTBR1", 0, function (word) {
        display.log("TTBR1");
        that.data["TTBR1"] = word;
        mmu.baseaddr1 = bitops.clear_bits(word, 13, 0);
        if (that.options.enable_logger) {
            that.log_value(word, "ttbr1");
            that.log_value(mmu.baseaddr1, "baseaddr1 in ttbr1");
        }
    });

    /*
     * Translation Table Base Control Register (TTBCR)
     * bits[2:0]: N: Indicate the width of the base address held in TTBR0
     */
    this.register_writable("TTBCR", 0, function(word) {
        display.log("TTBCR");
        that.data["TTBCR"] = word;
        var width = bitops.get_bits(word, 2, 0);
        var ttbr0 = that.data["TTBR0"];
        mmu.width = width;
        mmu.mask = (1 << (31 - width - 20 + 1)) - 1;
        mmu.baseaddr0 = bitops.clear_bits(ttbr0, 13 - width, 0);
        that.log_value(word, "word");
        that.log_value(mmu.baseaddr0, "baseaddr0 in ttbcr");
        if (width) {
            throw "width > 0";
            var ttbr1 = that.data["TTBR1"];
            mmu.baseaddr1 = bitops.clear_bits(ttbr1, 13, 0);
            that.log_value(word, "word");
            that.log_value(mmu.baseaddr1, "baseaddr1 in ttbcr");
        }
        display.log("TTBCR called.");
    });

    /*
     * CPACR, Coprocessor Access Control Register
     */
    this.register_writable("CPACR", 0);

    /*
     * Domain Access Control Register (DACR)
     * bits[31:30]: D15
     * ...
     * bits[1:0]: D0
     *   00: No access. Any access to the domain generates a Domain fault.
     *   01: Client. Accesses are checked against the permission bits in the translation tables.
     *   10: Reserved, effect is UNPREDICTABLE
     *   11: Manager. Accesses are not checked against the permission bits in the translation tables.
     */
    var dacr = 0;
    this.domains = new Array();
    for (var i=0; i < 16; i++)
        this.domains[i] = 0;

    this.register_writable("DACR", dacr, function (word) {
        that.data["DACR"] = word;
        for (var i=0; i < 16; i++) {
            that.domains[i] = bitops.get_bits(word, i*2+1, i*2);
        }
    });

    /*
     * Data Fault Status Register (DFSR)
     * bit[12]: ExT, External abort type
     * bit[11]: WnR, Write not Read
     * bits[10,3:0]: FS, Fault status
     * //bits[7:4]: Domain, The domain of the fault address
     */
    // Note that these registers are actually read-only POV of software,
    // however, the values are changed by hardware during memory abort.
    // To be save/restore-able, register them as writable.
    this.register_writable("DFAR", 0);
    this.register_writable("IFAR", 0);
    this.register_writable("DFSR", 0);
    this.register_writable("IFSR", 0);

    this.register_writeonly("ICIALLU");
    this.register_writeonly("ICIMVAU");
    this.register_writeonly("BPIALL");
    this.register_writeonly("BPIMVA");
    this.register_writeonly("ISB");  // Instruction Synchronization Barrier
    this.register_writeonly("DCCMVAC");  // Clean data cache linux by MVA to PoU
    this.register_writeonly("DSB");  // Data Synchronization Barrier
    this.register_writeonly("DMB");  // Data Memory Barrier
    this.register_writeonly("DCCMVAU");  // Clean data cache line by MVA to PoU
    this.register_writeonly("DCCIMVAC");  // Clean and invalidate data cache line by MVA to PoU

    this.register_writeonly("ITLBIALL");  // invalidate instruction TLB
    this.register_writeonly("ITLBIMVA");  // invalidate instruction TLB entry by MVA
    this.register_writeonly("ITLBIASID");  // invalidate instruction TLB by ASID match
    this.register_writeonly("DTLBIALL");  // invalidate data TLB
    this.register_writeonly("DTLBIMVA");  // invalidate data TLB entry by MVA
    this.register_writeonly("DTLBIASID");  // invalidate data TLB by ASID match
    this.register_writeonly("UTLBIALL");  // invalidate unified TLB
    this.register_writeonly("UTLBIMVA");  // invalidate unified TLB entry by MVA
    this.register_writeonly("UTLBIASID");

    this.register_writable("PRRR", 0);  // TODO
    this.register_writable("NMRR", 0);  // TODO

    // Context ID Register (CONTEXTIDR)
    this.register_writable("CONTEXTIDR", 0, function (word) {
        var procid = (word >>> 8) & 0x00ffffff;
        var asid = word & 0xff;
        var old_asid = that.data["CONTEXTIDR"] & 0xff;
        display.log("PROCID=" + procid + ", ASID=" + asid + ", ASID(old)=" + old_asid);
        mmu.asid = asid;
        that.data["CONTEXTIDR"] = word;
    });

    // Software Thread ID registers
    this.register_writable("TPIDRURW", 0);
    this.register_writable("TPIDRURO", 0);
}

ARMv7_CP15.prototype.register_readonly = function(name, initval) {
    this.read[this[name]] = initval;
};

ARMv7_CP15.prototype.register_writeonly = function(name, cb_w) {
    if (cb_w) {
        this.write[this[name]] = cb_w;
    } else {
        var that = this;
        this.write[this[name]] = function(word) {
            that.data[name] = word;
        };
    }
};

ARMv7_CP15.prototype.register_writable = function(name, initval, cb_w) {
    this.data[name] = initval;
    var that = this;
    if (cb_w) {
        this.read[this[name]] = function() {
            return that.data[name];
        };
        this.write[this[name]] = cb_w;
    } else {
        this.read[this[name]] = function() {
            return that.data[name];
        };
        this.write[this[name]] = function(word) {
            that.data[name] = word;
        };
    }
};

ARMv7_CP15.prototype.send_word = function(inst, word) {
    var opc1 = (inst >>> 21) & 0x7;
    var crn = (inst >>> 16) & 0xf; // the major register specifier
    var opc2 = (inst >>> 5) & 0x7;
    var crm = inst & 0xf;
    var func = this.write[[crn, opc1, crm, opc2]];
    if (func)
        func(word);
    else
        throw "write: " + [crn, opc1, crm, opc2];
};

ARMv7_CP15.prototype.get_word = function(inst) {
    var opc1 = (inst >>> 21) & 0x7;
    var crn = (inst >>> 16) & 0xf; // the major register specifier
    var opc2 = (inst >>> 5) & 0x7;
    var crm = inst & 0xf;
    //this.dump_inst(inst);
    var ret = this.read[[crn, opc1, crm, opc2]];
    if (typeof ret == "number")
        return ret;
    else if (ret !== undefined)
        return ret();
    else
        throw "read: " + [crn, opc1, crm, opc2];
};

ARMv7_CP15.prototype.save = function() {
    var params = Object();
    for (var i in this.data) {
        params[i] = this.data[i];
    }
    return params;
};

ARMv7_CP15.prototype.restore = function(params) {
    for (var i in this.data) {
        this.data[i] = params[i];
    }
    if (bitops.get_bit(this.data["SCTLR"], 0))
        this.cpu.mmu.enabled = true;
    else
        this.cpu.mmu.enabled = false;
    if (!bitops.get_bit(this.data["SCTLR"], 24)) { // SCTLR.VE
        if (bitops.get_bit(this.data["SCTLR"], 13)) { // SCTLR.V
            this.interrupt_vector_address = 0xffff0000;
        } else {
            this.interrupt_vector_address = 0x00000000;
        }
    }
    if (bitops.get_bit(this.data["SCTLR"], 1)) // SCTLR.A
        this.cpu.mmu.check_unaligned = true;
    else
        this.cpu.mmu.check_unaligned = false;
    for (var i=0; i < 16; i++)
        this.domains[i] = bitops.get_bits(this.data["DACR"], i*2+1, i*2);
};

ARMv7_CP15.prototype.dump_reg = function(name) {
    var val = this.data[name];
    display.log(name + ":\t" + toStringHex32(val) + " (" + toStringBin32(val) + ")");
};

ARMv7_CP15.prototype.sctlr_get_nmfi = function() {
    var sctlr = this.data["SCTLR"];
    return (sctlr >>> 27) & 1;
};

ARMv7_CP15.prototype.dump_sctlr = function() {
    var sctlr = this.data["SCTLR"];
    var val;
    var msgs = new Array();
    val = bitops.get_bit(sctlr, 29);
    msgs.push("AFE=" + (val ? "simple" : "full"));
    val = bitops.get_bit(sctlr, 28);
    msgs.push("TRE=" + (val ? "enabled" : "disabled"));
    val = bitops.get_bit(sctlr, 27);
    msgs.push("NMFI=" + (val ? "non-maskable" : "maskable"));
    val = bitops.get_bit(sctlr, 24);
    msgs.push("VE=" + val);
    val = bitops.get_bit(sctlr, 21);
    msgs.push("FI=" + (val ? "all" : "some"));
    val = bitops.get_bit(sctlr, 17);
    msgs.push("HA=" + (val ? "enabled" : "disabled"));
    val = bitops.get_bit(sctlr, 13);
    msgs.push("V=" + val);
    val = bitops.get_bit(sctlr, 1);
    msgs.push("A=" + (val ? "check unaligned" : "NOT check unaligned"));
    val = bitops.get_bit(sctlr, 0);
    msgs.push("MMU=" + (val ? "enabled" : "disabled"));
    display.log("SCTLR: " + msgs.join(", "));
};

ARMv7_CP15.prototype.dump = function() {
    this.dump_reg("CSSELR");
    this.dump_reg("TTBCR");
    this.dump_reg("SCTLR");
    this.dump_reg("TTBR0");
    this.dump_reg("TTBR1");
    this.dump_reg("DACR");
    this.dump_sctlr();
    display.log("domains=" + this.domains.toString());
    display.log("interrupt vector address=" + this.interrupt_vector_address.toString(16));
};

ARMv7_CP15.prototype.dump_inst = function(inst) {
    var opc1 = bitops.get_bits(inst, 23, 21);
    var crn = bitops.get_bits(inst, 19, 16);
    var opc2 = bitops.get_bits(inst, 7, 5);
    var crm = bitops.get_bits(inst, 3, 0);
    var msg = "";
    msg += "crn=" + crn.toString(16) + "(" + crn.toString(2) + ")";
    msg += ", ";
    msg += "opc1=" + opc1.toString(16) + "(" + opc1.toString(2) + ")";
    msg += ", ";
    msg += "crm=" + crm.toString(16) + "(" + crm.toString(2) + ")";
    msg += ", ";
    msg += "opc2=" + opc2.toString(16) + "(" + opc2.toString(2) + ")";
    logger.log(msg);
};

ARMv7_CP15.prototype.dump_value = function(value, name) {
    this.output_value(display, value, name);
};

ARMv7_CP15.prototype.log_value = function(value, name) {
    if (!this.options.enable_logger)
        return;

    this.output_value(logger, value, name);
};

ARMv7_CP15.prototype.output_value = function(target, value, name) {
    if (name)
        target.log(name + "=" + value.toString(10) + "\t" + toStringHex32(value) + "(" + toStringBin32(value) + ")");
    else
        target.log("value=" + value.toString(10) + "\t" + toStringHex32(value) + "(" + toStringBin32(value) + ")");
};

ARMv7_CP15.prototype.set_memory_abort = function(vaddr, status, is_write) {
    this.data["DFAR"] = vaddr;
    this.data["IFAR"] = vaddr; // XXX
    var dfsr = is_write ? (1 << 11) : 0;
    // This bit is for hardware error, so we can ignore it.
    //dfsr = bitops.set_bit(dfsr, 10, is_write);
    dfsr = dfsr + status;
    this.data["DFSR"] = dfsr;
    this.data["IFSR"] = dfsr; // XXX
};
