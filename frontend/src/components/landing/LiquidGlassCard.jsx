import React from 'react';

export default function LiquidGlassCard() {
  return (
    <div className="w-[200px] h-[200px] flex flex-col justify-between p-5 liquid-glass-card translate-y-[-50px] z-20 shadow-2xl transition-all duration-500 hover:scale-105">
      <div className="text-[14px] text-white/60 tracking-widest font-mono font-medium">
        [ 2024 ]
      </div>
      <div>
        <h3 className="text-[18px] leading-[1.2] font-['Plus_Jakarta_Sans'] font-bold mb-2 text-white/95 text-left">
          Transcribed by <span className="font-['Instrument_Serif'] italic font-normal text-[22px] text-[#5ed29c]">MeetMind</span> AI-Powered Intelligence
        </h3>
        <p className="text-[11px] text-white/50 leading-relaxed font-['Inter'] text-left">
          Advanced diarization and real-time summaries for every discussion.
        </p>
      </div>
    </div>
  );
}
