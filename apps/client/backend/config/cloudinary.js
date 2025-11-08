import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import * as devDB from './dev.js';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const isDevelopment = process.env.NODE_ENV === 'development';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Helper function to get folder name based on environment
const getFolder = (userId) => {
  return `${userId}`;
};

// Upload image to Cloudinary or local storage
export async function uploadImage(imageUrl, userId, imageId = null) {
  if (isDevelopment) {
    return devDB.uploadImage(imageUrl, userId, imageId);
  }
  try {
    const folder = getFolder(userId);
    if (!imageId) {
      imageId = uuidv4();
    }
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder,
      public_id: imageId,
      transformation: [
        { quality: 'auto:best' },
        { fetch_format: 'auto' },
        { format: 'png' }
      ],
      resource_type: 'image'
    });
    console.log('Cloudinary upload successful:', {
      publicId: result.public_id,
      url: result.secure_url,
      format: result.format,
      size: result.bytes
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
}

// Upload a base64 data URL directly to a specific Cloudinary folder with optional public_id
export async function uploadDataUrlToCloudinary(folder, publicId, dataUrl) {
  if (isDevelopment) {
    try {
      // Reuse dev uploadSketch path for simplicity
      const result = await devDB.uploadSketch(dataUrl, null, folder || 'dev');
      return result?.image_url || dataUrl;
    } catch (e) {
      return dataUrl;
    }
  }
  try {
    const result = await cloudinary.uploader.upload(dataUrl, {
      folder,
      public_id: publicId || undefined,
      transformation: [
        { quality: 'auto:best' },
        { fetch_format: 'auto' },
        { format: 'png' }
      ],
      resource_type: 'image'
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary uploadDataUrlToCloudinary error:', error);
    throw new Error('Failed to upload image');
  }
}

// Upload an external URL to a specific Cloudinary folder with optional public_id
export async function uploadUrlToCloudinary(folder, publicId, url) {
  if (isDevelopment) {
    // In dev, just return the original URL
    return url;
  }
  try {
    const result = await cloudinary.uploader.upload(url, {
      folder,
      public_id: publicId || undefined,
      transformation: [
        { quality: 'auto:best' },
        { fetch_format: 'auto' },
        { format: 'png' }
      ],
      resource_type: 'image'
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary uploadUrlToCloudinary error:', error);
    throw new Error('Failed to upload image');
  }
}

// List Cloudinary resources by prefix (folder path)
export async function listResourcesByPrefix(prefix, max = 50) {
  if (isDevelopment) {
    // No listing in dev; return empty list
    return [];
  }
  try {
    const res = await cloudinary.api.resources({
      type: 'upload',
      prefix,
      max_results: max,
      direction: 'desc'
    });
    return (res.resources || []).map(r => ({
      public_id: r.public_id,
      url: r.secure_url,
      created_at: r.created_at
    }));
  } catch (error) {
    console.error('Cloudinary listResourcesByPrefix error:', error);
    return [];
  }
}

// Add watermark to image
export async function addWatermark(imageUrl, userId) {
  if (isDevelopment) {
    return devDB.addWatermark(imageUrl, userId);
  }

  try {
    const folder = getFolder(userId);
    
    // Add watermark using Cloudinary transformations
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: `${folder}/watermarked`,
      transformation: [
        { quality: 'auto:best' },
        { fetch_format: 'auto' },
        { format: 'png' },
        {
          overlay: {
            font_family: "Arial",
            font_size: 100,
            text: "© IMAGINARIES"
          },
          color: "#FFFFFF",
          opacity: 50,
          y: 20,
          x: 20
        }
      ],
      resource_type: 'image',
      unique_filename: true
    });

    console.log('Cloudinary watermark successful:', {
      publicId: result.public_id,
      url: result.secure_url
    });

    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary watermark error:', error);
    throw new Error('Failed to add watermark');
  }
}

// Delete image from storage
export async function deleteImage(imageUrl) {
  if (isDevelopment) {
    // No-op in development; treat as success
    return true;
  }

  try {
    // Extract public_id from Cloudinary URL, stripping transformations and version
    // Examples:
    // https://res.cloudinary.com/<cloud>/image/upload/v1699999999/folder/name.png
    // https://res.cloudinary.com/<cloud>/image/upload/q_auto:best,f_auto/v169.../folder/name.png
    // We want: folder/name
    const url = new URL(imageUrl);
    const path = url.pathname; // e.g., /<cloud>/image/upload/v123/folder/name.png
    const uploadIndex = path.indexOf('/upload/');
    if (uploadIndex === -1) throw new Error('Invalid Cloudinary URL');
    let after = path.substring(uploadIndex + '/upload/'.length); // may contain transforms + version + public_id.ext
    // If there's a version segment like v12345/, cut everything before and including it
    const verMatch = after.match(/v\d+\//);
    if (verMatch) {
      after = after.substring(after.indexOf(verMatch[0]) + verMatch[0].length);
    } else {
      // If no version, strip any leading transformation segments (contain commas or colons)
      const parts = after.split('/');
      while (parts.length && (parts[0].includes(':') || parts[0].includes(','))) parts.shift();
      after = parts.join('/');
    }
    // Remove file extension
    const dot = after.lastIndexOf('.');
    const publicId = dot > 0 ? after.substring(0, dot) : after;
    if (!publicId || publicId.includes('..') || publicId.startsWith('/')) {
      throw new Error('Invalid Cloudinary public_id');
    }

    const result = await cloudinary.uploader.destroy(publicId);
    
    console.log('Cloudinary delete successful:', {
      publicId,
      result: result.result
    });

    return result.result === 'ok' || result.result === 'not found';
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete image from Cloudinary');
  }
}

// Clean up all images for a user
export async function cleanupUserImages(userId) {
  if (isDevelopment) {
    return devDB.cleanupUserImages(userId);
  }

  try {
    const folder = getFolder(userId);
    
    // Delete all images in user's folder
    const result = await cloudinary.api.delete_resources_by_prefix(folder);
    
    // Delete the empty folders
    await cloudinary.api.delete_folder(folder);
    await cloudinary.api.delete_folder(`${folder}/watermarked`);

    console.log('Cloudinary cleanup successful:', {
      userId,
      deletedCount: result.deleted ? Object.keys(result.deleted).length : 0
    });

    return true;
  } catch (error) {
    console.error('Cloudinary cleanup error:', error);
    throw new Error('Failed to cleanup user images');
  }
}

// Upload sketch to Cloudinary or local storage
export async function uploadSketch(pngDataUrl, svgData, userId) {
  if (isDevelopment) {
    return devDB.uploadSketch(pngDataUrl, svgData, userId);
  }

  try {
    const folder = getFolder(userId, 'sketches');
    const sketchId = uuidv4(); // Generate UUID first
    
    // Upload PNG to Cloudinary
    const result = await cloudinary.uploader.upload(pngDataUrl, {
      folder,
      public_id: sketchId, // Use UUID as public_id
      transformation: [
        { quality: 'auto:best' },
        { fetch_format: 'auto' },
        { format: 'png' }
      ],
      resource_type: 'image'
    });

    console.log('Cloudinary sketch upload successful:', {
      publicId: result.public_id,
      url: result.secure_url,
      format: result.format,
      size: result.bytes
    });

    return {
      id: sketchId,
      image_url: result.secure_url,
      svgData: svgData
    };
  } catch (error) {
    console.error('Cloudinary sketch upload error:', error);
    throw new Error('Failed to upload sketch to Cloudinary');
  }
}

// Verify Cloudinary configuration
export async function verifyCloudinaryConfig() {
  if (isDevelopment) {
    console.log('Skipping Cloudinary verification in development mode');
    return true;
  }

  try {
    const result = await cloudinary.api.ping();
    console.log('Cloudinary configuration verified:', result);
    return true;
  } catch (error) {
    console.error('Cloudinary configuration error:', error);
    return false;
  }
}
