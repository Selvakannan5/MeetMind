import React from 'react';
import HLSBackground from './HLSBackground';

export default function ThemeLayout({ children }) {
  return (
    <div className="relative w-full min-h-screen bg-[#070b0a] text-white overflow-hidden font-sans">
      {/* Universal Video Background */}
      <HLSBackground />
      
      {/* Central Glow Effects - Universal */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[400px] pointer-events-none z-0">
        <svg viewBox="0 0 800 400" className="w-full h-full opacity-60">
          <defs>
            <filter id="glowBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="30" result="blur" />
            </filter>
            <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6c63ff" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#00d4aa" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#070b0a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="400" cy="150" rx="350" ry="100" fill="url(#glowGrad)" filter="url(#glowBlur)" />
          <ellipse cx="400" cy="120" rx="180" ry="50" fill="#5ed29c" fillOpacity="0.15" filter="url(#glowBlur)" />
        </svg>
      </div>

      <div className="relative z-10 w-full min-h-screen overflow-auto">
        {children}
      </div>
    </div>
  );
}
