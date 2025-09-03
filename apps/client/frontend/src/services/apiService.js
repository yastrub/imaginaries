/**
 * API Service for React Query
 * This file contains all the API service functions that will be used with React Query
 */

import { API_HOST } from '../config/api.js';
import { updateReduxAuthFromApiResponse } from '../utils/reduxAuthMonitor';

/**
 * Base fetch function with error handling
 */
async function fetchWithErrorHandling(url, options = {}) {
  // Ensure credentials are included by default
  const fetchOptions = {
    credentials: 'include',
    ...options,
  };
  
  const response = await fetch(url, fetchOptions);
  
  // Check if the response is OK
  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    
    // Try to parse error as JSON if possible
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      // Update Redux auth state if the response contains auth information
      if (data && typeof data.isAuthenticated !== 'undefined') {
        updateReduxAuthFromApiResponse(data);
      }
      
      // Create an error with the response status and error message
      const error = new Error(data.message || data.error || `API error ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    
    // If not JSON, throw a generic error
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  
  // Check if response is JSON
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    // Parse the JSON response
    const data = await response.json();
    
    // Process ALL API responses to extract user data
    // This follows our protocol of extracting user data from every endpoint
    updateReduxAuthFromApiResponse(data);
    
    return data;
  }
  
  // Return raw response for non-JSON data
  return response;
}

/**
 * API Services for React Query
 */
export const apiService = {
  /**
   * Get recent images (works for both authenticated and non-authenticated users)
   */
  getRecentImages: async ({ page = 1, limit = 20, view = 'recent', showHistory = false }) => {
    // Choose the appropriate endpoint based on the view parameter
    let url;
    if (view === 'top-liked') {
      url = `${API_HOST}/api/images/top?page=${page}&limit=${limit}`;
    } else {
      url = `${API_HOST}/api/images/recent?page=${page}&limit=${limit}`;
    }
    
    // Add history parameter if requesting user history
    // DEFAULT BEHAVIOR: Show public gallery without any parameter
    if (showHistory) {
      url += `&history=true`;
      console.log('API Service: Requesting user history with URL:', url);
    } else {
      console.log('API Service: Requesting public gallery with URL:', url);
    }
    
    return fetchWithErrorHandling(url);
  },
  
  /**
   * Get user's image history
   */
  getUserImages: async ({ page = 1, limit = 20 }) => {
    // Always request user history with history=true parameter
    const url = `${API_HOST}/api/images/recent?page=${page}&limit=${limit}&history=true`;
    return fetchWithErrorHandling(url);
  },
  
  /**
   * Generate an image
   */
  generateImage: async ({ prompt, drawingPng = null, drawingSvg = null }) => {
    // Prepare request data
    const requestBody = { prompt };
    
    // Add drawing data if available
    if (drawingPng && drawingSvg) {
      requestBody.drawingPng = drawingPng;
      requestBody.drawingSvg = drawingSvg;
    }
    
    return fetchWithErrorHandling(`${API_HOST}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  },
  
  /**
   * Like an image
   */
  likeImage: async (imageId) => {
    return fetchWithErrorHandling(`${API_HOST}/api/images/${imageId}/like`, {
      method: 'POST',
    });
  },
  
  /**
   * Unlike an image
   */
  unlikeImage: async (imageId) => {
    return fetchWithErrorHandling(`${API_HOST}/api/images/${imageId}/unlike`, {
      method: 'POST',
    });
  },
  
  /**
   * Clear user's image history
   */
  clearHistory: async () => {
    return fetchWithErrorHandling(`${API_HOST}/api/generate/history/delete`, {
      method: 'DELETE',
    });
  },
};
