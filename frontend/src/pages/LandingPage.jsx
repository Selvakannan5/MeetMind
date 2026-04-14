import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import HLSBackground from '../components/landing/HLSBackground';
import LiquidGlassCard from '../components/landing/LiquidGlassCard';

function Header({ setMobileMenuOpen, mobileMenuOpen }) {
  const links = [
    { name: 'LOGIN', path: '/login' },
    { name: 'REGISTER', path: '/register' }
  ];

  return (
    <>
      <header className="absolute top-0 left-0 w-full z-50 px-6 md:px-12 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer">
          <div className="w-8 h-8 bg-gradient-to-br from-[#6c63ff] to-[#00d4aa] rounded-bl-xl rounded-tr-xl flex items-center justify-center">
            <div className="w-2 h-2 bg-black rounded-full shadow-[0_0_8px_white]"></div>
          </div>
          <div className="font-['Inter'] font-black text-2xl tracking-tighter text-white uppercase">
            MeetMind
          </div>
        </div>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8 font-['Inter'] text-[14px] font-bold tracking-wider">
          {links.map((link) => (
            <Link key={link.name} to={link.path} className="text-white/80 hover:text-[#5ed29c] transition-colors">
              {link.name}
            </Link>
          ))}
          <Link to="/register" className="bg-white/5 border border-white/10 hover:border-[#5ed29c]/50 px-6 py-2 rounded-full text-white transition-all">
            GET STARTED
          </Link>
        </nav>
        
        {/* Mobile Nav Toggle */}
        <button 
          className="md:hidden text-white z-[60]"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-[#070b0a] z-[55] flex flex-col items-center justify-center gap-8 backdrop-blur-xl bg-opacity-95">
          {links.map((link) => (
            <Link 
              key={link.name} 
              to={link.path} 
              className="font-['Inter'] text-2xl font-black text-white hover:text-[#5ed29c] transition-colors uppercase tracking-widest"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}
          <Link 
            to="/register" 
            className="mt-4 bg-[#5ed29c] text-[#070b0a] px-10 py-4 rounded-full font-bold text-lg"
            onClick={() => setMobileMenuOpen(false)}
          >
            GET STARTED
          </Link>
        </div>
      )}
    </>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // If logged in already, redirect to meetings
    if (localStorage.getItem('token')) {
      navigate('/meetings');
    }
  }, [navigate]);

  return (
    <>
      <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />

      <main className="relative w-full min-h-screen flex items-center px-6 md:px-[10%] lg:px-[12%] pt-20">
        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center lg:items-start justify-between gap-16 lg:gap-8">
          
          {/* Left Content */}
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left gap-6 pt-12">
            <div className="flex items-center gap-2 font-['Plus_Jakarta_Sans'] font-bold text-[11px] text-[#5ed29c] tracking-[0.2em] uppercase">
              <span className="w-2 h-2 rounded-full bg-[#5ed29c] animate-pulse"></span>
              AI-Powered meeting insight
            </div>
            
            <h1 className="font-['Inter'] font-extrabold text-[44px] md:text-[64px] lg:text-[80px] leading-[0.95] tracking-tighter text-white uppercase max-w-[850px]">
              Master every <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/40">meeting</span>
              <span className="text-[#5ed29c]">.</span>
            </h1>
            
            <p className="font-['Inter'] text-[16px] md:text-[18px] text-white/60 max-w-[540px] leading-relaxed">
              Transform your conversations into actionable intelligence. Real-time transcription, Llama3 summarization, and searchable archives for every discussion.
            </p>
            
            <div className="mt-4 flex flex-col sm:flex-row items-center gap-6">
              <Link to="/register" className="group relative flex items-center gap-3 bg-[#5ed29c] hover:bg-[#4bc28a] text-[#070b0a] font-['Plus_Jakarta_Sans'] font-bold uppercase text-[14px] px-10 py-5 rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(94,210,156,0.3)] hover:shadow-[0_0_40px_rgba(94,210,156,0.5)]">
                Start Recording
                <ArrowRight size={18} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <Link to="/login" className="font-['Inter'] font-bold text-white/80 hover:text-white transition-colors border-b border-white/20 hover:border-white py-1">
                View Dashboard
              </Link>
            </div>
          </div>

          {/* Right Floating Card */}
          <div className="flex-shrink-0 lg:mt-32">
            <LiquidGlassCard />
          </div>
          
        </div>
      </main>

      {/* Decorative Waveform - Subtle Bottom Left */}
      <div className="absolute bottom-[-50px] left-[-20px] opacity-20 pointer-events-none z-0 flex items-end gap-1 px-10">
        {Array.from({length: 20}).map((_, i) => (
          <div key={i} className="w-1 bg-[#5ed29c] rounded-full transition-all duration-700" 
               style={{ height: `${20 + Math.random() * 100}px`, animation: `pulse-height ${2 + Math.random() * 2}s infinite alternate ease-in-out` }}></div>
        ))}
      </div>

      <style>{`
        @keyframes pulse-height {
          0% { height: 20px; opacity: 0.3; }
          100% { height: 120px; opacity: 0.8; }
        }
      `}</style>
    </>
  );
}
