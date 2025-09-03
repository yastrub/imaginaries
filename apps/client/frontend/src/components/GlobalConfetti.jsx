import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

// Create a global event system for triggering confetti
const confettiEvents = new EventTarget();

// Event names
export const CONFETTI_EVENTS = {
  PRICE_ESTIMATION: 'price-estimation',
  GENERATION_SUCCESS: 'generation-success'
};

// Helper function to trigger confetti
export function triggerConfetti(eventName) {
  const event = new CustomEvent(eventName);
  confettiEvents.dispatchEvent(event);
}

// Actual confetti component that uses canvas for better performance
export function GlobalConfetti() {
  const [showPriceConfetti, setShowPriceConfetti] = useState(false);
  const [showGenerationConfetti, setShowGenerationConfetti] = useState(false);
  
  useEffect(() => {
    // Load the confetti library dynamically
    let confetti = null;
    import('canvas-confetti').then(module => {
      confetti = module.default;
    });
    
    // Listen for price estimation confetti events
    const handlePriceEstimation = () => {
      if (confetti) {
        setShowPriceConfetti(true);
        // Gold/amber colored confetti for price estimation
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFC107', '#FFD700', '#FFAB00', '#FF8F00']
        });
        setTimeout(() => setShowPriceConfetti(false), 3000);
      }
    };
    
    // Listen for generation success confetti events
    const handleGenerationSuccess = () => {
      if (confetti) {
        setShowGenerationConfetti(true);
        // Larger, more colorful explosion for generation success
        confetti({
          particleCount: 200,
          spread: 160,
          origin: { y: 0.5 },
          zIndex: 10000
        });
        setTimeout(() => setShowGenerationConfetti(false), 3000);
      }
    };
    
    // Add event listeners
    confettiEvents.addEventListener(CONFETTI_EVENTS.PRICE_ESTIMATION, handlePriceEstimation);
    confettiEvents.addEventListener(CONFETTI_EVENTS.GENERATION_SUCCESS, handleGenerationSuccess);
    
    // Clean up event listeners
    return () => {
      confettiEvents.removeEventListener(CONFETTI_EVENTS.PRICE_ESTIMATION, handlePriceEstimation);
      confettiEvents.removeEventListener(CONFETTI_EVENTS.GENERATION_SUCCESS, handleGenerationSuccess);
    };
  }, []);
  
  // This component doesn't render anything visible
  // The canvas-confetti library creates its own canvas element
  return null;
}
