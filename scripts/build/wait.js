#!/usr/bin/env node
/**
 * Cross-platform sleep/wait utility
 * Replacement for: sleep 2
 * 
 * Usage: node wait.js <seconds>
 * Example: node wait.js 2
 * 
 * This script provides a cross-platform way to wait/sleep
 * that works on Windows, macOS, and Linux.
 */

const seconds = parseInt(process.argv[2] || '2', 10);

if (isNaN(seconds) || seconds < 0) {
  console.error('❌ Invalid argument');
  console.error('Usage: node wait.js <seconds>');
  console.error('Example: node wait.js 2');
  process.exit(1);
}

console.log(`⏳ Waiting ${seconds} second(s)...`);

setTimeout(() => {
  console.log('✅ Wait complete');
  process.exit(0);
}, seconds * 1000);
