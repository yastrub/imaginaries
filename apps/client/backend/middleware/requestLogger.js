export function requestLogger(req, res, next) {
  const timestamp = new Date().toISOString();
  const { prompt } = req.body;
  
  console.log('\n=== Image Generation Request ===');
  console.log(`Time: ${timestamp}`);
  console.log(`IP: ${req.ip}`);
  console.log(`Prompt: "${prompt}"`);
  console.log('===============================\n');

  // Capture the response
  const originalSend = res.json;
  res.json = function(body) {
    console.log('=== Image Generation Response ===');
    console.log(`Status: ${res.statusCode}`);
    console.log(`Image URL: ${body.imageUrl || 'N/A'}`);
    console.log('================================\n');
    
    return originalSend.call(this, body);
  };

  next();
}