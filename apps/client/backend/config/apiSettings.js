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
      openai_dalle: {
        api_url: 'https://api.openai.com/v1/images/generations',
        params: {
          model: 'dall-e-3', // dall-e-3, gpt-4o, gpt-image-1
          size: '1024x1024',
          quality: 'hd',
          style: 'natural'
        }
      },
      openai: {
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
        system_prompt: 'You are the professional jewelry sketch reader. Your mission is to view uploaded sketch file, interpret it and generate a photorealistic high quality image of the jewelry on a white background. You must try to identify jewelry type, shape, curves, style, materials, stones from the sketch if no additional information is provided in user prompt. We work only with 18k gold (white, rose, yellow) and natural stones (Diamonds, Rubies, Blue Sapphires, Emeralds) stones in sketch can be marked with corresponding colors. Jewelry types: Ring, Bracelet, Necklace, Pendant, Earrings, Brooch. Keep in mind the sketch is a finger-drawn sketch, not a photo, the lines are not perfect, but the jewelry result must be amazing. You must generate jewelry piece anyway, you must identify the jewelry from the sketch (use the most likely type of jewelry, materials, stones). Use proper lighting to showcase the piece. Make it look like a professional product photo for a luxury jewelry brand.'
      },
      openai_sketch: {
        api_url: 'https://api.openai.com/v1/chat/completions',
        params: {
          model: 'gpt-4.1',
          "messages": [
            {
              "role": "developer",
              "content": "You are the professional jewelry sketch reader. Your mission is to view uploaded sketch file, interpret it and create a detailed description of the jewelry in the sketch. This description will be later used for AI jewelry generation. You must try to identify jewelry type, materials, stones from the sketch if no additional information is provided in user prompt. We work only with 18k gold (white, rose, yellow) and natural stones (Diamonds, Rubies, Blue Sapphires, Emeralds) stones in sketch can be marked with corresponding colors. Jewelry types: Ring, Bracelet, Necklace, Pendant, Earrings, Brooch. You must provide response anyway, you must identify the jewelry (use the most likely type of jewelry, materials, stones). Only give exact pure description of jewelry, nothing else, do not mention sketch."
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
          ]
        }
      },
      openai_estimate: {
        api_url: 'https://api.openai.com/v1/chat/completions',
        params: {
          model: 'gpt-4.1',
          "messages": [
            {
              "role": "developer",
              "content": "You are a professional jewelry appraiser. You must identify the jewelry type, shape, weight, possible stones and their quantity. Given a jewelry image and optional text, estimate approximate USD retail prices (single numbers, not ranges) for exactly these four material configurations: (1) Sterling Silver for metal part + Moissanites for stones if any, (2) Gold Vermeil + Moissanites, (3) 18K Gold + Lab Diamonds, (4) 18K Gold + Natural Diamonds. Always output only four comma-separated numbers in USD with NO currency symbols, units, spaces, or extra words. Example: 120,180,950,2400. You must always produce four numbers, even if you need to approximate."
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
      },
      fal_gemini_edit: {
        api_url: 'https://queue.fal.run',
        model: 'fal-ai/gemini-25-flash-image',
        version: 'edit',
        params: {
          sync_mode: false,
          num_images: 1,
          output_format: 'png',
          aspect_ratio: '1:1',
          limit_generations: true
        },
        system_prompt: "You need to identify the main object (what exactly user wanted to show you) in the picture. If its not a jewelry you need to make a artistic high jewelry piece from it, use only precious stones and materials. If it's a jewelry - create a variation of it. USER_INPUT_HERE. Make a professional photo. White plain background."
      },
      fal_gemini_edit_text: {
        api_url: 'https://queue.fal.run',
        model: 'fal-ai/gemini-25-flash-image',
        version: 'edit',
        params: {
          sync_mode: false,
          num_images: 1,
          output_format: 'png',
          aspect_ratio: '1:1',
          limit_generations: true
        },
        system_prompt: "Generate artistic high jewelry USER_PROMPT_HERE. Samples are provided. Professional photo. White plain background."
      },
      fal_gemini_reimagine: {
        api_url: 'https://queue.fal.run',
        model: 'fal-ai/gemini-25-flash-image',
        version: 'edit',
        params: {
          sync_mode: false,
          num_images: 1,
          output_format: 'png',
          aspect_ratio: '1:1',
          limit_generations: true
        },
        system_prompt: "make a change to existing jewelry piece, instructions are provided in a user prompt, if no instruction provided make a slight variation of the jewelry in the image. try to identify the type of jewelry."
      },
      fal_gemini_collage: {
        api_url: 'https://queue.fal.run',
        model: 'fal-ai/nano-banana',
        version: 'edit',
        params: {
          sync_mode: false,
          num_images: 1,
          output_format: 'png',
          aspect_ratio: '3:4',
          limit_generations: true
        },
      },
    }
  }
};