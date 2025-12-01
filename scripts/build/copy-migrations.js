#!/usr/bin/env node
/**
 * Copy SQL migration files to dist directory
 * Cross-platform replacement for: copyfiles -u 1 migrations SQL files to dist
 *
 * This script:
 * - Uses Node.js fs module for cross-platform file operations
 * - Handles path separators automatically (Windows backslash vs Unix forward slash)
 * - Provides clear error messages and logging
 * - Exits with proper error codes for CI/CD pipelines
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

console.log('📦 Copying SQL migration files...');

try {
  // Source and destination paths
  const sourceDir = path.join(projectRoot, 'migrations', 'postgres');
  const destDir = path.join(projectRoot, 'dist', 'migrations', 'postgres');

  // Check if source directory exists
  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  // Create destination directory (recursive)
  fs.mkdirSync(destDir, { recursive: true });
  console.log(`   ✅ Created directory: ${destDir}`);

  // Read all SQL files from source directory
  const sqlFiles = fs.readdirSync(sourceDir).filter(file => file.endsWith('.sql'));

  if (sqlFiles.length === 0) {
    console.warn('⚠️  No SQL files found in migrations/postgres/');
    process.exit(0);
  }

  console.log(`   Found ${sqlFiles.length} SQL file(s):`);

  // Copy each file
  let copiedCount = 0;
  for (const file of sqlFiles) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);
    
    fs.copyFileSync(sourcePath, destPath);
    console.log(`   ✅ ${file}`);
    copiedCount++;
  }

  console.log(`\n✅ Successfully copied ${copiedCount} migration file(s) to dist/migrations/postgres/\n`);
  process.exit(0);

} catch (error) {
  console.error('\n❌ Error copying migration files:');
  console.error(`   ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

