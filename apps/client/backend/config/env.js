import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, '..');

export function loadEnv() {
  const envPath = path.join(serverDir, '.env');
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.error('Error loading .env file:', result.error);
    process.exit(1);
  }

  // Verify required environment variables
  const requiredVars = [
    'PORT',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'QUOTE_REQUEST_EMAIL',
    'OPENAI_API_KEY',
    'DATABASE_URL',
    'JWT_SECRET'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars.join(', '));
    process.exit(1);
  }

  // Handle boolean environment variables
  if (process.env.CLEAR_PRICES) {
    // Normalize CLEAR_PRICES to a standard format
    const clearPricesValue = process.env.CLEAR_PRICES.toLowerCase();
    if (['true', 'yes', '1', 'on'].includes(clearPricesValue)) {
      process.env.CLEAR_PRICES = 'true';
      console.log('[Server] CLEAR_PRICES is enabled');
    } else {
      process.env.CLEAR_PRICES = 'false';
      console.log('[Server] CLEAR_PRICES is disabled');
    }
  } else {
    // Default value if not set
    process.env.CLEAR_PRICES = 'false';
    console.log('[Server] CLEAR_PRICES defaulted to disabled');
  }
  
  // Log successful loading (but not the values)
  console.log('Environment variables loaded successfully');
}