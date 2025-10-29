// This is a utility function to directly modify the prompt in the DOM
// We're using this as a last resort to fix the prompt reuse functionality

export function fixPromptInDOM(promptText) {
  console.log('PromptFixer: Attempting to set prompt text directly in DOM:', promptText);
  
  try {
    // Try to find the textarea via stable selectors
    const promptTextarea = document.querySelector('textarea[data-qa="prompt-textarea"], textarea[name="prompt"]');
    
    if (promptTextarea) {
      // Set the value directly
      promptTextarea.value = promptText;
      
      // Trigger input event to ensure React state updates
      const inputEvent = new Event('input', { bubbles: true });
      promptTextarea.dispatchEvent(inputEvent);
      
      // Focus the textarea
      promptTextarea.focus();
      
      // Scroll to the textarea
      promptTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      console.log('PromptFixer: Successfully set prompt text in textarea');
      return true;
    } else {
      console.warn('PromptFixer: Could not find prompt textarea in DOM');
      return false;
    }
  } catch (error) {
    console.error('PromptFixer: Error setting prompt text in DOM:', error);
    return false;
  }
}
