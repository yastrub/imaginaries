import fs from 'fs/promises';
import path from 'path';

const LOG_DIR = 'logs';
const LOG_FILE = 'requests.log';

async function ensureLogDir() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating log directory:', err);
  }
}

export async function appendToLog(message) {
  await ensureLogDir();
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  try {
    await fs.appendFile(path.join(LOG_DIR, LOG_FILE), logMessage);
  } catch (err) {
    console.error('Error writing to log file:', err);
  }
}