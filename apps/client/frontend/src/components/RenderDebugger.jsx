import React, { useEffect, useRef } from 'react';

/**
 * RenderDebugger - A component to help debug excessive re-renders
 * 
 * Usage:
 * 1. Wrap components you suspect are re-rendering too much
 * 2. Check console for render counts and what's changing between renders
 * 3. Use the shouldLog prop to control when logging happens
 */
export function RenderDebugger({ children, name = 'Component', shouldLog = true, trackProps = true }) {
  const renderCount = useRef(0);
  const previousProps = useRef({});
  
  // Extract props from children if it's a single React element
  const childProps = React.isValidElement(children) ? children.props : {};
  
  useEffect(() => {
    if (!shouldLog) return;
    
    renderCount.current += 1;
    console.group(`%c[RenderDebugger] ${name} rendered ${renderCount.current} times`, 'color: #2563eb; font-weight: bold;');
    
    if (trackProps && renderCount.current > 1) {
      // Compare current props with previous props
      const allKeys = new Set([...Object.keys(previousProps.current), ...Object.keys(childProps)]);
      const changes = {};
      let hasChanges = false;
      
      allKeys.forEach(key => {
        if (previousProps.current[key] !== childProps[key]) {
          changes[key] = {
            from: previousProps.current[key],
            to: childProps[key]
          };
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        console.log('%cProps changed:', 'color: #f59e0b; font-weight: bold;');
        console.table(changes);
      } else {
        console.log('%cNo props changed. Re-render might be caused by context or parent component.', 'color: #ef4444;');
      }
    }
    
    console.groupEnd();
    
    // Store current props for next comparison
    previousProps.current = { ...childProps };
  });
  
  return children;
}

/**
 * withRenderDebugger - HOC to wrap components for render debugging
 */
export function withRenderDebugger(Component, options = {}) {
  const { name = Component.displayName || Component.name || 'Component' } = options;
  
  const WrappedComponent = (props) => (
    <RenderDebugger name={name} {...options}>
      <Component {...props} />
    </RenderDebugger>
  );
  
  WrappedComponent.displayName = `withRenderDebugger(${name})`;
  return WrappedComponent;
}

/**
 * How to use this debugger:
 * 
 * 1. Wrap a component directly:
 *    <RenderDebugger name="MyComponent">
 *      <MyComponent />
 *    </RenderDebugger>
 * 
 * 2. Use the HOC:
 *    const DebuggableComponent = withRenderDebugger(MyComponent);
 * 
 * 3. Conditionally enable debugging:
 *    <RenderDebugger name="MyComponent" shouldLog={isDevelopment}>
 *      <MyComponent />
 *    </RenderDebugger>
 */
