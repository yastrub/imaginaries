import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

const router = express.Router();

/**
 * Combined endpoint that returns either user history or public images
 * based on JWT cookie validation
 */
router.get('/recent', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * parseInt(limit);
    const parsedLimit = parseInt(limit);
    
    // Extract user ID from JWT cookie
    let userId = null;
    let isAuthenticated = false;
    let user = null;
    
    // Try to get token from cookies
    if (req.cookies && req.cookies.token) {
      try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        userId = decoded.userId;
        isAuthenticated = true;
        console.log('[Server] Authenticated user accessing recent images:', userId);
        
        // Get user data for authenticated users
        const userResult = await query(
          'SELECT id, email, email_confirmed, subscription_plan, created_at FROM users WHERE id = $1',
          [userId]
        );
        
        if (userResult.rows.length > 0) {
          user = userResult.rows[0];
        } else {
          // User ID from token doesn't exist in database
          // This is an authentication error - token refers to non-existent user
          return res.status(401).json({
            error: 'AUTH_ERROR',
            message: 'User not found',
            authError: true
          });
        }
      } catch (error) {
        console.log('[Server] Invalid cookie token in recent images request:', error.message);
        // Return authentication error with 401 status
        return res.status(401).json({
          error: 'AUTH_ERROR',
          message: 'Invalid authentication token',
          authError: true
        });
      }
    }
    
    let images = [];
    let totalCount = 0;
    
    // Check if history=true parameter is present (new approach)
    const showHistory = req.query.history === 'true';
    console.log('[Server] Request params:', { userId, isAuthenticated, showHistory });
    
    // If authenticated AND explicitly requesting history, return user's history
    if (isAuthenticated && userId && showHistory) {
      console.log('[Server] Returning user history for user:', userId);
      // Get user's images
      const imagesQuery = `
        WITH like_counts AS (
          SELECT 
            image_id,
            COUNT(*) as like_count
          FROM likes
          GROUP BY image_id
        )
        SELECT 
          i.id,
          i.user_id,
          i.prompt,
          i.image_url,
          i.watermarked_url,
          i.metadata,
          i.is_private,
          i.created_at,
          COALESCE(lc.like_count, 0) as like_count,
          EXISTS(SELECT 1 FROM likes WHERE image_id = i.id AND user_id = $1) as is_liked
        FROM images i
        LEFT JOIN like_counts lc ON i.id = lc.image_id
        WHERE i.user_id = $1
        ORDER BY i.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const countQuery = `
        SELECT COUNT(*) as total
        FROM images
        WHERE user_id = $1
      `;
      
      // Execute both queries
      const [imagesResult, countResult] = await Promise.all([
        query(imagesQuery, [userId, parsedLimit, offset]),
        query(countQuery, [userId])
      ]);
      
      images = imagesResult.rows;
      totalCount = parseInt(countResult.rows[0].total);
    } else {
      // DEFAULT BEHAVIOR: Show public gallery images
      // This happens when either:
      // 1. User is not authenticated, OR
      // 2. User is authenticated but not explicitly requesting history
      // Create different queries for authenticated and non-authenticated users
      let publicImagesQuery;
      
      if (userId) {
        // Query for authenticated users - can see their own prompts and dates
        publicImagesQuery = `
          WITH like_counts AS (
            SELECT 
              image_id,
              COUNT(*) as like_count
            FROM likes
            GROUP BY image_id
          )
          SELECT 
            i.id,
            i.user_id,
            CASE WHEN i.user_id = $1 THEN i.prompt ELSE NULL END as prompt, -- Only include prompt for user's own images
            i.image_url,
            i.watermarked_url,
            i.metadata,
            i.is_private,
            CASE WHEN i.user_id = $1 THEN i.created_at ELSE NULL END as created_at, -- Only include dates for user's own images
            COALESCE(lc.like_count, 0) as like_count,
            EXISTS(SELECT 1 FROM likes WHERE image_id = i.id AND user_id = $1) as is_liked
          FROM images i
          LEFT JOIN like_counts lc ON i.id = lc.image_id
          WHERE i.is_private = false
          ORDER BY i.created_at DESC
          LIMIT $2 OFFSET $3
        `;
      } else {
        // Query for non-authenticated users - no prompts or dates
        publicImagesQuery = `
          WITH like_counts AS (
            SELECT 
              image_id,
              COUNT(*) as like_count
            FROM likes
            GROUP BY image_id
          )
          SELECT 
            i.id,
            i.user_id,
            NULL as prompt, -- No prompts for public gallery
            i.image_url,
            i.watermarked_url,
            i.metadata,
            i.is_private,
            NULL as created_at, -- No dates for public gallery
            COALESCE(lc.like_count, 0) as like_count,
            false as is_liked
          FROM images i
          LEFT JOIN like_counts lc ON i.id = lc.image_id
          WHERE i.is_private = false
          ORDER BY i.created_at DESC
          LIMIT $1 OFFSET $2
        `;
      }
      
      const publicCountQuery = `
        SELECT COUNT(*) as total
        FROM images
        WHERE is_private = false
      `;
      
      // Execute both queries with or without userId parameter
      const [imagesResult, countResult] = await Promise.all([
        userId 
          ? query(publicImagesQuery, [userId, parsedLimit, offset])
          : query(publicImagesQuery, [parsedLimit, offset]),
        query(publicCountQuery)
      ]);
      
      images = imagesResult.rows;
      totalCount = parseInt(countResult.rows[0].total);
    }
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parsedLimit);
    const hasMore = page < totalPages;
    
    // Return the response without user object
    return res.json({
      isAuthenticated,
      userId,
      // No longer sending user object from non-auth endpoints
      images,
      totalCount,
      totalPages,
      hasMore,
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('[Server] Error fetching recent images:', error);
    return res.status(500).json({ error: 'Failed to fetch images' });
  }
});

/**
 * Endpoint to get top liked images
 */
router.get('/top', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * parseInt(limit);
    const parsedLimit = parseInt(limit);
    
    // Extract user ID from JWT cookie
    let userId = null;
    let isAuthenticated = false;
    let user = null;
    
    // Try to get token from cookies
    if (req.cookies && req.cookies.token) {
      try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        userId = decoded.userId;
        isAuthenticated = true;
        console.log('[Server] Authenticated user accessing top liked images:', userId);
        
        // Get user data for authenticated users
        const userResult = await query(
          'SELECT id, email, email_confirmed, subscription_plan, created_at FROM users WHERE id = $1',
          [userId]
        );
        
        if (userResult.rows.length > 0) {
          user = userResult.rows[0];
        } else {
          // User ID from token doesn't exist in database
          return res.status(401).json({
            error: 'AUTH_ERROR',
            message: 'User not found',
            authError: true
          });
        }
      } catch (error) {
        console.log('[Server] Invalid cookie token in top liked images request:', error.message);
        // Return authentication error with 401 status
        return res.status(401).json({
          error: 'AUTH_ERROR',
          message: 'Invalid authentication token',
          authError: true
        });
      }
    }
    
    // Query to get top liked images - different versions for authenticated and non-authenticated users
    let topLikedImagesQuery;
    
    if (userId) {
      // Query for authenticated users - can see their own prompts and dates
      topLikedImagesQuery = `
        WITH like_counts AS (
          SELECT 
            image_id,
            COUNT(*) as like_count
          FROM likes
          GROUP BY image_id
        )
        SELECT 
          i.id,
          i.user_id,
          CASE WHEN i.user_id = $1 THEN i.prompt ELSE NULL END as prompt, -- Only include prompt for user's own images
          i.image_url,
          i.watermarked_url,
          i.metadata,
          i.is_private,
          CASE WHEN i.user_id = $1 THEN i.created_at ELSE NULL END as created_at, -- Only include dates for user's own images
          COALESCE(lc.like_count, 0) as like_count,
          EXISTS(SELECT 1 FROM likes WHERE image_id = i.id AND user_id = $1) as is_liked
        FROM images i
        LEFT JOIN like_counts lc ON i.id = lc.image_id
        WHERE i.is_private = false
        ORDER BY like_count DESC, i.created_at DESC
        LIMIT $2 OFFSET $3
      `;
    } else {
      // Query for non-authenticated users - no prompts or dates
      topLikedImagesQuery = `
        WITH like_counts AS (
          SELECT 
            image_id,
            COUNT(*) as like_count
          FROM likes
          GROUP BY image_id
        )
        SELECT 
          i.id,
          i.user_id,
          NULL as prompt, -- No prompts for public gallery
          i.image_url,
          i.watermarked_url,
          i.metadata,
          i.is_private,
          NULL as created_at, -- No dates for public gallery
          COALESCE(lc.like_count, 0) as like_count,
          false as is_liked
        FROM images i
        LEFT JOIN like_counts lc ON i.id = lc.image_id
        WHERE i.is_private = false
        ORDER BY like_count DESC, i.created_at DESC
        LIMIT $1 OFFSET $2
      `;
    }
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM images
      WHERE is_private = false
    `;
    
    // Execute both queries with or without userId parameter
    const [imagesResult, countResult] = await Promise.all([
      userId 
        ? query(topLikedImagesQuery, [userId, parsedLimit, offset])
        : query(topLikedImagesQuery, [parsedLimit, offset]),
      query(countQuery)
    ]);
    
    const images = imagesResult.rows;
    const totalCount = parseInt(countResult.rows[0].total);
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parsedLimit);
    const hasMore = page < totalPages;
    
    // Return the response
    return res.json({
      isAuthenticated,
      userId,
      images,
      totalCount,
      totalPages,
      hasMore,
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('[Server] Error fetching top liked images:', error);
    return res.status(500).json({ error: 'Failed to fetch top liked images' });
  }
});

export { router as imagesRouter };
