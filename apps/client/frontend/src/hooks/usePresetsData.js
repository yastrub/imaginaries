import { presets } from '../config/presets';

/**
 * Hook to make presets data available globally
 * This ensures that the presets data is accessible from anywhere in the app
 */
export function usePresetsData() {
  // Make presets available globally on first render
  if (typeof window !== 'undefined' && !window.PRESETS_DATA) {
    window.PRESETS_DATA = presets;
  }
  
  return {
    presets
  };
}
