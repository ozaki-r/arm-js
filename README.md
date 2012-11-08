Arm-js
======

Arm-js is an ARM emulator written in Javascript. It emulates ARMv7-A
and some peripherals of Versatile Express. It can boot Linux 3.6.1
and run busybox processes.

Emulator Features
=================

* Suspend/resume (Chrome only)
  * You can restore emulator states at any time
* Persistent storage (Chrome only)
  * Guest can access part of browser [filesystem](http://www.w3.org/TR/file-system-api/) via virtio-9p
* Many debugging functions

Tested Browsers
===============

* Chrome 23 (recommended)
* Firefox 16
* Safari 6

Get Started
===========

1. Prepare term.js
  1. Install [js-beautify](https://github.com/einars/js-beautify)
  2. Run prepare_termjs.sh
2. Deploy files either on local filesystem or on HTTP server
3. Access arm-js.html
4. Push Boot button at the top-left corner to start the emulator

Note that for Chrome you need to add --allow-file-access-from-files
option to run arm-js from local filesystem. For example, for Mac OS X,
execute 'open -a "Google Chrome" --args --allow-file-access-from-files'
on a terminal.
