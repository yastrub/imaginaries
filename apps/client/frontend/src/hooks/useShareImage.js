import React, { useState, useEffect } from 'react';

export function useShareImage(imageId) {
  const [image, setImage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!imageId) return;

    setIsLoading(true);
    setError(null);

    fetch(`/api/generate/public?imageId=${imageId}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to load image');
        }
        return res.json();
      })
      .then(data => {
        if (data.image) {
          setImage({
            id: data.image.id,
            url: data.image.image_url,
            prompt: data.image.prompt,
            createdAt: data.image.createdAt || data.image.created_at, // Handle both camelCase and snake_case
            metadata: data.image.metadata || {},
            watermarked: data.image.watermarked_url,
            user_id: data.image.user_id,
            is_private: data.image.is_private || false,
            like_count: parseInt(data.image.like_count || '0', 10)
          });
        }
      })
      .catch(err => {
        console.error('Error loading share image:', err);
        setError('Failed to load image');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [imageId]);

  return {
    image,
    isLoading,
    error
  };
}
