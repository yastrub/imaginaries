import { useCallback, useRef, useEffect } from 'react';
import { usePromptContext } from '../contexts/PromptContext';

/**
 * Hook to provide a direct way to submit prompts
 * This ensures that edited prompts are always used correctly
 */
export function useDirectPromptSubmission() {
  // Store the latest prompt value directly from the textarea
  const latestPromptRef = useRef('');
  
  // Get the prompt context
  const promptContext = usePromptContext();
  
  // Set up a listener to track prompt changes directly from the DOM
  useEffect(() => {
    const isPromptTextarea = (el) => {
      if (!el || el.tagName !== 'TEXTAREA') return false;
      const qa = el.getAttribute('data-qa');
      const name = el.getAttribute('name');
      return qa === 'prompt-textarea' || name === 'prompt';
    };

    // Seed latest value from the DOM once on mount
    try {
      const el = document.querySelector('textarea[data-qa="prompt-textarea"], textarea[name="prompt"]');
      if (el) {
        latestPromptRef.current = el.value || '';
      }
    } catch {}

    // Function to update our reference when the textarea changes
    const handleTextareaInput = (event) => {
      const t = event && event.target;
      if (isPromptTextarea(t)) {
        latestPromptRef.current = t.value;
        console.log('Direct prompt tracking updated:', latestPromptRef.current);
      }
    };

    // Add a global input event listener to catch all textarea changes
    document.addEventListener('input', handleTextareaInput);

    return () => {
      document.removeEventListener('input', handleTextareaInput);
    };
  }, []);
  
  /**
   * Get the most accurate prompt text, prioritizing:
   * 1. The latest directly edited text from the textarea
   * 2. The prompt from the PromptContext
   * 3. An empty string as fallback
   */
  const getAccuratePrompt = useCallback(() => {
    // CRITICAL FIX: Prioritize the combined prompt from context that includes presets
    console.log('Getting accurate prompt with latest context state');
    
    // First priority: Use the prompt context's final prompt (includes presets)
    try {
      if (promptContext && typeof promptContext.getFinalPrompt === 'function') {
        const contextPrompt = promptContext.getFinalPrompt();
        if (contextPrompt && contextPrompt.trim() !== '') {
          console.log('Using prompt context final prompt (includes presets):', contextPrompt);
          return contextPrompt;
        }
      }
    } catch (e) {
      console.error('Error getting prompt from context:', e);
    }
    
    // Second priority: Use the direct textarea value if available
    if (latestPromptRef.current && latestPromptRef.current.trim() !== '') {
      console.log('Using direct textarea value:', latestPromptRef.current);
      return latestPromptRef.current;
    }
    
    // Third priority: Use the prompt context's raw prompt
    try {
      if (promptContext && promptContext.prompt) {
        console.log('Using prompt context raw prompt:', promptContext.prompt);
        return promptContext.prompt;
      }
    } catch (e) {
      console.error('Error getting raw prompt from context:', e);
    }
    
    // Fifth priority: Check if presets are selected
    try {
      if (promptContext && promptContext.selectedPresets && promptContext.selectedPresets.length > 0) {
        // Get the presets from the context
        const presetLabels = promptContext.selectedPresets.map(id => {
          const preset = window.PRESETS_DATA?.find(p => p.id === id);
          return preset ? preset.value : null;
        }).filter(Boolean);
        
        if (presetLabels.length > 0) {
          const presetPrompt = presetLabels.join(', ');
          console.log('Using selected presets as prompt:', presetPrompt);
          return presetPrompt;
        }
      }
    } catch (e) {
      console.error('Error getting presets from context:', e);
    }
    
    // Fallback: Empty string
    console.warn('No prompt found, using empty string');
    return '';
  }, [promptContext]);
  
  return {
    getAccuratePrompt
  };
}
