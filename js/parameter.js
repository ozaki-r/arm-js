/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
function Configurations() {
    this.memory_size = 20*1024*1024;

    this.configuration_strings = [
        'memory_size'
    ];

    this.JSONlocalStorage = new JSONlocalStorage("configurations", this, this.configuration_strings);
}

Configurations.prototype.read_saved_values = function() {
    display.log("Restoring Saved configurations");
    this.JSONlocalStorage.restore();
    this.reflect();
};

Configurations.prototype.save_to_localStorage = function() {
    display.log("Saving configurations");
    this.JSONlocalStorage.save();
};

Configurations.prototype.reflect_input_number = function(name) {
    if (!this[name])
        return;
    $('#' + name).val((this[name]/1024/1024).toString());
};

Configurations.prototype.reflect = function() {
    this.reflect_input_number('memory_size');
};

Configurations.prototype.register_input_number_handler = function(name) {
    var configs = this;
    $('#' + name).change(function() {
            configs[name] = parseInt(this.value)*1024*1024; 
        }).change();
};

Configurations.prototype.register_handlers = function() {
    this.register_input_number_handler('memory_size');
};

Configurations.prototype.dump = function(target) {
    for (var i in this.configuration_strings) {
        var config = this.configuration_strings[i];
        target.log(config + ": " + this[config]);
    }
};

function Parameters() {
    this.Image_url = 'Image-3.6.1';
    this.cmdline = 'rw root=/dev/ram0 console=ttyAMA0 earlyprintk';
    this.initrd_url = 'initramfs.cpio.lzo';
    this.initrd_size = 172428;
    this.initrd_decomp_size = 310784;
    this.dtb_url = 'vexpress-armjs.dtb';

    this.parameter_strings = [
        'Image_url',
        'cmdline',
        'initrd_url',
        'initrd_size',
        'initrd_decomp_size',
        'dtb_url',
    ];

    this.JSONlocalStorage = new JSONlocalStorage("parameters", this, this.parameter_strings);
}

Parameters.prototype.read_saved_values = function() {
    display.log("Restoring Saved parameters");
    this.JSONlocalStorage.restore();
    this.reflect();
};

Parameters.prototype.save_to_localStorage = function() {
    display.log("Saving parameters");
    this.JSONlocalStorage.save();
};

Parameters.prototype.reflect_input_number = function(name) {
    if (!this[name])
        return;
    $('#' + name).val(this[name].toString());
};

Parameters.prototype.reflect_input_text = function(name) {
    $('#' + name).val(this[name]);
};

Parameters.prototype.reflect = function() {
    this.reflect_input_text('Image_url');
    this.reflect_input_text('cmdline');
    this.reflect_input_text('initrd_url');
    this.reflect_input_number('initrd_size');
    this.reflect_input_number('initrd_decomp_size');
    this.reflect_input_text('dtb_url');
};

Parameters.prototype.register_input_number_handler = function(name) {
    var params = this;
    $('#' + name).change(function() {
            params[name] = parseInt(this.value); 
        }).change();
};

Parameters.prototype.register_input_text_handler = function(name) {
    var params = this;
    $('#' + name).change(function() {
            params[name] = this.value;
        }).change();
};

Parameters.prototype.register_handlers = function() {
    this.register_input_text_handler('Image_url');
    this.register_input_text_handler('cmdline');
    this.register_input_text_handler('initrd_url');
    this.register_input_number_handler('initrd_size');
    this.register_input_number_handler('initrd_decomp_size');
    this.register_input_text_handler('dtb_url');
};

Parameters.prototype.dump = function(target) {
    for (var i in this.parameter_strings) {
        var param = this.parameter_strings[i];
        target.log(param + ": " + this[param]);
    }
};

