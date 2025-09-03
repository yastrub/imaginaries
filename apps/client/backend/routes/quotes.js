import express from 'express';
import { sendEmail } from '../config/email.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, message, image } = req.body;

    console.log('Quote request received:', { name, email, messageLength: message?.length, image });

    if (!name || !email || !message || !image) {
      console.error('Missing required fields:', { name: !!name, email: !!email, message: !!message, image: !!image });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Extract image URL from various possible properties
    const imageUrl = image.url || image.image_url || image.watermarked_url;
    
    if (!imageUrl) {
      console.error('Missing image URL in the request');
      return res.status(400).json({ error: 'Missing image URL' });
    }

    // Send email with enhanced data including estimated cost
    await sendEmail('quoteRequest', {
      name,
      email,
      message,
      imageId: image.id,
      prompt: image.prompt,
      imageUrl: imageUrl, // Use the extracted URL
      createdAt: image.createdAt,
      metadata: image.metadata || {},
      estimatedCost: image.estimatedCost || 'Not available'
    });

    res.json({ message: 'Quote request sent successfully' });
  } catch (error) {
    console.error('Quote request error:', error);
    res.status(500).json({ error: 'Failed to send quote request' });
  }
});

export { router as quotesRouter };