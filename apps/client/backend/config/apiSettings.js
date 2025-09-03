import dotenv from 'dotenv';

dotenv.config();

export const settings = {
  // Image generation settings
  imageGeneration: {
    // Default provider: 'openai', 'replicate', or 'fal'
    defaultProvider: process.env.DEFAULT_GENERATOR || 'openai',
    
    // Enable/disable specific providers
    enabledProviders: {
      openai: true,
      replicate: true,
      fal: true
    },
    
    // Provider-specific settings
    providers: {
      openai: {
        api_url: 'https://api.openai.com/v1/images/generations',
        params: {
          model: 'dall-e-3', // dall-e-3, gpt-4o, gpt-image-1
          size: '1024x1024',
          quality: 'hd',
          style: 'natural'
        }
      },
      openai_image: {
        api_url: 'https://api.openai.com/v1/images/generations',
        params: {
          model: 'gpt-image-1', // dall-e-3, gpt-image-1
          size: '1024x1024',
          quality: 'high'
        }
      },
      openai_image_edit: {
        api_url: 'https://api.openai.com/v1/images/edits',
        params: {
          model: 'gpt-image-1',
          size: '1024x1024',
          quality: 'high'
        },
        // System prompt to guide the AI in interpreting the sketch as jewelry
        system_prompt: 'You are the professional jewelry sketch reader. Your mission is to view uploaded sketch file, interpret it and generate a photorealistic high quality image of the jewelry on a white background. You must try to identify jewelry type, shape, curves, style, materials, stones from the sketch if no additional information is provided in user prompt. We work only with 18k gold (white, rose, yellow) and natural stones (Diamonds, Rubies, Blue Sapphires, Emeralds) stones in sketch can marked with corresponding colors. Jewelry types: Ring, Bracelet, Necklace, Pendant, Earrings, Watch. You must generate jewelry piece anyway, you must identify the jewelry from the sketch (use the most likely type of jewelry, materials, stones). Use proper lighting to showcase the piece. Make it look like a professional product photo for a luxury jewelry brand.'
      },
      openai_sketch: {
        api_url: 'https://api.openai.com/v1/chat/completions',
        params: {
          model: 'gpt-4o-mini',
          "messages": [
            {
              "role": "developer",
              "content": "You are the professional jewelry sketch reader. Your mission is to view uploaded sketch file, interpret it and create a detailed description of the jewelry in the sketch. This description will be later used for AI jewelry generation. You must try to identify jewelry type, materials, stones from the sketch if no additional information is provided in user prompt. We work only with 18k gold (white, rose, yellow) and natural stones (Diamonds, Rubies, Blue Sapphires, Emeralds) stones in sketch can marked with corresponding colors. Jewelry types: Ring, Bracelet, Necklace, Pendant, Earrings, Watch. You must provide response anyway, you must identify the jewelry (use the most likely type of jewelry, materials, stones). Only give exact pure description of jewelry, nothing else, do not mention sketch."
            },
            {
              "role": "user",
              "content": [
                {
                  "type": "text",
                  "text": "REPLACE_WITH_USER_PROMPT"
                },
                {
                  "type": "image_url",
                  "image_url": {
                    "url": "REPLACE_WITH_IMAGE_DATA" // `data:image/png;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          "max_tokens": 300
        }
      },
      openai_estimate: {
        api_url: 'https://api.openai.com/v1/chat/completions',
        params: {
          model: 'gpt-4o-mini',
          "messages": [
            {
              "role": "developer",
              "content": "You are the professional jewelry appraiser. Your mission is to estimate uploaded jewerly design in terms of production cost. You must try to estimate jewelry based on approximate gold weight and stones quantity and total Carat from the image if no additional information is provided in user prompt. We work only with 18k gold (white, rose, yellow) and natural or lab grown stones (Diamonds, Rubies, Blue Sapphires, Emeralds). Consider if a jewelry has most likely spherical / 3D type of form (not flat), then it most likely has same stones quantity on the other (not visible) side, then simply double the visible quantity of stones. OUR COSTING SYSTEM: 1 gram of 18k gold - $140, 1 Carat of natural stones - $1,400, 1 Carat of lab grown stones - $320. Try to be as close to the price range as possible. Only give exact pure price range, nothing else, do not mention image. You MUST provide response anyway, you must provide a RESPONSE in a format (NO OTHER WORDS): $1,000 - $2,000"
            },
            {
              "role": "user",
              "content": [
                {
                  "type": "text",
                  "text": "REPLACE_WITH_USER_PROMPT"
                },
                {
                  "type": "image_url",
                  "image_url": {
                    "url": "REPLACE_WITH_IMAGE_URL" // image_url from the database
                  }
                }
              ]
            }
          ],
          "max_tokens": 300
        }
      },
      replicate: {
        api_url: 'https://api.replicate.com/v1/models',
        model: 'black-forest-labs/flux-1.1-pro-ultra',
        params: {
          raw: true,
          num_images: 1,
          enable_safety_checker: true,
          safety_tolerance: 2,
          output_format: "png",
          aspect_ratio: "1:1"
        }
      },
      fal: {
        api_url: 'https://queue.fal.run',
        model: 'fal-ai/flux-pro',
        version: 'v1.1-ultra', // Fal has versions
        params: {
          sync_mode: false, // Do not send final image in the request
          num_images: 1,
          enable_safety_checker: true,
          raw: true,
          safety_tolerance: 2,
          output_format: "png",
          aspect_ratio: "1:1"
        }
      }
    }
  }
};