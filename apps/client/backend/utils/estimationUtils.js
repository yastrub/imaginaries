import fetch from 'node-fetch';
import { settings } from '../config/apiSettings.js';

/**
 * Process an image with OpenAI to estimate jewelry price
 * @param {string} imageUrl - URL of the image to process
 * @param {string} prompt - The prompt used to generate the image
 * @returns {Promise<string>} - Comma-separated four prices "a,b,c,d" (USD, integers)
 */
export async function processImageEstimation(imageUrl, prompt = '') {
  try {
    console.log('[Server] Processing image for price estimation:', imageUrl);
    
    // Get the OpenAI estimate settings
    const estimateSettings = settings.imageGeneration.providers.openai_estimate;
    
    // Prepare the API request
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }
    
    // Clone the params to avoid modifying the original
    const params = JSON.parse(JSON.stringify(estimateSettings.params));
    
    // Replace the image URL placeholder
    params.messages[1].content[1].image_url.url = imageUrl;
    
    // Replace the user prompt placeholder with the actual prompt
    params.messages[1].content[0].text = prompt || '';
    
    // Make the API request
    const response = await fetch(estimateSettings.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Server] OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();

    // Expect four comma-separated numbers, e.g. "120,180,950,2400"
    const raw = String(data?.choices?.[0]?.message?.content || '').trim();
    console.log('[Server] Raw estimated prices from OpenAI:', raw);

    // Sanitize and parse numbers
    const cleaned = raw
      .replace(/\$|USD|usd|\s/g, '')
      .replace(/,+/g, ',')
      .replace(/;+/g, ',')
      .replace(/\|/g, ',');

    const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);
    const nums = parts.map(p => {
      const n = Number(p.replace(/[^0-9.]/g, ''));
      return Number.isFinite(n) ? Math.round(n) : NaN;
    }).filter(n => Number.isFinite(n));

    if (nums.length >= 4) {
      const prices = nums.slice(0, 4);
      const text = prices.join(',');
      console.log('[Server] Parsed estimated prices:', text);
      return text;
    }

    // Backward compatibility fallback: derive a single price and expand to four heuristically
    const fallbackRegex = /\$?([0-9][0-9,\.]+)/g;
    const found = [];
    let m;
    while ((m = fallbackRegex.exec(raw)) && found.length < 1) {
      const n = Number(String(m[1]).replace(/,/g, ''));
      if (Number.isFinite(n)) found.push(Math.round(n));
    }
    if (found.length) {
      const base = found[0];
      const prices = [Math.round(base * 0.5), Math.round(base * 0.7), Math.round(base), Math.round(base * 1.6)];
      const text = prices.join(',');
      console.log('[Server] Fallback estimated prices:', text);
      return text;
    }

    // No parse possible
    throw new Error('Failed to parse price estimation response');
  } catch (error) {
    console.error('[Server] Error processing image for estimation:', error);
    throw error;
  }
}
