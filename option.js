/*!
 * Javascript ARMv7 Emulator
 *
 * Copyright 2012, Ryota Ozaki
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
function Options() {
    this.enable_stopper = false;
    this.enable_logger = false;
    this.enable_tracer = false;
    this.enable_branch_tracer = false;
    this.logger_buffering = true;
    this.log_size = 1000;
    this.trace_size = 1000;
    this.trace_check_size = 10;
    this.tracer_buffering = true;
    this.branch_trace_size = 1000;
    this.branch_tracer_buffering = true;
    this.stop_counter = Number.NaN;
    this.stop_instruction = Number.NaN;
    this.stop_address = Number.NaN;
    this.stop_at_every_branch = false;
    this.stop_at_every_funccall = false;
    this.update_current_function = false;
    this.suppress_interrupts = false;
    this.show_act_on_viraddr = Number.NaN;
    this.enable_instruction_counting = false;

    this.option_strings = [
        'enable_stopper',
        'stop_address',
        'stop_counter',
        'stop_instruction',
        'stop_at_every_branch',
        'stop_at_every_funccall',
        'enable_logger',
        'log_size',
        'logger_buffering',
        'enable_tracer',
        'trace_size',
        'trace_check_size',
        'tracer_buffering',
        'enable_branch_tracer',
        'branch_trace_size',
        'branch_tracer_buffering',
        'update_current_function',
        'suppress_interrupts',
        'show_act_on_viraddr',
        'enable_instruction_counting'
    ];
    this.hex_values = {
        'stop_address': true,
        'stop_instruction': true,
        'show_act_on_viraddr': true
    };

    this.JSONlocalStorage = new JSONlocalStorage("options", this, this.option_strings);
}

Options.prototype.read_saved_values = function(display) {
    display.log("Restoring Saved options");
    this.JSONlocalStorage.restore();
    this.reflect();
};

Options.prototype.save_to_localStorage = function() {
    display.log("Saving options");
    this.JSONlocalStorage.save();
};

Options.prototype.reflect_input_number = function(name) {
    if (!this[name])
        return;
    if (this.hex_values[name])
        $('#' + name).val(this[name].toString(16));
    else
        $('#' + name).val(this[name].toString());
};

Options.prototype.reflect_checkbox = function(name) {
    if (this[name])
        $('#' + name).attr('checked','checked');
    else
        $('#' + name).removeAttr('checked');
};

Options.prototype.reflect = function() {
    this.reflect_input_number('log_size');
    this.reflect_checkbox('enable_logger');
    this.reflect_checkbox('logger_buffering');
    this.reflect_input_number('trace_size');
    this.reflect_input_number('trace_check_size');
    this.reflect_checkbox('enable_tracer');
    this.reflect_checkbox('tracer_buffering');
    this.reflect_input_number('branch_trace_size');
    this.reflect_checkbox('enable_branch_tracer');
    this.reflect_checkbox('branch_tracer_buffering');
    this.reflect_checkbox('enable_stopper');
    this.reflect_input_number('stop_address');
    if (Symbols[this.stop_address])
        $('#stop_address_name').val(Symbols[this.stop_address]);
    this.reflect_input_number('stop_instruction');
    this.reflect_input_number('stop_counter');
    this.reflect_checkbox('stop_at_every_branch');
    this.reflect_checkbox('stop_at_every_funccall');
    this.reflect_checkbox('update_current_function');
    this.reflect_checkbox('suppress_interrupts');
    this.reflect_input_number('show_act_on_viraddr');
    if (Symbols[this.show_act_on_viraddr])
        $('#show_act_on_symbol').val(Symbols[this.show_act_on_viraddr]);
    this.reflect_checkbox('enable_instruction_counting');
};

Options.prototype.register_checkbox_handler = function(name, childs) {
    var options = this;
    $('#' + name).change(function() {
            options[name] = this.checked; 
            for (var i in childs) {
                if (this.checked)
                    $('#' + childs[i]).removeAttr('disabled');
                else
                    $('#' + childs[i]).attr('disabled', 'disabled');
            }
        }).change();
};

Options.prototype.register_input_number_handler = function(name) {
    var options = this;
    $('#' + name).change(function() {
            if (options.hex_values[name])
                options[name] = parseInt(this.value, 16); 
            else
                options[name] = parseInt(this.value); 
        }).change();
};

Options.prototype.register_symaddr_handler = function(addrname, symname) {
    var options = this;
    $('#' + addrname).change(function() {
            options[addrname] = parseInt(this.value, 16); 
            if (Symbols[options[addrname]])
                $('#' + symname).val(Symbols[options[addrname]]);
            else
                $('#' + symname).val('');
        }).change();
    $("#" + symname).change(function() {
            var symname_value = this.value;
            if (Symbol2Address[symname_value]) {
                options[symname] = symname_value;
                options[addrname] = Symbol2Address[symname_value];
                $('#' + addrname).val(options[addrname].toString(16));
            } else {
                options[addrname] = Number.NaN;
                $('#' + addrname).val('');
            }
        }).change();
};

Options.prototype.register_handlers = function() {
    this.register_checkbox_handler('enable_logger', ['log_size', 'show_logs']);
    this.register_input_number_handler('log_size');
    this.register_checkbox_handler('logger_buffering');
    this.register_checkbox_handler('enable_tracer', ['trace_size', 'trace_check_size', 'show_traces']);
    this.register_input_number_handler('trace_size');
    this.register_input_number_handler('trace_check_size');
    this.register_checkbox_handler('tracer_buffering');
    this.register_checkbox_handler('enable_branch_tracer', ['branch_trace_size', 'show_branch_traces']);
    this.register_input_number_handler('branch_trace_size');
    this.register_checkbox_handler('branch_tracer_buffering');
    this.register_checkbox_handler('enable_stopper', ['stop_address', 'stop_address_name', 'stop_instruction', 'stop_counter', 'stop_at_every_branch', 'stop_at_every_funccall']);
    this.register_symaddr_handler('stop_address', 'stop_address_name');
    this.register_input_number_handler('stop_instruction');
    this.register_input_number_handler('stop_counter');
    this.register_checkbox_handler('stop_at_every_branch');
    this.register_checkbox_handler('stop_at_every_funccall');
    this.register_checkbox_handler('update_current_function');
    this.register_checkbox_handler('suppress_interrupts');
    this.register_symaddr_handler('show_act_on_viraddr', 'show_act_on_symbol');
    this.register_checkbox_handler('enable_instruction_counting');
};

Options.prototype.dump = function(target) {
    for (var i in this.option_strings) {
        var opt = this.option_strings[i];
        target.log(opt + ": " + this[opt]);
    }
};

Options.prototype.parse_querystring = function() {
    if (location.search == "")
        return;
    var qss = location.search.substring(1).split("&");
    for (var i in qss) {
        var qs = qss[i].split("=");
        var optname = qs[0];
        if (this[optname] == undefined)
            throw "Invalid option name = " + optname;
        var val = qs[1]
        if (val == "true")
            val = true;
        else if (val == "false")
            val = false;
        else if (val.indexOf("0x") == 0)
            val = parseInt(val, 16);
        else if (parseInt(val) != NaN)
            val = parseInt(val);
        this[optname] = val;
    }
    console.log(this);
};
