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

    // Upload selfie to Cloudinary to obtain a public URL
    const selfieUrl = await uploadDataUrlToCloudinary(`${folderBase}/inputs`, `selfie-${ts}`, selfieDataUrl);

    // Upload logo to Cloudinary; require logoDataUrl from client for reliability (local servers are not public)
    let finalLogoUrl = null;
    if (logoDataUrl) {
      finalLogoUrl = await uploadDataUrlToCloudinary(`${folderBase}/assets`, `logo`, logoDataUrl);
    } else {
      // As a fallback, proceed without logo; collage will still run with single image
      finalLogoUrl = null;
    }

    const imageUrls = finalLogoUrl ? [selfieUrl, finalLogoUrl] : [selfieUrl];
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
    return res.json({ items: sorted });
  } catch (error) {
    console.error('[Merch] List error:', error);
    return res.status(500).json({ error: 'Failed to list magazines' });
  }
});

export { router as merchRouter };
