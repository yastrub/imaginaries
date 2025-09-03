export function validatePrompt(req, res, next) {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid prompt' });
  }

  if (prompt.length > 1000) {
    return res.status(400).json({ error: 'Prompt too long' });
  }

  next();
}