import React from 'react';

export function ErrorMessage({ message }) {
  // Don't render anything if there's no message
  // Safely check if message is empty by converting to string first if needed
  if (!message || (typeof message === 'string' && message.trim() === '') || message === true) {
    return null;
  }
  
  // Convert non-string messages to string for display
  const displayMessage = typeof message === 'string' ? message : 
                         message instanceof Error ? message.message : 
                         JSON.stringify(message);
  
  return (
    <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
      {displayMessage}
    </div>
  );
}