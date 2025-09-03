import React from 'react';

export function ImageCardSkeleton() {
  return (
    <div className="relative group overflow-hidden rounded-lg bg-zinc-800 animate-pulse">
      {/* Skeleton image */}
      <div className="aspect-square w-full bg-zinc-700">
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-zinc-600 animate-pulse"></div>
        </div>
      </div>
      
      {/* Skeleton info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
        <div className="bg-zinc-700/50 backdrop-blur-sm rounded p-2">
          <div className="h-4 w-3/4 bg-zinc-600 rounded animate-pulse"></div>
        </div>
      </div>
      
      {/* Skeleton action buttons */}
      <div className="absolute top-3 right-3 flex gap-2">
        <div className="h-8 w-8 rounded-md bg-zinc-700 animate-pulse"></div>
        <div className="h-8 w-8 rounded-md bg-zinc-700 animate-pulse"></div>
      </div>
      
      {/* Skeleton like button */}
      <div className="absolute top-3 left-3">
        <div className="flex items-center gap-1">
          <div className="h-6 w-6 rounded-full bg-zinc-700 animate-pulse"></div>
          <div className="h-4 w-6 bg-zinc-700 rounded animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}
