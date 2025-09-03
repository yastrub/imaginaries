import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConfettiExplosion, confettiPresets } from './ui/confetti-explosion';

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

export function ConfettiManager() {
  const [showPriceConfetti, setShowPriceConfetti] = useState(false);
  const [showGenerationConfetti, setShowGenerationConfetti] = useState(false);
  
  useEffect(() => {
    // Listen for price estimation confetti events
    const handlePriceEstimation = () => {
      setShowPriceConfetti(true);
      setTimeout(() => setShowPriceConfetti(false), confettiPresets.price.duration);
    };
    
    // Listen for generation success confetti events
    const handleGenerationSuccess = () => {
      setShowGenerationConfetti(true);
      setTimeout(() => setShowGenerationConfetti(false), confettiPresets.large.duration);
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
  
  // Only render if we need to show confetti
  if (!showPriceConfetti && !showGenerationConfetti) return null;
  
  // Use createPortal to render at the root level
  return createPortal(
    <>
      {showPriceConfetti && (
        <div 
          className="fixed inset-0 pointer-events-none flex items-center justify-center" 
          style={{ zIndex: 10000 }}
        >
          <ConfettiExplosion active={true} {...confettiPresets.price} />
        </div>
      )}
      
      {showGenerationConfetti && (
        <div 
          className="fixed inset-0 pointer-events-none flex items-center justify-center" 
          style={{ zIndex: 10000 }}
        >
          <ConfettiExplosion active={true} {...confettiPresets.large} />
        </div>
      )}
    </>,
    document.body
  );
}
