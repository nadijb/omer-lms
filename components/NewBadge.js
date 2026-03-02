'use client';
// components/NewBadge.js
// Renders a pulsing "NEW" pill badge with a hover tooltip describing the feature.
// Controlled entirely by the NEXT_PUBLIC_SHOW_NEW_BADGES env var.
//
// Usage (inline/absolute positioned over a UI element):
//   <div className="relative inline-block">
//     <SomeComponent />
//     <NewBadge description="Click here to schedule a session on the calendar." />
//   </div>
//
// Usage (standalone inline):
//   <NewBadge description="This panel now supports drag-and-drop reordering." />

import { useState } from 'react';

export default function NewBadge({ description }) {
  const [hovered, setHovered] = useState(false);

  // Only render when the env flag is explicitly "true"
  if (process.env.NEXT_PUBLIC_SHOW_NEW_BADGES !== 'true') return null;

  return (
    <span className="absolute -top-2 -right-2 z-10 inline-block">
      {/* Pulsing pill */}
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cortex-accent text-white animate-pulse cursor-default select-none"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        NEW
      </span>

      {/* Tooltip — appears above the badge */}
      {hovered && description && (
        <span className="absolute bottom-full right-0 mb-2 w-48 max-w-48 bg-cortex-surface border border-cortex-border rounded-lg px-3 py-2 text-xs text-cortex-text shadow-lg z-50 whitespace-normal leading-snug pointer-events-none">
          {description}
          {/* Arrow pointing down toward the badge */}
          <span className="absolute top-full right-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-cortex-border" />
        </span>
      )}
    </span>
  );
}
