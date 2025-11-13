import express from 'express';
import { uploadDataUrlToCloudinary, uploadUrlToCloudinary, listResourcesByPrefix, deleteImage } from '../config/cloudinary.js';
import { generateImage, GENERATORS } from '../config/imageGenerators.js';
import { buildMerchPrompt } from '../config/merchPresets.js';

const router = express.Router();

// POST /api/merch/generate
// Body: { selfieDataUrl: string (data URL), logoDataUrl?: string (data URL), preset?: string brand?: 'ARTIFICIAL'|'TECHTUESDAYS' }
router.post('/generate', async (req, res) => {
  try {
    const { selfieDataUrl, logoDataUrl, preset = 'GTA', brand = 'ARTIFICIAL' } = req.body || {};
    if (!selfieDataUrl) {
      return res.status(400).json({ error: 'Missing selfieDataUrl' });
    }

    const folderBase = String(brand).toUpperCase() === 'TECHTUESDAYS' ? 'techtuesdays/events/71' : 'artificial/events/01';
    const ts = Date.now();

    // Do NOT persist selfie/logo. Use data URLs directly for generation.
    // For TECHTUESDAYS we rely on prompt title and ignore client logo
    const useLogo = !!logoDataUrl && String(brand).toUpperCase() !== 'TECHTUESDAYS';
    const imageUrls = useLogo ? [selfieDataUrl, logoDataUrl] : [selfieDataUrl];
    const prompt = buildMerchPrompt(preset, String(brand || 'ARTIFICIAL'));

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
    const brand = (req.query?.brand || 'ARTIFICIAL').toString().toUpperCase();
    const folderBase = brand === 'TECHTUESDAYS' ? 'techtuesdays/events/71' : 'artificial/events/01';
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

// POST /api/merch/delete -> delete a merch image by URL
router.post('/delete', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing url' });
    }
    // Optional: ensure it's under expected folder
    try {
      const ok = await deleteImage(url);
      return res.json({ ok: !!ok });
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'Failed to delete image' });
    }
  } catch (error) {
    console.error('[Merch] Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete' });
  }
});
