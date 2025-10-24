import dotenv from 'dotenv';
import { settings } from './apiSettings.js';
import fetch from 'node-fetch';
import FormData from 'form-data';

dotenv.config();

// Generator types
export const GENERATORS = {
  OPENAI: 'openai',
  OPENAI_DALLE: 'openai_dalle',
  OPENAI_IMAGE_EDIT: 'openai_image_edit',
  REPLICATE: 'replicate',
  FAL: 'fal'
};

// Get default generator from settings
export const DEFAULT_GENERATOR = settings.imageGeneration.defaultProvider;

// Base prompt enhancement
const enhancePrompt = (prompt) => 
  `High quality jewelry: ${prompt}. Professional photo, high detailed, ultra realistic, WHITE PLAIN background, high resolution, close up. Only jewelry piece in a scene, nothing else, isolated.`;

// OpenAI Generator
async function generateWithOpenAI(prompt) {
  if (!settings.imageGeneration.enabledProviders.openai) {
    throw new Error('OpenAI generator is disabled');
  }

  const config = settings.imageGeneration.providers.openai;

  const apiUrl = config.api_url;
  const apiKey = process.env.OPENAI_API_KEY;

  // Step 1: Send request to OpenAI API
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: enhancePrompt(prompt),
      ...config.params,
    }),
  });

  const responseText = await response.text();
  console.log('OpenAI Response:', responseText);

  if (!response.ok) {
    let error;
    try {
      error = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`OpenAI API error: Invalid JSON - ${responseText}`);
    }
    throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
  }

  let result;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`OpenAI: Failed to parse response - ${responseText}`);
  }

  // Step 2: Extract the first image URL
  const image = result.data?.[0];
  if (!image?.url) {
    throw new Error('OpenAI: No image URL in response');
  }

  console.log('OpenAI Result:', result);

  return image.url;
}

// Replicate Generator using fetch
async function generateWithReplicate(prompt) {
  if (!settings.imageGeneration.enabledProviders.replicate) {
    throw new Error('Replicate generator is disabled');
  }

  const config = settings.imageGeneration.providers.replicate;
  
  // Make prediction request with wait preference
  // Check if Prefer is WAIT, wait for response and result
  const response = await fetch(`${config.api_url}/${config.model}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait'
    },
    body: JSON.stringify({
      input: {
        prompt: enhancePrompt(prompt),
        ...config.params
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Replicate API error: ${error.detail || 'Unknown error'}`);
  }

  const result = await response.json();
  
  if (result.error) {
    throw new Error(`Replicate Generation failed: ${result.error}`);
  }

  if (!result.output) {
    throw new Error('Replicate: No output URL in response');
  }

  return result.output;
}

// Fal.ai Generator using fetch
async function generateWithFal(prompt) {
  if (!settings.imageGeneration.enabledProviders.fal) {
    throw new Error('Fal.ai generator is disabled');
  }

  const config = settings.imageGeneration.providers.fal;
  const falApiUrl = `${config.api_url}/${config.model}`;
  const falApiUrlFull = `${config.api_url}/${config.model}/${config.version}`; // Fal has versions
  const falKey = process.env.FAL_KEY;
  
  // Step 1: Send initial request to get request_id (full URL with version)
  const initialResponse = await fetch(falApiUrlFull, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: enhancePrompt(prompt),
      ...config.params,
    }),
  });

  const initialText = await initialResponse.text(); // Get raw text first
  console.log('Fal Initial Response:', initialText);

  if (!initialResponse.ok) {
    let error;
    try {
      error = JSON.parse(initialText);
    } catch (e) {
      throw new Error(`Fal API error: Invalid JSON - ${initialText}`);
    }
    throw new Error(`Fal API error: ${error.detail || 'Fal: Unknown error'}`);
  }

  let initialResult;
  try {
    initialResult = JSON.parse(initialText);
  } catch (e) {
    throw new Error(`Fal: Failed to parse initial response - ${initialText}`);
  }

  const requestId = initialResult.request_id;
  if (!requestId) {
    throw new Error('Fal: No request_id in response');
  }

  // Step 2: Poll status
  const statusUrl = `${falApiUrl}/requests/${requestId}/status`;
  const maxAttempts = 10;
  const interval = 15; // Seconds
  let attempts = 0;

  const pollStatus = async () => {
    while (attempts < maxAttempts) {
      const statusResponse = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Key ${falKey}`,
        },
      });

      const statusText = await statusResponse.text();
      console.log(`Fal Status URL:`, statusUrl);
      console.log(`Status Response (attempt ${attempts + 1}):`, statusText);

      if (!statusResponse.ok) {
        let error;
        try {
          error = JSON.parse(statusText);
        } catch (e) {
          throw new Error(`Fal status check failed: Invalid JSON - ${statusText}`);
        }
        throw new Error(`Fal status check failed: ${error.detail || 'Unknown error'}`);
      }

      let statusData;
      try {
        statusData = JSON.parse(statusText);
      } catch (e) {
        throw new Error(`Fal: Failed to parse status response - ${statusText}`);
      }

      const status = statusData.status;
      if (status === 'COMPLETED') { // Use uppercase here
        return; // Exit the function entirely
      } else if (status === 'failed' || status === 'error') {
        throw new Error(`Fal request failed with status: ${status}`);
      }

      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
      attempts++;
    }
    throw new Error('Fal request timed out after 2 minutes');
  };

  await pollStatus();

  // Step 3: Fetch final result
  const resultUrl = `${falApiUrl}/requests/${requestId}`;
  const resultResponse = await fetch(resultUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Key ${falKey}`,
    },
  });

  const resultText = await resultResponse.text();
  console.log('Result Response:', resultText);

  if (!resultResponse.ok) {
    let error;
    try {
      error = JSON.parse(resultText);
    } catch (e) {
      throw new Error(`Fal result fetch failed: Invalid JSON - ${resultText}`);
    }
    throw new Error(`Fal result fetch failed: ${error.detail || 'Fal: Unknown error'}`);
  }

  let result;
  try {
    result = JSON.parse(resultText);
  } catch (e) {
    throw new Error(`Fal: Failed to parse result response - ${resultText}`);
  }

  if (result.error) {
    throw new Error(`Fal generation failed: ${result.error}`);
  }

  const image = result.images?.[0];
  if (!image?.url) {
    throw new Error('Fal: No image URL in response');
  }

  console.log(config.params);
  console.log(result);

  return image.url;
  
}

// Main generator function
// OpenAI Image Edit Generator - for direct sketch to image
async function generateWithOpenAIImageEdit(prompt, imageData) {
  if (!settings.imageGeneration.enabledProviders.openai) {
    throw new Error('OpenAI image edit generator is disabled');
  }

  const config = settings.imageGeneration.providers.openai_image_edit;
  const apiUrl = config.api_url;
  const apiKey = process.env.OPENAI_API_KEY;
  
  // Combine system prompt with user prompt
  const systemPrompt = config.system_prompt || '';
  const enhancedPrompt = enhancePrompt(prompt);
  const fullPrompt = systemPrompt ? `${systemPrompt}

User request: ${enhancedPrompt}` : enhancedPrompt;
  
  try {
    // Create a form data object for the multipart request
    const formData = new FormData();
    
    // Add the model parameter
    formData.append('model', config.params.model);
    
    // Add the prompt parameter
    formData.append('prompt', fullPrompt);
    
    // Process the image data - convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Add the image parameter - using the correct format based on the curl example
    // Note: the API expects 'image' not 'image[]'
    formData.append('image', imageBuffer, {
      filename: 'sketch.png',
      contentType: 'image/png'
    });
    
    // Add other parameters if provided
    if (config.params.size) formData.append('size', config.params.size);
    if (config.params.quality) formData.append('quality', config.params.quality);
    
    console.log('Sending sketch to OpenAI Image Edit API');
    
    // Get the headers from the form data
    const headers = formData.getHeaders();
    
    // Make the request using fetch
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...headers  // This includes the Content-Type with boundary
      },
      body: formData
    });
    
    // Parse the response
    const result = await response.json();
    
    // Log only that we received a response, not the content
    console.log('Received response from OpenAI Image Edit API');
    
    if (!response.ok) {
      throw new Error(result.error?.message || 'Unknown error');
    }
    
    // Extract the base64 image data from the response
    const b64Json = result.data?.[0]?.b64_json;
    if (!b64Json) {
      throw new Error('No base64 image data in response');
    }
    
    // Convert base64 to data URL for the application
    const dataUrl = `data:image/png;base64,${b64Json}`;
    console.log('Successfully generated image from sketch');
    
    return dataUrl;
  } catch (error) {
    console.error('OpenAI Image Edit error:', error);
    throw new Error(`OpenAI Image Edit API error: ${error.message}`);
  }
}

export async function generateImage(prompt, generator = DEFAULT_GENERATOR, options = {}) {
  console.log(`Generating image using ${generator}`);

  try {
    switch (generator) {
      case GENERATORS.OPENAI:
        return await generateWithOpenAI(prompt);
      case GENERATORS.OPENAI_DALLE:
        return await generateWithOpenAI(prompt);
      case GENERATORS.OPENAI_IMAGE_EDIT:
        if (!options.imageData) {
          throw new Error('Image data is required for OpenAI Image Edit generator');
        }
        return await generateWithOpenAIImageEdit(prompt, options.imageData);
      case GENERATORS.REPLICATE:
        return await generateWithReplicate(prompt);
      case GENERATORS.FAL:
        return await generateWithFal(prompt);
      default:
        throw new Error(`Unknown generator: ${generator}`);
    }
  } catch (error) {
    console.error(`Error generating image with ${generator}:`, error);
    throw error;
  }
}