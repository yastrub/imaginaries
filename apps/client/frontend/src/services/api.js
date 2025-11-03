import { API_HOST } from '../config/api.js';
import { useToast } from '../components/ui/use-toast';

// Track ongoing requests
const ongoingRequests = new Map();

export async function generateImage(prompt, userId = null, drawingPng = null, drawingSvg = null, isPrivate = true, cameraPng = null, uploadedPng = null, reimagineImageUrl = null) {
  try {
    if (!userId) {
      throw new Error('Authentication required');
    }

    // Check if we're generating from a sketch
    const hasDrawing = !!(drawingPng && drawingSvg);
    
    // Create a unique key for this request - use a hash of the prompt instead of the full prompt
    // This prevents issues with special characters and long prompts
    const requestKey = `${userId}-${hasDrawing ? 'with-drawing' : (cameraPng ? 'with-camera' : (uploadedPng ? 'with-upload' : (reimagineImageUrl ? 'with-reimagine' : 'no-drawing')))}-${Date.now()}`;
    console.log('[Client] Starting image generation:', { 
      prompt, 
      userId, 
      hasDrawing,
      isPrivate,
      requestKey
    });

    // Check if there's already an ongoing request
    if (ongoingRequests.has(requestKey)) {
      console.log('[Client] Found existing request for:', requestKey);
      return ongoingRequests.get(requestKey);
    }

    console.log('[Client] Creating new request for:', requestKey);

    // Create the promise for this request
    const requestPromise = (async () => {
      try {
        // For all requests, we'll use JSON with Content-Type header
        const headers = {
          'Content-Type': 'application/json',
        };
        
        // Create the request body
        const requestBody = {
          prompt,
          userId,
          is_private: isPrivate
        };

        // Add drawing data if available
        if (drawingPng && drawingSvg) {
          requestBody.drawingPng = drawingPng;
          requestBody.drawingSvg = drawingSvg;
        }
        // Add camera photo if available
        if (cameraPng) {
          requestBody.cameraPng = cameraPng;
        }
        // Add reimagine image url if available
        if (reimagineImageUrl) {
          requestBody.reimagineImageUrl = reimagineImageUrl;
        }
        // Add uploaded image if available
        if (uploadedPng) {
          requestBody.uploadedPng = uploadedPng;
        }
        
        // Use the same endpoint for both sketch and text-based generation
        console.log('[Client] Sending generation request to server');
        const response = await fetch(`${API_HOST}/api/generate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          credentials: 'include',
        });

        console.log('[Client] Received response from server:', {
          status: response.status,
          statusText: response.statusText
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server returned non-JSON response');
        }

        const data = await response.json();
        console.log('[Client] Parsed response data:', data);

        if (!response.ok) {
          // Check for generation limit error
          if (response.status === 429 && data.limit) {
            // Return a structured error object instead of using toast directly
            // This allows the component to handle the toast
            const limitError = new Error('Generation Limit Reached');
            limitError.isLimitError = true;
            limitError.limit = data.limit;
            limitError.plan = data.plan;
            limitError.count = data.count;
            throw limitError;
          }
          throw new Error(data.message || data.error || 'Failed to generate image');
        }

        // Check if we have a full image object or just a URL
        if (data.id && (data.image_url || data.imageUrl)) {
          // We have a full image object, return it
          console.log('[Client] Successfully received full image object:', data);
          return data;
        } else {
          // Fallback: If we only have the URL, create a minimal image object
          const imageUrl = data.imageUrl || data.image_url;
          if (!imageUrl) {
            console.error('[Client] Missing image URL in response:', data);
            throw new Error('No image URL in response');
          }

          console.log('[Client] Only received image URL, creating image object:', imageUrl);
          // Return a minimal image object with the URL and prompt
          return {
            id: `temp-${Date.now()}`,
            image_url: imageUrl,
            url: imageUrl,
            prompt: prompt,
            created_at: new Date().toISOString(),
            user_id: userId,
            is_private: isPrivate,
            like_count: 0,
            is_liked: false
          };
        }
      } finally {
        // Always clean up the ongoing request
        console.log('[Client] Cleaning up request for:', requestKey);
        ongoingRequests.delete(requestKey);
      }
    })();

    // Store the promise
    ongoingRequests.set(requestKey, requestPromise);
    console.log('[Client] Stored promise for:', requestKey);

    // Return the promise
    return requestPromise;
  } catch (error) {
    console.error('[Client] Error generating image:', error);
    if (error.name === 'SyntaxError') {
      throw new Error('Invalid response from server');
    }
    throw error;
  }
}