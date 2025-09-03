import React from 'react';

/**
 * A wrapper component for the react-confetti-explosion library
 * This allows us to dynamically import the library only when needed
 * and prevents it from being included in the initial bundle
 */
export function ConfettiExplosion({ active, ...props }) {
  const [ConfettiExplosionComponent, setConfettiExplosionComponent] = React.useState(null);

  React.useEffect(() => {
    if (active && !ConfettiExplosionComponent) {
      import('react-confetti-explosion').then((module) => {
        setConfettiExplosionComponent(() => module.default);
      });
    }
  }, [active, ConfettiExplosionComponent]);

  if (!active || !ConfettiExplosionComponent) {
    return null;
  }

  return <ConfettiExplosionComponent {...props} />;
}

/**
 * Preset configurations for different confetti explosion sizes
 */
export const confettiPresets = {
  small: {
    force: 0.4,
    duration: 2000,
    particleCount: 30,
    width: 400,
    colors: ['#FFC700', '#FF0000', '#2E3191', '#41BBC7']
  },
  medium: {
    force: 0.6,
    duration: 2500,
    particleCount: 80,
    width: 600,
    colors: ['#FFD700', '#FFA500', '#FF6347', '#9370DB', '#3CB371']
  },
  large: {
    force: 0.8,
    duration: 3000,
    particleCount: 150,
    width: 1000,
    colors: ['#FFD700', '#FF8C00', '#FF4500', '#9400D3', '#32CD32', '#1E90FF']
  },
  price: {
    force: 0.6,
    duration: 2500,
    particleCount: 100,
    width: 800,
    colors: ['#FFD700', '#FFC107', '#FFEB3B', '#F9A825', '#FF8F00', '#FFB300']
  }
};
