import fetch from 'node-fetch';
import { settings } from '../config/apiSettings.js';

/**
 * Process a sketch with OpenAI Vision API to generate a text description
 * @param {string} base64Image - Base64 encoded image data
 * @param {string} userPrompt - Optional user prompt to guide the description
 * @returns {Promise<string>} - Generated text description of the jewelry
 */
export async function processSketchWithVision(base64Image, userPrompt = '') {
  try {
    const config = settings.imageGeneration.providers.openai_sketch;
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    // Clone the messages array to avoid modifying the original
    const messages = JSON.parse(JSON.stringify(config.params.messages));
    
    // Update the content of the USER message
    if (messages[1].content && Array.isArray(messages[1].content)) {
      // Find the text content item
      const textContentItem = messages[1].content.find(item => item.type === 'text');
      if (textContentItem) {
        // Add user prompt if provided
        textContentItem.text = userPrompt;
      }
      
      // Find the image content item
      const imageContentItem = messages[1].content.find(item => item.type === 'image_url');
      if (imageContentItem && imageContentItem.image_url) {
        // Use the base64 image directly
        // Make sure it has the correct data URL prefix
        const dataUrl = base64Image.startsWith('data:') 
          ? base64Image 
          : `data:image/png;base64,${base64Image}`;
          
        imageContentItem.image_url.url = dataUrl;
      }
    }
    
    console.log('[Server] Sending request to OpenAI Vision');
    
    const response = await fetch(config.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        ...config.params,
        messages
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Server] OpenAI Vision API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('[Server] Unexpected response format from OpenAI:', data);
      throw new Error('Invalid response from OpenAI');
    }
    
    const generatedText = data.choices[0].message.content.trim();
    console.log('[Server] Generated description:', generatedText);
    
    return generatedText;
  } catch (error) {
    console.error('[Server] Error processing sketch with OpenAI Vision:', error);
    throw error;
  }
}
