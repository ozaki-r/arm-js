Arm-js
======

Arm-js is an ARM emulator written in Javascript. It emulates ARMv7-A
and some peripherals of Versatile Express. It can boot Linux 3.6.1
and run busybox processes.

Emulator Features
---

* Suspend/resume (Chrome only)
  * You can restore emulator states at any time
* Persistent storage (Chrome only)
  * Guest can access part of browser [filesystem](http://www.w3.org/TR/file-system-api/) via virtio-9p
* Many debugging functions

Tested Browsers
---

* Chrome 27 beta (recommended)
* Firefox 20

Get Started
---

1. Download the source code
   1. git clone git://github.com/ozaki-r/arm-js.git
   2. cd arm-js/
   2. git submodule init
   3. git submodule update
2. Execute ruby misc/simple-http-server.rb on terminal
3. Access http://localhost:8080/arm-js.html
4. Push Boot button at the top-left corner to start the emulator

Further Information
---

See the [wiki](https://github.com/ozaki-r/arm-js/wiki).
