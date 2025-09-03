import express from 'express';
import { query } from '../config/db.js';
import { auth } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Get like status and counts for multiple images - MUST be before the :imageId routes!
router.post('/status/get', async (req, res) => {
  try {
    const { imageIds } = req.body;
    
    if (!imageIds?.length) {
      return res.json({ liked: [], counts: {} });
    }

    console.log('Fetching likes status:', { imageIds });

    // Get like counts for all images - this is public
    const countsResult = await query(
      'SELECT image_id, COUNT(*) as count FROM likes WHERE image_id = ANY($1) GROUP BY image_id',
      [imageIds]
    );

    const counts = Object.fromEntries(
      countsResult.rows.map(row => [row.image_id, parseInt(row.count)])
    );

    // Get user's liked images if authenticated
    let liked = [];
    if (req.cookies.token) {
      try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        const likedResult = await query(
          'SELECT image_id FROM likes WHERE user_id = $1 AND image_id = ANY($2)',
          [decoded.userId, imageIds]
        );
        liked = likedResult.rows.map(row => row.image_id);
      } catch (error) {
        console.error('Error fetching liked status:', error);
      }
    }

    res.json({ liked, counts });
  } catch (error) {
    console.error('Like status error:', error);
    res.status(500).json({ error: 'Failed to get like status' });
  }
});

// Toggle like status - requires auth
router.post('/:imageId', auth, async (req, res) => {
  try {
    if (!req.user?.id) {
      console.error('Missing user ID in request:', req.user);
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { imageId } = req.params;
    const userId = req.user.id;

    // Validate that imageId is a valid UUID-like string
    if (!imageId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ error: 'Invalid image ID format' });
    }

    console.log('Adding like:', { userId, imageId });

    const result = await query(
      'INSERT INTO likes (user_id, image_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, imageId]
    );

    console.log('Like added:', result);
    res.json({ success: true });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to like image' });
  }
});

// Unlike an image - requires auth
router.delete('/:imageId', auth, async (req, res) => {
  try {
    if (!req.user?.id) {
      console.error('Missing user ID in request:', req.user);
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { imageId } = req.params;
    const userId = req.user.id;

    // Validate that imageId is a valid UUID-like string
    if (!imageId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ error: 'Invalid image ID format' });
    }

    console.log('Removing like:', { userId, imageId });

    await query(
      'DELETE FROM likes WHERE user_id = $1 AND image_id = $2',
      [userId, imageId]
    );

    console.log('Like removed');
    res.json({ success: true });
  } catch (error) {
    console.error('Unlike error:', error);
    res.status(500).json({ error: 'Failed to unlike image' });
  }
});

export { router as likesRouter };