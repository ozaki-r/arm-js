#!/usr/bin/ruby
#
# Javascript ARMv7 Emulator
#
# Copyright 2012, Ryota Ozaki
# Dual licensed under the MIT or GPL Version 2 licenses.
#

symbols = {}
sym2addr = {}
ARGF.readlines.each do |line|
    #if line =~ /(\w+) <([\w_]+)>:/
    if line =~ /^(\w+) [Tt] ([\.\w_]+)$/
    	addr = "0x" + $1
    	name = $2
	symbols[addr] = name
	sym2addr[name] = addr
    end
end

puts "Symbols = Object();"
symbols.each do |addr, name|
    puts "Symbols[#{addr}] = \"#{name}\";"
end

puts "Symbol2Address = Object();"
sym2addr.each do |name, addr|
    puts "Symbol2Address[\"#{name}\"] = #{addr};"
    if name.include?('.')
        puts "Symbol2Address[\"#{name.gsub(/\..+/, '')}\"] = #{addr};"
    end
end
