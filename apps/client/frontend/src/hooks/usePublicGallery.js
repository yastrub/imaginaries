import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useConsolidatedData } from './useConsolidatedData';

// No need for module-level caching as we're using the global request cache

// Simple debounce utility (replace with lodash.debounce if available)
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export function usePublicGallery() {
  const [error, setError] = useState(null);
  
  // Use the consolidated data hook instead of making a separate API call
  const {
    publicImages,
    isLoading,
    totalPages,
    hasMore,
    view,
    switchView,
    loadNextPage,
    refresh
  } = useConsolidatedData();

  return {
    images: publicImages,
    isLoading,
    error,
    view,
    switchView,
    loadNextPage,
    hasMore,
    refreshData: refresh
  };
}