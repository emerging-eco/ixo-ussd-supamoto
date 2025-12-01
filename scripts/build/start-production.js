#!/usr/bin/env node
/**
 * Production startup script
 * Cross-platform replacement for: NODE_ENV=production node dist/migrations/run-migrations.js && sleep 2 && node dist/index.js
 * 
 * This script:
 * - Sets NODE_ENV=production in a cross-platform way
 * - Runs database migrations first
 * - Waits 2 seconds for database to stabilize
 * - Starts the main application
 * - Handles errors and exit codes properly
 * - Supports graceful shutdown on SIGTERM/SIGINT
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// Set environment
process.env.NODE_ENV = 'production';

console.log('🚀 Starting production server...\n');

// Step 1: Run migrations
console.log('📊 Step 1: Running database migrations...');
const migrationsPath = path.join(projectRoot, 'dist', 'migrations', 'run-migrations.js');

const migrations = spawn('node', [migrationsPath], {
  stdio: 'inherit',
  env: process.env,
  cwd: projectRoot
});

migrations.on('error', (error) => {
  console.error(`❌ Failed to start migrations: ${error.message}`);
  process.exit(1);
});

migrations.on('close', (code) => {
  if (code !== 0) {
    console.error(`\n❌ Migrations failed with exit code ${code}`);
    process.exit(code);
  }

  console.log('\n✅ Migrations completed successfully');
  
  // Step 2: Wait 2 seconds
  console.log('⏳ Waiting 2 seconds before starting server...');
  setTimeout(() => {
    
    // Step 3: Start main application
    console.log('🚀 Starting main application...\n');
    const appPath = path.join(projectRoot, 'dist', 'index.js');
    
    const app = spawn('node', [appPath], {
      stdio: 'inherit',
      env: process.env,
      cwd: projectRoot
    });

    app.on('error', (error) => {
      console.error(`❌ Failed to start application: ${error.message}`);
      process.exit(1);
    });

    app.on('close', (code) => {
      console.log(`\nApplication exited with code ${code}`);
      process.exit(code || 0);
    });

    // Handle termination signals for graceful shutdown
    process.on('SIGTERM', () => {
      console.log('\n⚠️  Received SIGTERM, shutting down gracefully...');
      app.kill('SIGTERM');
    });

    process.on('SIGINT', () => {
      console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
      app.kill('SIGINT');
    });

  }, 2000);
});

