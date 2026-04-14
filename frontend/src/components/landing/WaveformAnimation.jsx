import React from 'react';

export default function WaveformAnimation() {
  return (
    <div className="flex items-center justify-center gap-[3px] h-12 w-full max-w-[120px] mx-auto opacity-80 group">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="w-[3px] bg-gradient-to-t from-[#6c63ff] to-[#5ed29c] rounded-full transition-all duration-300 ease-in-out"
          style={{
            height: '20%',
            animation: `waveform-pulse ${1 + Math.random()}s ease-in-out infinite`,
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
      <style>{`
        @keyframes waveform-pulse {
          0%, 100% { height: 20%; }
          50% { height: 100%; }
        }
      `}</style>
    </div>
  );
}
