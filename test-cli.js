#!/usr/bin/env node
// Test duck CLI directly
const { spawn } = require('child_process');
const path = require('path');

const cliPath = path.join(__dirname, '..', 'dist', 'cli', 'main.js');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node test-cli.js <command>');
  process.exit(1);
}

const child = spawn('node', [cliPath, ...args], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code || 0));
