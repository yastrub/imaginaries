import { useEffect } from 'react';

/**
 * Component to dynamically update meta tags for social sharing
 * This component doesn't render anything visible, it just updates the document head
 */
export function MetaTags({ title, description, imageUrl, url }) {
  useEffect(() => {
    // Store original values to restore them later
    const originalTitle = document.title;
    const metaTags = [];
    
    // Update the document title
    document.title = title || 'IMAGINARIES';
    
    // Helper function to create or update a meta tag
    const setMetaTag = (name, content, property = null) => {
      // Try to find an existing tag
      let meta;
      if (property) {
        meta = document.querySelector(`meta[property="${property}"]`);
      } else {
        meta = document.querySelector(`meta[name="${name}"]`);
      }
      
      // If the tag doesn't exist, create it
      if (!meta) {
        meta = document.createElement('meta');
        if (property) {
          meta.setAttribute('property', property);
        } else {
          meta.setAttribute('name', name);
        }
        document.head.appendChild(meta);
        metaTags.push(meta); // Track created tags for cleanup
      }
      
      // Set the content
      meta.setAttribute('content', content);
      return meta;
    };
    
    // Set basic meta tags
    if (description) {
      setMetaTag('description', description);
    }
    
    // Set Open Graph meta tags
    if (title) {
      setMetaTag('og:title', title, 'og:title');
    }
    
    if (description) {
      setMetaTag('og:description', description, 'og:description');
    }
    
    if (url) {
      setMetaTag('og:url', url, 'og:url');
    }
    
    if (imageUrl) {
      setMetaTag('og:image', imageUrl, 'og:image');
      setMetaTag('og:image:secure_url', imageUrl, 'og:image:secure_url');
      setMetaTag('og:image:type', 'image/jpeg', 'og:image:type');
      setMetaTag('og:image:width', '1200', 'og:image:width');
      setMetaTag('og:image:height', '630', 'og:image:height');
    }
    
    // Set Twitter Card meta tags
    setMetaTag('twitter:card', 'summary_large_image', 'twitter:card');
    
    if (title) {
      setMetaTag('twitter:title', title, 'twitter:title');
    }
    
    if (description) {
      setMetaTag('twitter:description', description, 'twitter:description');
    }
    
    if (imageUrl) {
      setMetaTag('twitter:image', imageUrl, 'twitter:image');
    }
    
    // Cleanup function to restore original values when component unmounts
    return () => {
      document.title = originalTitle;
      metaTags.forEach(tag => {
        if (tag.parentNode) {
          tag.parentNode.removeChild(tag);
        }
      });
    };
  }, [title, description, imageUrl, url]); // Re-run when these props change
  
  // This component doesn't render anything
  return null;
}
