import React, { useEffect, useRef, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const AutoResizeTextarea = forwardRef(({ value, onChange, className, ...props }, ref) => {
  const textareaRef = useRef(null);
  const actualRef = ref || textareaRef;

  useEffect(() => {
    const textarea = actualRef.current;
    if (!textarea) return;

    const resize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(64, textarea.scrollHeight)}px`;
    };

    resize();
    textarea.addEventListener('input', resize);
    return () => textarea.removeEventListener('input', resize);
  }, [value, actualRef]);

  return (
    <textarea
      ref={actualRef}
      value={value}
      onChange={onChange}
      rows={1}
      className={cn(
        "w-full bg-transparent text-foreground text-xl px-6 py-4 pr-24 resize-none overflow-hidden block min-h-[4rem] max-h-[12rem] leading-relaxed border-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
        className
      )}
      {...props}
    />
  );
});

AutoResizeTextarea.displayName = 'AutoResizeTextarea';