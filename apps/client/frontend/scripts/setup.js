import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

// Function to read package.json
function readPackageJson(path) {
  try {
    const content = readFileSync(path, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${path}:`, error);
    process.exit(1);
  }
}

// Install dependencies for both client and server
function installDependencies() {
  try {
    console.log('Installing client dependencies...');
    execSync('npm install', { stdio: 'inherit' });

    console.log('\nInstalling server dependencies...');
    execSync('cd server && npm install', { stdio: 'inherit' });

    console.log('\nAll dependencies installed successfully!');
  } catch (error) {
    console.error('Error installing dependencies:', error);
    process.exit(1);
  }
}

// Main setup function
function setup() {
  // Read both package.json files
  const clientPkg = readPackageJson('./package.json');
  const serverPkg = readPackageJson('./server/package.json');

  // Install dependencies
  installDependencies();

  // Start the development server
  try {
    console.log('\nStarting server...');
    execSync('cd server && npm run dev', { 
      stdio: 'inherit',
      detached: true 
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

setup();