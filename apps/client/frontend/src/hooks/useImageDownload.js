import { useState } from 'react';

export function useImageDownload() {
  const [downloadingImageId, setDownloadingImageId] = useState(null);

  const handleDownload = async (image) => {
    // Handle the case where only an ID is passed instead of a full image object
    let imageId;
    let imageData = image;
    
    if (typeof image === 'string') {
      // If image is just an ID string
      imageId = image;
      console.log('[Client] Received image ID for download:', imageId);
    } else if (image?.id) {
      // If image is a full object
      imageId = image.id;
    } else {
      console.log('[Client] Invalid image data:', image);
      return;
    }
    
    // Check if we're already downloading this image
    if (downloadingImageId === imageId) {
      console.log('[Client] Already downloading image:', imageId);
      return;
    }
    
    setDownloadingImageId(imageId);
    console.log('[Client] Starting download for image ID:', imageId);

    try {
      // We've already extracted the image ID above
      console.log('[Client] Using image ID for download:', imageId);

      let downloadUrl = null;
      
      // If we have the full image object, check if it already has a watermarked URL
      if (typeof image !== 'string' && image.watermarked) {
        downloadUrl = image.watermarked;
      }

      // If no watermarked version exists, request one
      if (!downloadUrl) {
        console.log('[Client] No watermarked version found, requesting one...');
        const response = await fetch(`/api/generate/download/${imageId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: typeof image !== 'string' ? image.user_id : null }),
          credentials: 'include',
        });

        console.log('[Client] Server response:', response.status, response.statusText);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[Client] Server error:', errorData);
          throw new Error(errorData.error || 'Failed to process download');
        }

        const data = await response.json();
        console.log('[Client] Server response data:', data);

        if (!data.watermarkedUrl) {
          throw new Error('No watermarked URL received from server');
        }
        
        downloadUrl = data.watermarkedUrl;
        console.log('[Client] Received watermarked URL:', downloadUrl);
      }

      console.log('[Client] Downloading from URL:', downloadUrl);
      const response = await fetch(downloadUrl);
      console.log('[Client] Download response:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log('[Client] Content type:', contentType);

      if (!contentType || !contentType.includes('image/')) {
        throw new Error('Invalid content type received');
      }
      
      const blob = await response.blob();
      console.log('[Client] Got blob:', blob.size, 'bytes');
      
      const url = URL.createObjectURL(blob);
      console.log('[Client] Created object URL:', url);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Generate a filename based on available data
      let filename;
      if (typeof image !== 'string' && image.prompt) {
        // If we have a prompt, use it for the filename
        const sanitizedPrompt = image.prompt.slice(0, 30).replace(/[^a-z0-9]/gi, '-');
        filename = `jewelry-${sanitizedPrompt}.png`;
      } else {
        // Otherwise use the image ID
        filename = `jewelry-${imageId}.png`;
      }
      a.download = filename;
      
      document.body.appendChild(a);
      console.log('[Client] Triggering download');
      a.click();
      
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('[Client] Download completed successfully');
    } catch (error) {
      console.error('[Client] Download error:', error);
      alert(error.message || 'Failed to download image. Please try again.');
    } finally {
      setDownloadingImageId(null);
    }
  };

  return { handleDownload, downloadingImageId };
}