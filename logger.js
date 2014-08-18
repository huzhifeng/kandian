#!/usr/bin/env node
var tracer = require('tracer');
var fs = require('fs');

module.exports = tracer.console({
  level: process.argv[3] || process.env.logger_level || 'warn',
  format: '[{{timestamp}}] <{{title}}> (in function {{method}} {{file}}:{{line}}) {{message}}',
  dateformat: 'yyyy-mm-dd HH:MM:ss.L',
  transport: function(data) {
    console.log(data.output);
    var stream = fs.createWriteStream('./err.log', {
      flags: 'a',
      encoding: 'utf8',
      mode: 0666
    }).write(data.output + '\n');
  }
});
