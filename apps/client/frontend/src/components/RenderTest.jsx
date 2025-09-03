import React, { useState, useEffect } from 'react';

// This component will help us test re-rendering issues
export const RenderTest = () => {
  const [renderCount, setRenderCount] = useState(0);
  
  // Increment render count on each render
  useEffect(() => {
    setRenderCount(prev => prev + 1);
  }, []);
  
  return (
    <div className="fixed top-0 left-0 bg-black/80 text-white p-2 z-50">
      Render count: {renderCount}
    </div>
  );
};
