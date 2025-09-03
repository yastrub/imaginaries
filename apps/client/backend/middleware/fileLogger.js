import { appendToLog } from '../utils/logger.js';

export async function fileLogger(req, res, next) {
  const timestamp = new Date().toISOString();
  const { prompt } = req.body;
  
  const logMessage = [
    '=== Image Generation Request ===',
    `Time: ${timestamp}`,
    `IP: ${req.ip}`,
    `Prompt: "${prompt}"`,
    '===============================\n'
  ].join('\n');

  await appendToLog(logMessage);

  // Log response
  const originalSend = res.json;
  res.json = async function(body) {
    const responseLog = [
      '=== Image Generation Response ===',
      `Status: ${res.statusCode}`,
      `Image URL: ${body.imageUrl || 'N/A'}`,
      '================================\n'
    ].join('\n');
    
    await appendToLog(responseLog);
    return originalSend.call(this, body);
  };

  next();
}