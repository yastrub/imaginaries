import fetch from 'node-fetch';
import { settings } from '../config/apiSettings.js';
import { getPrompt, getRoute, getFallbackDefault } from '../config/aiConfig.js';

/**
 * Process an image with OpenAI to estimate jewelry price
 * @param {string} imageUrl - URL of the image to process
 * @param {string} prompt - The prompt used to generate the image
 * @returns {Promise<string>} - Estimated price range
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

    // Override model from DB defaults if provided for 'estimate' purpose
    try {
      const route = await getRoute('estimate');
      if (route?.provider_key === 'openai' && route?.model_key) {
        params.model = route.model_key;
      }
    } catch {}
    
    // Replace the image URL placeholder
    params.messages[1].content[1].image_url.url = imageUrl;
    
    // Replace the user prompt placeholder with the actual prompt
    params.messages[1].content[0].text = prompt || '';
    
    // Make the API request (using DB-first prompt if available)
    try {
      const dbSystemPrompt = await getPrompt('system', 'openai_estimate');
      if (dbSystemPrompt && Array.isArray(params.messages) && params.messages.length > 0) {
        // Replace developer message content with DB prompt
        const idx = params.messages.findIndex((m) => m.role === 'developer');
        if (idx !== -1) {
          params.messages[idx] = { role: 'developer', content: dbSystemPrompt };
        }
      }
    } catch {}

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
    
    // Extract the price estimation from the response
    let estimatedCost = data.choices[0].message.content.trim();
    console.log('[Server] Raw estimated cost from OpenAI:', estimatedCost);
    
    // Use regex to extract price range in format $X,XXX - $Y,YYY
    const priceRangeRegex = /\$([0-9,]+)\s*-\s*\$([0-9,]+)/;
    const match = estimatedCost.match(priceRangeRegex);
    
    if (match) {
      // We found a price range, extract the numbers and format consistently
      const lowerPrice = match[1].replace(/,/g, '');
      const upperPrice = match[2].replace(/,/g, '');
      
      // Format with commas for thousands
      const formattedLower = Number(lowerPrice).toLocaleString('en-US');
      const formattedUpper = Number(upperPrice).toLocaleString('en-US');
      
      // Create a clean, consistent format
      estimatedCost = `$${formattedLower} - $${formattedUpper}`;
    } else {
      // Try to find any dollar amounts if the range format wasn't found
      const dollarAmountRegex = /\$([0-9,]+)/g;
      const amounts = [];
      let dollarMatch;
      
      while ((dollarMatch = dollarAmountRegex.exec(estimatedCost)) !== null) {
        amounts.push(dollarMatch[1].replace(/,/g, ''));
      }
      
      if (amounts.length >= 2) {
        // If we found at least two dollar amounts, use the first and last
        const formattedLower = Number(amounts[0]).toLocaleString('en-US');
        const formattedUpper = Number(amounts[amounts.length - 1]).toLocaleString('en-US');
        estimatedCost = `$${formattedLower} - $${formattedUpper}`;
      } else if (amounts.length === 1) {
        // If we only found one amount, create a range around it (±20%)
        const amount = Number(amounts[0]);
        const lowerBound = Math.floor(amount * 0.8);
        const upperBound = Math.ceil(amount * 1.2);
        
        const formattedLower = lowerBound.toLocaleString('en-US');
        const formattedUpper = upperBound.toLocaleString('en-US');
        estimatedCost = `$${formattedLower} - $${formattedUpper}`;
      } else {
        // No dollar amounts found
        console.log('[Server] Invalid price format, no dollar amounts found:', estimatedCost);
        estimatedCost = 'N/A';
      }
    }
    
    console.log('[Server] Estimated cost (formatted):', estimatedCost);
    
    return estimatedCost;
  } catch (error) {
    console.error('[Server] Error processing image for estimation:', error);
    throw error;
  }
}
