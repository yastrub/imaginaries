/**
 * React Query Configuration
 * This file sets up the React Query client with default options
 */

import { QueryClient } from '@tanstack/react-query';

// Create a client with optimized settings for our application
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default options for all queries
      refetchOnWindowFocus: false, // Don't refetch when window gains focus
      refetchOnMount: false, // Don't refetch when component mounts
      refetchOnReconnect: false, // Don't refetch when reconnecting
      retry: 1, // Only retry failed queries once
      staleTime: 1000 * 60 * 5, // Data is fresh for 5 minutes
      cacheTime: 1000 * 60 * 30, // Cache data for 30 minutes
    },
    mutations: {
      // Default options for all mutations
      retry: 1, // Only retry failed mutations once
    },
  }
});
