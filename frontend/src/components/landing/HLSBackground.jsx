import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function HLSBackground() {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const source = 'https://stream.mux.com/tLkHO1qZoaaQOUeVWo8hEBeGQfySP02EPS02BmnNFyXys.m3u8';

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false, // Critical for sandbox environments
      });

      hls.loadSource(source);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch((err) => console.log('Auto-play prevented:', err));
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch((err) => console.log('Auto-play prevented:', err));
      });
    }
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-black pointer-events-none">
      <video
        ref={videoRef}
        className="absolute w-full h-full object-cover opacity-60"
        autoPlay
        loop
        muted
        playsInline
      />
      {/* Dark linear gradient overlays for readability and fading */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#070b0a] to-transparent"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#070b0a] via-[#070b0a]/30 to-transparent"></div>

      {/* Grid Lines Overlay */}
      <div className="absolute inset-0 flex justify-between px-[25%] opacity-0 md:opacity-100">
        <div className="w-[1px] h-full bg-white/10 absolute left-[25%]"></div>
        <div className="w-[1px] h-full bg-white/10 absolute left-[50%]"></div>
        <div className="w-[1px] h-full bg-white/10 absolute left-[75%]"></div>
      </div>
    </div>
  );
}
