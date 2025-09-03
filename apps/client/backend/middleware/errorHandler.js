export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Ensure we send JSON responses even for errors
  res.setHeader('Content-Type', 'application/json');

  if (err.response?.status === 429) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // Handle specific error types
  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // Default error response
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}