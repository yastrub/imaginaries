import express from 'express';
import { uploadDataUrlToCloudinary, uploadUrlToCloudinary, listResourcesByPrefix } from '../config/cloudinary.js';
import { generateImage, GENERATORS } from '../config/imageGenerators.js';
import { buildMerchPrompt } from '../config/merchPresets.js';

const router = express.Router();

// POST /api/merch/generate
// Body: { selfieDataUrl: string (data URL), logoDataUrl?: string (data URL), preset?: string, keepPoses?: boolean }
router.post('/generate', async (req, res) => {
  try {
    const { selfieDataUrl, logoDataUrl, preset = 'GTA', keepPoses = true } = req.body || {};
    if (!selfieDataUrl) {
      return res.status(400).json({ error: 'Missing selfieDataUrl' });
    }

    const folderBase = 'artificial/events/01';
    const ts = Date.now();

    // Do NOT persist selfie/logo. Use data URLs directly for generation.
    const imageUrls = logoDataUrl ? [selfieDataUrl, logoDataUrl] : [selfieDataUrl];
    const prompt = buildMerchPrompt(preset, !!keepPoses);

    // Generate with FAL Gemini Collage (png, 3:4) using both images
    const generatedUrl = await generateImage(prompt, GENERATORS.FAL_GEMINI_COLLAGE, { imageUrls });

    // Store result into Cloudinary folder artificial/events/01/<timestamp>.png
    const storedUrl = await uploadUrlToCloudinary(folderBase, `magazine-${ts}`, generatedUrl);

    return res.json({ url: storedUrl });
  } catch (error) {
    console.error('[Merch] Generate error:', error);
    return res.status(500).json({ error: 'Failed to generate magazine' });
  }
});

// GET /api/merch/list -> latest magazines list
router.get('/list', async (req, res) => {
  try {
    const folderBase = 'artificial/events/01';
    const items = await listResourcesByPrefix(folderBase, 100);
    // Sort by created_at desc if available
    const sorted = items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.json({ items: sorted });
  } catch (error) {
    console.error('[Merch] List error:', error);
    return res.status(500).json({ error: 'Failed to list magazines' });
  }
});

export { router as merchRouter };
