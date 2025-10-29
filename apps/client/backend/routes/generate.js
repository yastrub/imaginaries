import express from 'express';
import { query } from '../config/db.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { generateImage, GENERATORS, DEFAULT_GENERATOR } from '../config/imageGenerators.js';
import { checkGenerationLimits } from '../middleware/subscriptionLimits.js';
import { generateLimiter } from '../middleware/rateLimiter.js';
import { auth } from '../middleware/auth.js';
import { uploadImage, addWatermark, deleteImage, uploadSketch } from '../config/cloudinary.js';
import { settings } from '../config/apiSettings.js';
import { processImageEstimation } from '../utils/estimationUtils.js';
import { processSketchWithVision } from '../utils/sketchUtils.js';
import upload from '../middleware/multer.js';

dotenv.config();

// Debug environment variables
console.log('[Server] Environment variables loaded:');
console.log('[Server] CLEAR_PRICES =', process.env.CLEAR_PRICES);
console.log('[Server] NODE_ENV =', process.env.NODE_ENV);

const router = express.Router();
const isDevelopment = process.env.NODE_ENV === 'development';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'dev-data', 'uploads');

// Ensure uploads directory exists in development
if (isDevelopment) {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

// Helper function to safely delete a file
async function safeDeleteFile(filePath) {
  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
    console.log('[Server] Successfully deleted file:', filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('[Server] File already deleted or does not exist:', filePath);
      return true;
    }
    console.error('[Server] Error deleting file:', filePath, error);
    return false;
  }
}

// Helper function to get all files in uploads directory
async function getUploadsDirectoryFiles() {
  if (!isDevelopment) return [];
  
  try {
    const files = await fs.readdir(UPLOADS_DIR);
    console.log('[Server] Found files in uploads directory:', files);
    return files;
  } catch (error) {
    console.error('[Server] Error reading uploads directory:', error);
    return [];
  }
}

// Helper function to clean up orphaned files for a specific user
async function cleanupOrphanedFiles(userId) {
  if (!isDevelopment) return;

  try {
    console.log('[Server] Starting orphaned files cleanup for user:', userId);
    
    // Get all files from the directory
    const filesInDirectory = await getUploadsDirectoryFiles();
    console.log('[Server] Files in directory:', filesInDirectory);

    // Get all files referenced in the database for this user
    let dbFiles = new Set();
    
    const result = await query(
      'SELECT image_url, watermarked_url FROM images WHERE user_id = $1',
      [userId]
    );
    result.rows.forEach(row => {
      if (row.image_url) dbFiles.add(row.image_url);
      if (row.watermarked_url) dbFiles.add(row.watermarked_url);
    });

    console.log('[Server] Files referenced in database for user:', Array.from(dbFiles));

    // Delete files that aren't in the database for this user
    for (const file of filesInDirectory) {
      // Check if the file belongs to this user by checking if it's in their dbFiles
      if (!dbFiles.has(file)) {
        // Additional check: only delete if file ID matches user's images
        const fileId = file.split('.')[0]; // Get ID part of filename
        const isUserFile = await isFileOwnedByUser(fileId, userId);
        
        if (isUserFile) {
          console.log('[Server] Deleting orphaned file:', file);
          await safeDeleteFile(path.join(UPLOADS_DIR, file));
        }
      }
    }

    console.log('[Server] Orphaned files cleanup completed for user:', userId);
  } catch (error) {
    console.error('[Server] Error during orphaned files cleanup:', error);
  }
}

// Helper function to check if a file belongs to a user
async function isFileOwnedByUser(fileId, userId) {
  const result = await query(
    'SELECT 1 FROM images WHERE user_id = $1 AND (id = $2 OR image_url LIKE $3 OR watermarked_url LIKE $3)',
    [userId, fileId, `%${fileId}%`]
  );
  return result.rows.length > 0;
}

// Process sketch with OpenAI Vision API has been moved to sketchUtils.js

// Helper function to download and process image
async function downloadImage(url, userId) {
  console.log('[Server] Processing image from:', url);
  
  try {
    // For development/Bolt, save locally
    if (isDevelopment) {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(buffer);
      
      const imageId = uuidv4();
      const filename = `${imageId}.png`;
      const filepath = path.join(UPLOADS_DIR, filename);
      
      // Write the file
      await fs.writeFile(filepath, imageBuffer);
      
      // Verify the written file
      const stats = await fs.stat(filepath);
      if (stats.size === 0) {
        throw new Error('Written file is empty');
      }
      
      console.log('[Server] Image saved locally:', filepath, 'Size:', stats.size, 'bytes');
      
      return { id: imageId, filename };
    }
    
    // For production, upload to Cloudinary
    const cloudinaryUrl = await uploadImage(url, userId);
    const imageId = cloudinaryUrl.split('/').pop().split('.')[0];
    
    console.log('[Server] Image uploaded to Cloudinary:', {
      imageId,
      url: cloudinaryUrl
    });
    
    return { id: imageId, filename: cloudinaryUrl };
  } catch (error) {
    console.error('[Server] Error processing image:', error);
    throw error;
  }
}

const ongoingGenerations = new Map();

// Serve static files from uploads directory in development
if (isDevelopment) {
  router.use('/uploads', express.static(UPLOADS_DIR));
}

// Quota endpoint: monthly image generation quota and usage
router.get('/quota', auth, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });

    const userId = req.user.id;
    // Determine user's plan
    const planResult = await query('SELECT subscription_plan FROM users WHERE id = $1', [userId]);
    const planKey = planResult.rows?.[0]?.subscription_plan || 'free';

    // Monthly paid + free limits from plans table (fallback free=3 if both zero)
    let limitPaid = 0;
    let limitFree = 0;
    try {
      const limitRes = await query('SELECT max_generations_per_month, max_free_generations FROM plans WHERE key = $1', [planKey]);
      limitPaid = parseInt(limitRes.rows?.[0]?.max_generations_per_month ?? 0, 10) || 0;
      limitFree = parseInt(limitRes.rows?.[0]?.max_free_generations ?? 0, 10) || 0;
    } catch {}
    if ((limitPaid + limitFree) <= 0 && planKey === 'free') limitFree = 3;
    const effectiveLimit = Math.max(0, limitPaid + limitFree);

    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const countRes = await query('SELECT COUNT(*) FROM images WHERE user_id = $1 AND created_at >= $2', [userId, startOfMonth.toISOString()]);
    const used = parseInt(countRes.rows?.[0]?.count ?? 0, 10) || 0;

    const unlimited = effectiveLimit <= 0 ? false : false; // explicit limits only; treat 0 as hard 0
    const remaining = Math.max(0, effectiveLimit - used);

    return res.json({
      plan: planKey,
      limit: effectiveLimit,
      limitPaid,
      limitFree,
      used,
      remaining,
      periodStart: startOfMonth.toISOString(),
    });
  } catch (err) {
    console.error('[Server] Quota endpoint error:', err);
    return res.status(500).json({ error: 'Failed to load quota' });
  }
});

// Public gallery route - no auth required but we'll check for auth token if present
router.get('/public', async (req, res) => {
  try {
    const { page = 1, limit = 20, view = 'recent' } = req.query;
    const offset = (page - 1) * limit;

    // Extract token from Authorization header or cookies
    let userId = null;
    
    // First try to get token from cookies (this is how your app authenticates)
    if (req.cookies && req.cookies.token) {
      try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        userId = decoded.userId;
        console.log('[Server] Authenticated user (cookie) accessing public gallery:', userId);
      } catch (error) {
        console.log('[Server] Invalid cookie token in public gallery');
        // Continue as unauthenticated - don't return an error
      }
    } 
    // If no cookie token, try Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
        console.log('[Server] Authenticated user (header) accessing public gallery:', userId);
      } catch (error) {
        console.log('[Server] Invalid header token in public gallery');
        // Continue as unauthenticated - don't return an error
      }
    }
    
    const queryBuilder = `
      WITH like_counts AS (
        SELECT 
          image_id,
          COUNT(*) as like_count
        FROM likes
        GROUP BY image_id
      )${userId ? `,
      user_likes AS (
        SELECT 
          image_id
        FROM likes
        WHERE user_id = '${userId}'
      )` : ''}
      SELECT 
        id,
        image_url,
        watermarked_url,
        user_id,
        is_private,
        like_count,
        ${userId ? "(image_id IN (SELECT image_id FROM user_likes)) as is_liked" : 'false as is_liked'},
        created_at,
        NULL as prompt, -- Privacy enhancement: Don't send prompt data for public gallery
        estimated_cost
      FROM images
      LEFT JOIN like_counts ON images.id = like_counts.image_id
      WHERE images.is_private = false
    `;

    let orderByClause = '';
    if (view === 'recent') {
      orderByClause = 'ORDER BY images.created_at DESC';
    } else if (view === 'top-liked') {
      orderByClause = 'ORDER BY like_counts.like_count DESC, images.created_at DESC';
    }

    const result = await query(`${queryBuilder} ${orderByClause} LIMIT $1 OFFSET $2`, [limit, offset]);
    
    // Get total count for pagination
    const totalCountResult = await query(`
      SELECT COUNT(*) as total_count 
      FROM images 
      WHERE is_private = false
    `);

    const totalCount = totalCountResult.rows[0].total_count;
    const totalPages = Math.ceil(totalCount / limit);


    res.json({
      images: result.rows,
      totalPages,
      totalCount
    });
  } catch (error) {
    console.error('Error fetching public images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Add this route to handle shared image requests
router.get('/shared/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    console.log('[Server] Fetching shared image:', imageId);
    
    // Validate imageId format
    if (!imageId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ error: 'Invalid image ID format' });
    }

    // Extract token from Authorization header if present
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
        console.log('[Server] Authenticated user accessing shared image:', userId);
      } catch (error) {
        console.log('[Server] Invalid token in shared image request, continuing as unauthenticated');
        // Continue as unauthenticated - don't return an error
      }
    }

    // Get image data with like information
    const query_string = `
      WITH like_counts AS (
        SELECT 
          image_id,
          COUNT(*) as like_count
        FROM likes
        GROUP BY image_id
      )${userId ? `,
      user_likes AS (
        SELECT 
          image_id
        FROM likes
        WHERE user_id = '${userId}'
      )` : ''}
      SELECT 
        images.*,
        COALESCE(like_counts.like_count, 0) as like_count,
        ${userId ? "(images.id IN (SELECT image_id FROM user_likes))" : 'false'} as is_liked
      FROM images
      LEFT JOIN like_counts ON images.id = like_counts.image_id
      WHERE images.id = $1
    `;
    
    const result = await query(query_string, [imageId]);

    if (result.rows.length === 0) {
      console.log('[Server] Image not found:', imageId);
      return res.status(404).json({ error: 'Image not found' });
    }

    const image = result.rows[0];
    console.log('[Server] Found image:', image);

    // Format response - don't include prompt for privacy
    const response = {
      id: image.id,
      url: isDevelopment ? `/api/generate/uploads/${image.image_url}` : image.image_url,
      // Don't include prompt in shared image response
      createdAt: image.created_at,
      metadata: image.metadata,
      watermarked: image.watermarked_url ? (isDevelopment ? `/api/generate/uploads/${image.watermarked_url}` : image.watermarked_url) : null,
      user_id: image.user_id,
      is_private: image.is_private || false,
      estimatedCost: image.estimated_cost || null
    };

    console.log('[Server] Sending response:', response);
    res.json(response);
  } catch (error) {
    console.error('[Server] Error fetching shared image:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// Toggle image privacy
router.put('/:imageId/privacy', auth, async (req, res) => {
  try {
    const { imageId } = req.params;
    const { isPrivate } = req.body;
    const userId = req.user.id;

    console.log('[Server] Updating privacy for image:', { imageId, isPrivate, userId });

    // Update privacy setting
    await query(
      'UPDATE images SET is_private = $1 WHERE id = $2 AND user_id = $3',
      [isPrivate, imageId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[Server] Privacy update error:', error);
    res.status(500).json({ error: 'Failed to update privacy setting' });
  }
});

// Apply specialized rate limiting to image generation
router.post('/', auth, generateLimiter, checkGenerationLimits, async (req, res) => {
  try {
    const userId = req.user.id;
    const { prompt, model = DEFAULT_GENERATOR, size = '1024x1024', quality = 'hd', drawingPng, drawingSvg, cameraPng, is_private = true } = req.body;
    
    // Check if we have sketch or camera data
    const hasSketch = drawingPng && drawingSvg;
    const hasCamera = !!cameraPng;
    
    let finalPrompt = prompt;
    let imageUrl;
    
    // Flag to determine which sketch processing method to use
    // This can be controlled by a query parameter or environment variable
    const useDirectSketchProcessing = req.query.directSketch === 'true' || process.env.USE_DIRECT_SKETCH === 'true';
    
    // If camera is provided, prefer Gemini edit path; include sketch as second image if present
    if (hasCamera) {
      // Gate by plan (DB-driven)
      const planKeyRes = await query('SELECT subscription_plan FROM users WHERE id = $1', [userId]);
      const planKey = planKeyRes.rows?.[0]?.subscription_plan || 'free';
      const allowCamRes = await query('SELECT allow_camera FROM plans WHERE key = $1', [planKey]);
      const allowCam = !!allowCamRes.rows?.[0]?.allow_camera;
      if (!allowCam) {
        return res.status(403).json({ error: 'Camera feature is not available on your plan' });
      }

      // Upload camera image to obtain a public URL
      const uploadedCam = await uploadSketch(cameraPng, null, userId);
      const camUrl = uploadedCam?.image_url;
      if (!camUrl) {
        return res.status(500).json({ error: 'Failed to upload camera image' });
      }

      const imageUrls = [camUrl];
      if (hasSketch && drawingPng) {
        // Upload sketch as well to obtain URL
        const uploadedSketch = await uploadSketch(drawingPng, drawingSvg || null, userId);
        if (uploadedSketch?.image_url) imageUrls.push(uploadedSketch.image_url);
      }

      // Use FAL Gemini Edit with system prompt configured server-side
      imageUrl = await generateImage(prompt, GENERATORS.FAL_GEMINI_EDIT, { imageUrls });
    } else if (hasSketch) {
      console.log('[Server] Processing sketch before image generation');
      
      // Extract base64 data from the data URL if needed
      const base64Image = drawingPng.startsWith('data:image/png;base64,') 
        ? drawingPng.split(',')[1] 
        : drawingPng;
      
      if (useDirectSketchProcessing) {
        // NEW METHOD: Use OpenAI image edit API directly with the sketch
        console.log('[Server] Using direct sketch processing with OpenAI Image Edit API');
        
        // Use the OpenAI Image Edit generator with the sketch data
        imageUrl = await generateImage(
          prompt, // Use original prompt
          GENERATORS.OPENAI_IMAGE_EDIT, // Use the new image edit generator
          { imageData: drawingPng } // Pass the full image data URL
        );
        
        console.log('[Server] Generated image directly from sketch');
      } else {
        // ORIGINAL METHOD: Process sketch with OpenAI Vision first, then generate image
        console.log('[Server] Using two-step sketch processing with OpenAI Vision');
        
        // Process sketch with OpenAI Vision directly using base64 data
        const generatedPrompt = await processSketchWithVision(base64Image, prompt);
        
        if (!generatedPrompt) {
          return res.status(500).json({ error: 'Failed to interpret sketch' });
        }
        
        // Use the generated prompt instead of the user's prompt
        finalPrompt = generatedPrompt;
        console.log('[Server] Using AI-generated prompt from sketch:', finalPrompt);
        
        // Generate image using the selected generator with the AI-generated prompt
        imageUrl = await generateImage(finalPrompt, model, size, quality);
      }
    } else {
      // No sketch/camera data, generate image normally with the provided prompt
      imageUrl = await generateImage(finalPrompt, model, size, quality);
    }

    // Generate a UUID that will be used for both Cloudinary and database
    const imageId = uuidv4();
    console.log('[Server] Generated image UUID:', imageId);
    
    // Upload to Cloudinary - pass the userId and imageId to ensure consistent IDs
    const image_url = await uploadImage(imageUrl, userId, imageId);
    
    // Don't add watermark during generation - only during download
    // Watermarked URL will be generated on-demand when user downloads
    const watermarked_url = null;

    // Store in database with additional metadata if sketch was used
    const metadata = { 
      model, 
      size, 
      quality,
      // Flag if the image was generated from a sketch
      ...(hasSketch && { fromSketch: true }),
      ...(hasCamera && { fromCamera: true })
    };
    
    // Determine if the image should be private based on DB plan flag and request
    let isPrivate = false;
    if (is_private) {
      const planKeyRes2 = await query('SELECT subscription_plan FROM users WHERE id = $1', [userId]);
      const planKey2 = planKeyRes2.rows?.[0]?.subscription_plan || 'free';
      const allowPrivRes = await query('SELECT allow_private_images FROM plans WHERE key = $1', [planKey2]);
      const allowPriv = !!allowPrivRes.rows?.[0]?.allow_private_images;
      if (allowPriv) {
        isPrivate = true;
        console.log(`[Server] Setting image as private for user ${userId} with plan ${planKey2}`);
      } else {
        console.log(`[Server] User ${userId} requested private image but plan ${planKey2} doesn't allow it`);
      }
    }
    
    const result = await query(
      'INSERT INTO images (id, user_id, image_url, watermarked_url, prompt, metadata, is_private) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [imageId, userId, image_url, watermarked_url, finalPrompt, metadata, isPrivate]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

// Get user history - user ID comes from JWT token
router.get('/history', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const userId = req.user.id; // Get user ID from JWT token

    // The requesting user's ID is the same as the user whose history we're fetching
    const requestingUserId = req.user.id;
    
    const result = await query(`
      WITH like_counts AS (
        SELECT 
          image_id,
          COUNT(*) as like_count
        FROM likes
        GROUP BY image_id
      ),
      user_likes AS (
        SELECT 
          image_id
        FROM likes
        WHERE user_id = '${requestingUserId}'
      )
      SELECT 
        images.id,
        images.image_url,
        images.prompt,
        images.created_at,
        images.metadata,
        images.watermarked_url,
        images.user_id,
        images.is_private,
        images.estimated_cost,
        COALESCE(like_counts.like_count, 0) as like_count,
        (images.id IN (SELECT image_id FROM user_likes)) as is_liked
      FROM images
      LEFT JOIN like_counts ON images.id = like_counts.image_id
      WHERE images.user_id = $1
      ORDER BY images.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    // Get total count for pagination
    const countResult = await query(
      'SELECT COUNT(*) as total FROM images WHERE user_id = $1',
      [userId]
    );

    res.json({
      images: result.rows,
      totalPages: Math.ceil(countResult.rows[0].total / limit),
      currentPage: page,
      total: countResult.rows[0].total
    });
  } catch (error) {
    console.error('Error fetching user history:', error);
    res.status(500).json({ error: 'Failed to fetch user history' });
  }
});

router.post('/download/:imageId', auth, async (req, res) => {
  try {
    const { imageId } = req.params;
    const { userId } = req.body;

    console.log('[Server] Processing download request:', { imageId, userId });

    // Get user's subscription plan
    const userResult = await query(
      'SELECT subscription_plan FROM users WHERE id = $1',
      [userId]
    );

    const userPlan = userResult.rows[0]?.subscription_plan || 'free';
    let needsWatermark = true;
    try {
      const wmRes = await query('SELECT show_watermark FROM plans WHERE key = $1', [userPlan]);
      needsWatermark = !!wmRes.rows?.[0]?.show_watermark;
    } catch {}

    // No need to verify ownership for downloads
    console.log('[Server] Processing download request for image');

    const result = await query(
      'SELECT * FROM images WHERE id = $1',
      [imageId]
    );

    if (result.rows.length === 0) {
      console.log('[Server] Image not found in database');
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const image = result.rows[0];
    console.log('[Server] Found image record:', image);

    // If user has Business plan, return original image
    if (!needsWatermark) {
      return res.json({
        watermarkedUrl: isDevelopment ? `/api/generate/uploads/${image.image_url}` : image.image_url
      });
    }

    // If watermarked version exists, return it
    if (image.watermarked_url) {
      console.log('[Server] Returning existing watermarked version:', image.watermarked_url);
      return res.json({
        watermarkedUrl: isDevelopment ? `/api/generate/uploads/${image.watermarked_url}` : image.watermarked_url
      });
    }

    // Create watermarked version
    const imageUrl = isDevelopment ? `/api/generate/uploads/${image.image_url}` : image.image_url;
    const watermarkedUrl = await addWatermark(imageUrl, userId);

    // Update database with watermarked URL
    await query(
      'UPDATE images SET watermarked_url = $1 WHERE id = $2',
      [watermarkedUrl, image.id]
    );

    return res.json({
      watermarkedUrl: isDevelopment ? `/api/generate/uploads/${watermarkedUrl}` : watermarkedUrl
    });
  } catch (error) {
    console.error('[Server] Download error:', error);
    res.status(500).json({ error: 'Failed to process download' });
  } 
});

// Estimate jewelry price
router.post('/estimate/:imageId', auth, async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user.id;
    
    // No need to verify ownership for price estimation
    console.log('[Server] Processing image for price estimation');

    // Check if we already have an estimation for this image
    const imageResult = await query(
      'SELECT estimated_cost, image_url, prompt FROM images WHERE id = $1',
      [imageId]
    );

    if (imageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const image = imageResult.rows[0];
    
    // Check if we should override existing price estimates - handle different formats of 'true'
    const clearPricesValue = process.env.CLEAR_PRICES;
    const clearPrices = clearPricesValue === 'true' || clearPricesValue === '1' || clearPricesValue === 'yes' || clearPricesValue === 'TRUE' || clearPricesValue === true;
    
    console.log('[Server] CLEAR_PRICES environment variable:', process.env.CLEAR_PRICES);
    console.log('[Server] CLEAR_PRICES type:', typeof process.env.CLEAR_PRICES);
    console.log('[Server] clearPrices value after parsing:', clearPrices);
    console.log('[Server] Existing estimated_cost:', image.estimated_cost);

    // Helper: validate "a,b,c,d" pattern (four integers separated by commas)
    const validFourCSV = (v) => typeof v === 'string' && /^\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*$/.test(v);

    // If we already have an estimation in desired format and don't need to clear it, return it
    if (image.estimated_cost && !clearPrices && validFourCSV(image.estimated_cost)) {
      console.log('[Server] Using existing price estimation (a,b,c,d)');
      return res.json({ estimatedCost: image.estimated_cost });
    }
    
    console.log('[Server] ' + (clearPrices ? 'Overriding existing price estimation' : 'Generating new price estimation'));

    // Get the image URL
    const imageUrl = isDevelopment ? 
      `${req.protocol}://${req.get('host')}/api/generate/uploads/${image.image_url}` : 
      image.image_url;

    // Process the image with OpenAI for estimation (returns comma-separated string)
    const csv = await processImageEstimation(imageUrl, image.prompt);

    // Persist into images.estimated_cost
    await query('UPDATE images SET estimated_cost = $1 WHERE id = $2', [csv, imageId]);
    return res.json({ estimatedCost: csv });
  } catch (error) {
    console.error('[Server] Estimation error:', error);
    res.status(500).json({ error: 'Failed to estimate jewelry price' });
  }
});

// Delete user history - user ID comes from JWT token
router.delete('/history/delete', auth, async (req, res) => {
  try {
    const userId = req.user.id; // Get user ID from JWT token
    console.log('[Server] Starting history cleanup for user:', userId);

    // Get files to delete
    const images = await query(
      'SELECT image_url, watermarked_url FROM images WHERE user_id = $1',
      [userId]
    );

    // Delete files
    for (const image of images.rows) {
      if (isDevelopment) {
        if (image.image_url) {
          await safeDeleteFile(path.join(UPLOADS_DIR, image.image_url));
        }
        if (image.watermarked_url) {
          await safeDeleteFile(path.join(UPLOADS_DIR, image.watermarked_url));
        }
      } else {
        // Delete from Cloudinary
        if (image.image_url) {
          // await deleteImage(image.image_url); // Skip
        }
        if (image.watermarked_url) {
          // await deleteImage(image.watermarked_url); // Skip
        }
      }
    }

    // Get image IDs before deleting them
    const imageIds = images.rows.map(img => img.id).filter(Boolean);
    
    // First delete likes associated with these images
    if (imageIds.length > 0) {
      console.log('[Server] Deleting likes for images:', imageIds.length);
      await query(
        'DELETE FROM likes WHERE image_id = ANY($1)',
        [imageIds]
      );
    }
    
    // Then delete the images themselves
    await query('DELETE FROM images WHERE user_id = $1', [userId]);

    // Clean up any orphaned files for this user
    if (isDevelopment) {
      await cleanupOrphanedFiles(userId);
    }

    res.json({ message: 'History cleared successfully' });
  } catch (error) {
    console.error('[Server] History clear error:', error);
    res.status(500).json({
      error: 'Failed to clear history: ' + error.message,
      details: error.stack
    });
  }
});

export { router };