#!/usr/bin/env node
/**
 * Verify build output structure
 * Ensures all required files exist before deployment
 * 
 * This script:
 * - Checks that all critical files exist in the dist directory
 * - Verifies migrations are properly copied
 * - Shows file sizes for sanity checking
 * - Exits with error code if any required file is missing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

console.log('🔍 Verifying build output...\n');

const requiredFiles = [
  'dist/index.js',
  'dist/migrations/run-migrations.js',
  'dist/migrations/postgres/000-init-all.sql'
];

let allValid = true;

for (const file of requiredFiles) {
  const filePath = path.join(projectRoot, file);
  const exists = fs.existsSync(filePath);
  
  if (exists) {
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`✅ ${file} (${sizeKB} KB)`);
  } else {
    console.error(`❌ Missing: ${file}`);
    allValid = false;
  }
}

console.log('');

if (!allValid) {
  console.error('❌ Build verification failed: Required files are missing\n');
  console.error('💡 Troubleshooting:');
  console.error('   - Run: pnpm build:compile (to compile TypeScript)');
  console.error('   - Run: pnpm build:copy (to copy SQL migrations)');
  console.error('   - Check tsconfig.build.json includes src/migrations/');
  console.error('   - Check migrations/postgres/ directory exists\n');
  process.exit(1);
}

console.log('✅ Build verification passed: All required files present\n');
process.exit(0);
