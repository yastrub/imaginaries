import React, { useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { showQrModal } from '../lib/qr';

// Create a stable random number generator with a fixed seed
function seededRandom(seed) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Create a memoized version of the component to prevent re-renders
const WelcomeMessageComponent = () => {
  const isTerminalApp = useSelector((state) => state?.env?.isTerminalApp);
  const tapCountRef = useRef(0);
  const tapWindowTimerRef = useRef(null);
  const secondTapTimerRef = useRef(null);
  const thirdTapTimerRef = useRef(null);
  // The text to animate
  const text = "What would you like to imagine?";

  // Use useMemo to ensure these calculations only happen once
  const { charElements, styleContent } = useMemo(() => {
    // Split the text into characters (including spaces)
    const chars = text.split('').map((char, index) => ({
      char,
      index: index + 1, // Start at 1 to match :nth-child
    }));

    const elements = chars.map(({ char, index }) => (
      <span key={index} className="char">
        {char}
      </span>
    ));

    // Calculate the total number of characters (including spaces)
    const totalChars = text.length;

    // Generate staggered delays dynamically
    const animationElementsCount = 100;
    const delayBetweenLetters = 0.45;
    const totalDelayTime = animationElementsCount * delayBetweenLetters;
    let delayStyles = '';

    // Apply delays to all characters sequentially (including spaces)
    for (let i = 1; i <= totalChars; i++) {
      const delay = (i * delayBetweenLetters) - totalDelayTime;
      delayStyles += `
        .anim-text-flow .char:nth-child(${i}) {
          animation-delay: ${delay}s;
        }
      `;
    }

    // Create a stable random number generator with a fixed seed
    const random = seededRandom(12345); // Fixed seed for consistent colors

    // Generate keyframes with stable random hues
    const animationSteps = 20;
    let keyframeStyles = '';

    for (let i = 0; i <= animationSteps; i++) {
      const percentage = (i * (100 / animationSteps)).toFixed(2);
      const randomHue = Math.floor(random() * 365);
      keyframeStyles += `
        ${percentage}% {
          color: hsla(${randomHue}, 60%, 60%, 1);
        }
      `;
    }

    // Create the complete style content
    const content = `
      .anim-text-flow {
        display: inline-block;
        white-space: pre-wrap;
      }

      .anim-text-flow .char {
        animation: anim-text-flow-keys 50s infinite alternate;
      }

      @keyframes anim-text-flow-keys {
        ${keyframeStyles}
      }

      ${delayStyles}
    `;

    return { charElements: elements, styleContent: content };
  }, []); // Empty dependency array ensures this only runs once

  return (
    <>
      <style>{styleContent}</style>

      <div
        role="presentation"
        onMouseDown={(e) => { e.stopPropagation(); }}
        onClick={(e) => {
          e.stopPropagation();
          if (!isTerminalApp) return;
          if (!tapWindowTimerRef.current) {
            tapWindowTimerRef.current = setTimeout(() => {
              tapCountRef.current = 0;
              tapWindowTimerRef.current = null;
              if (secondTapTimerRef.current) {
                try { clearTimeout(secondTapTimerRef.current); } catch {}
                secondTapTimerRef.current = null;
              }
              if (thirdTapTimerRef.current) {
                try { clearTimeout(thirdTapTimerRef.current); } catch {}
                thirdTapTimerRef.current = null;
              }
            }, 3000);
          }
          tapCountRef.current += 1;
          if (tapCountRef.current === 2 && !secondTapTimerRef.current) {
            // Schedule QR after a short delay; cancel if user continues to 5 taps
            secondTapTimerRef.current = setTimeout(() => {
              if (tapCountRef.current === 2) {
                try {
                  showQrModal({
                    url: 'https://imaginaries.app/?code=artificial',
                    title: 'Continue on your phone',
                    subtitle: 'Scan to open Imaginaries.App',
                    showLink: false,
                    size: 420,
                  });
                } catch {}
              }
              secondTapTimerRef.current = null;
            }, 900);
          }
          if (tapCountRef.current === 3 && !thirdTapTimerRef.current) {
            // Cancel any pending double-tap QR
            if (secondTapTimerRef.current) {
              try { clearTimeout(secondTapTimerRef.current); } catch {}
              secondTapTimerRef.current = null;
            }
            // Schedule Telegram QR; cancel if user continues to 5 taps
            thirdTapTimerRef.current = setTimeout(() => {
              if (tapCountRef.current === 3) {
                try {
                  showQrModal({
                    url: 'https://t.me/+VXMHrPDUo09iZWQy',
                    title: 'Join our Telegram Group',
                    subtitle: 'Scan to join the ART*FICIAL Community',
                    showLink: false,
                    size: 420,
                  });
                } catch {}
              }
              thirdTapTimerRef.current = null;
            }, 900);
          }
          if (tapCountRef.current >= 5) {
            tapCountRef.current = 0;
            if (tapWindowTimerRef.current) {
              clearTimeout(tapWindowTimerRef.current);
              tapWindowTimerRef.current = null;
            }
            if (secondTapTimerRef.current) {
              try { clearTimeout(secondTapTimerRef.current); } catch {}
              secondTapTimerRef.current = null;
            }
            if (thirdTapTimerRef.current) {
              try { clearTimeout(thirdTapTimerRef.current); } catch {}
              thirdTapTimerRef.current = null;
            }
            try { window.location.href = '/merch'; } catch {}
          }
        }}
      >
        <h1 className="text-[4.0rem] leading-[1] font-extralight text-center mb-6 tracking-normal select-none">
          <span className="anim-text-flow">
            {charElements}
          </span>
        </h1>
        <p className="text-1xl text-zinc-500 text-center mb-8 select-none">
          Create your dream jewelry using the prompt below:
        </p>
      </div>
    </>
  );
};

// Wrap in React.memo to prevent re-renders
export const WelcomeMessage = React.memo(WelcomeMessageComponent);