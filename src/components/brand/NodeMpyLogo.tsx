import React from 'react';

interface NodeMpyLogoProps {
  className?: string;
  size?: number;
}

export const NodeMpyLogo: React.FC<NodeMpyLogoProps> = ({ className = 'w-7 h-7', size = 28 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="mpyGrad" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00D4B2" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="innerGrad" x1="8" y1="8" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E293B" />
          <stop offset="1" stopColor="#0F172A" />
        </linearGradient>
        <filter id="mpyGlow" x="-2" y="-2" width="36" height="36" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#00D4B2" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Outer Microcontroller Frame */}
      <rect
        x="3"
        y="3"
        width="26"
        height="26"
        rx="6"
        fill="url(#innerGrad)"
        stroke="url(#mpyGrad)"
        strokeWidth="1.5"
      />

      {/* Chip Pins Top/Bottom */}
      <rect x="9" y="0.75" width="2" height="2.5" rx="0.75" fill="#00D4B2" />
      <rect x="15" y="0.75" width="2" height="2.5" rx="0.75" fill="#38BDF8" />
      <rect x="21" y="0.75" width="2" height="2.5" rx="0.75" fill="#00D4B2" />

      <rect x="9" y="28.75" width="2" height="2.5" rx="0.75" fill="#00D4B2" />
      <rect x="15" y="28.75" width="2" height="2.5" rx="0.75" fill="#38BDF8" />
      <rect x="21" y="28.75" width="2" height="2.5" rx="0.75" fill="#00D4B2" />

      {/* Chip Pins Left/Right */}
      <rect x="0.75" y="9" width="2.5" height="2" rx="0.75" fill="#00D4B2" />
      <rect x="0.75" y="15" width="2.5" height="2" rx="0.75" fill="#38BDF8" />
      <rect x="0.75" y="21" width="2.5" height="2" rx="0.75" fill="#00D4B2" />

      <rect x="28.75" y="9" width="2.5" height="2" rx="0.75" fill="#00D4B2" />
      <rect x="28.75" y="15" width="2.5" height="2" rx="0.75" fill="#38BDF8" />
      <rect x="28.75" y="21" width="2.5" height="2" rx="0.75" fill="#00D4B2" />

      {/* Circuit Nodes & Connections */}
      <circle cx="10" cy="10" r="2.2" fill="#00D4B2" filter="url(#mpyGlow)" />
      <circle cx="22" cy="10" r="2.2" fill="#38BDF8" filter="url(#mpyGlow)" />
      <circle cx="16" cy="16" r="2.8" fill="url(#mpyGrad)" filter="url(#mpyGlow)" />
      <circle cx="10" cy="22" r="2.2" fill="#38BDF8" filter="url(#mpyGlow)" />
      <circle cx="22" cy="22" r="2.2" fill="#00D4B2" filter="url(#mpyGlow)" />

      {/* Flow Traces / Wires */}
      <path
        d="M10 10 L16 16 M22 10 L16 16 M10 22 L16 16 M22 22 L16 16"
        stroke="url(#mpyGrad)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const NodeTealLogo = NodeMpyLogo;
