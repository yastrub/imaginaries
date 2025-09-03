import { execSync } from 'child_process';
import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Paths
const ROOT_DIR = resolve(__dirname, '..');
const DIST_DIR = resolve(ROOT_DIR, '..', 'dist');
const PROD_PKG = resolve(ROOT_DIR, 'package.prod.json');
const FINAL_PKG = resolve(DIST_DIR, 'package.json');

// Copy server files to dist
function copyServerFiles() {
  console.log('Copying server files to dist...');
  
  const filesToCopy = [
    'index.js',
    'routes',
    'middleware',
    'config',
    'models',
    'utils',
    'migrations'
  ];

  for (const file of filesToCopy) {
    try {
      execSync(`cp -r ${join(ROOT_DIR, file)} ${DIST_DIR}/`);
    } catch (error) {
      console.error(`Error copying ${file}:`, error);
      process.exit(1);
    }
  }
}

// Copy production package.json
function copyPackageJson() {
  console.log('Setting up production package.json...');
  try {
    copyFileSync(PROD_PKG, FINAL_PKG);
  } catch (error) {
    console.error('Error copying package.json:', error);
    process.exit(1);
  }
}

// Main build function
async function build() {
  try {
    console.log('Starting server build process...');
    
    // Create dist directory if it doesn't exist
    execSync(`mkdir -p ${DIST_DIR}`);
    
    // Copy server files
    copyServerFiles();
    
    // Copy production package.json
    copyPackageJson();
    
    console.log('Server build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();