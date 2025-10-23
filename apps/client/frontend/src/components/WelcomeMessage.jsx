import React, { useMemo } from 'react';

// Create a stable random number generator with a fixed seed
function seededRandom(seed) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Create a memoized version of the component to prevent re-renders
const WelcomeMessageComponent = () => {
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

      <h1 className="text-[4.0rem] leading-[1] font-extralight text-center mb-6 tracking-normal">
        <span className="anim-text-flow">
          {charElements}
        </span>
      </h1>
      <p className="text-1xl text-zinc-500 text-center mb-8">
        Create your dream jewelry using the prompt below:
      </p>
    </>
  );
};

// Wrap in React.memo to prevent re-renders
export const WelcomeMessage = React.memo(WelcomeMessageComponent);