import React, { useEffect, useRef, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const AutoResizeTextarea = forwardRef(({ value, onChange, className, fixedHeightPx = null, minHeightPx = 64, ...props }, ref) => {
  const textareaRef = useRef(null);
  const actualRef = ref || textareaRef;

  useEffect(() => {
    const textarea = actualRef.current;
    if (!textarea) return;

    if (fixedHeightPx != null) {
      // Force a fixed height and do not attach auto-resize
      textarea.style.height = `${fixedHeightPx}px`;
      return;
    }

    const resize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(minHeightPx, textarea.scrollHeight)}px`;
    };

    resize();
    textarea.addEventListener('input', resize);
    return () => textarea.removeEventListener('input', resize);
  }, [value, actualRef, fixedHeightPx, minHeightPx]);

  return (
    <textarea
      ref={actualRef}
      value={value}
      onChange={onChange}
      rows={1}
      className={cn(
        `w-full bg-transparent text-foreground text-xl px-6 py-4 pr-24 resize-none overflow-hidden block ${fixedHeightPx != null ? '' : 'min-h-[4rem] max-h-[12rem]'} leading-relaxed border-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background`,
        className
      )}
      {...props}
    />
  );
});

AutoResizeTextarea.displayName = 'AutoResizeTextarea';