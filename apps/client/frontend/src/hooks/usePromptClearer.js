import { useCallback } from 'react';
import { usePromptContext } from '../contexts/PromptContext';

/**
 * Hook to provide a safe way to clear the prompt
 * This is separated from other operations to avoid interference
 */
export function usePromptClearer() {
  // Get the prompt context
  const promptContext = usePromptContext();
  
  /**
   * Clear the prompt completely, similar to the Clear button in Presets Modal
   * This resets both the prompt text and any selected presets
   */
  const clearPromptCompletely = useCallback(() => {
    console.log('Clearing prompt completely');
    
    try {
      // Use the clearAll function from the context if available
      if (promptContext && typeof promptContext.clearAll === 'function') {
        promptContext.clearAll();
        return true;
      }
      
      // Fallback: Clear individual parts if clearAll is not available
      if (promptContext) {
        // Clear the prompt text
        if (typeof promptContext.setPrompt === 'function') {
          promptContext.setPrompt('');
        }
        
        // Clear selected presets if that function exists
        if (typeof promptContext.setSelectedPresets === 'function') {
          promptContext.setSelectedPresets([]);
        }
        
        return true;
      }
    } catch (error) {
      console.error('Error clearing prompt:', error);
    }
    
    return false;
  }, [promptContext]);
  
  /**
   * Clear only the prompt text, leaving presets intact
   */
  const clearPromptTextOnly = useCallback(() => {
    console.log('Clearing prompt text only');
    
    try {
      // Clear just the prompt text
      if (promptContext && typeof promptContext.setPrompt === 'function') {
        promptContext.setPrompt('');
        return true;
      }
    } catch (error) {
      console.error('Error clearing prompt text:', error);
    }
    
    return false;
  }, [promptContext]);
  
  return {
    clearPromptCompletely,
    clearPromptTextOnly
  };
}
