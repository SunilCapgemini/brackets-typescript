'use strict';

var PackageJson = require('../../package.json');
var EXTENSION_NAME = PackageJson.name;

function doLog(level: string, msgs: string[]): void {
  console[level].apply(console, ['[' + EXTENSION_NAME + ']'].concat(msgs));
}

export function info(...messages: string[]): void {
  doLog('log', messages);
};

export function error(...messages: string[]): void {
  doLog('error', messages);
};
