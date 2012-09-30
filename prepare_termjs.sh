#!/bin/sh

which js-beautify >/dev/null
if [ $? != 0 ]; then
	echo "Please install js-beautify"
	echo "Get it from https://github.com/einars/js-beautify"
	exit 1
fi

wget -q http://bellard.org/jslinux/term.js -O /tmp/term.js
js-beautify /tmp/term.js > term.js

patch term.js term.js.patch
