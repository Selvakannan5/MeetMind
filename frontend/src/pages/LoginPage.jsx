import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Mail, Lock } from 'lucide-react';
import { login, googleLogin } from '../utils/api';
import WaveformAnimation from '../components/landing/WaveformAnimation';
import { useGoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      localStorage.setItem('token', res.data.access_token);
      navigate('/meetings');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const googleLoginHandler = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      try {
        const res = await googleLogin(tokenResponse.access_token);
        localStorage.setItem('token', res.data.access_token);
        navigate('/meetings');
      } catch (err) {
        setError(err.response?.data?.detail || 'Google Login Failed');
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('Google Login Failed'),
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <div className="w-full max-w-[440px] p-8 md:p-10 liquid-glass-card shadow-2xl space-y-8">
        
        {/* Top Branding & Animation */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-br from-[#6c63ff] to-[#00d4aa] rounded-bl-xl rounded-tr-xl flex items-center justify-center shadow-[0_0_20px_rgba(108,99,255,0.3)]">
               <div className="w-2.5 h-2.5 bg-black rounded-full shadow-[0_0_8px_white]"></div>
             </div>
             <div className="font-['Inter'] font-black text-2xl tracking-tighter text-white uppercase">
               MeetMind
             </div>
          </div>
          <WaveformAnimation />
          <h2 className="text-[24px] font-bold tracking-tight text-white/90">
            Welcome back <span className="font-['Instrument_Serif'] italic font-normal text-[#5ed29c]">Expert</span>
          </h2>
          <p className="text-[14px] text-white/50 font-['Inter']">
            Sign in to access your meeting intelligence.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-[13px] animate-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#5ed29c] transition-colors" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 focus:border-[#5ed29c]/50 text-white rounded-xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-white/10"
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Password</label>
              <a href="#" className="text-[11px] text-[#5ed29c]/60 hover:text-[#5ed29c] transition-colors">Forgot?</a>
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#5ed29c] transition-colors" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 focus:border-[#5ed29c]/50 text-white rounded-xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-white/10"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#5ed29c] hover:bg-[#4bc28a] text-[#070b0a] font-bold uppercase text-[14px] py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(94,210,156,0.2)]"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-[11px] uppercase tracking-widest">
            <span className="bg-[#070b0a] px-4 text-white/30 backdrop-blur-sm rounded-full border border-white/5">Or continue with</span>
          </div>
        </div>

        {/* Google Login Button */}
        <button
          onClick={() => googleLoginHandler()}
          className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91C16.65 13.98 18 11.81 18 9.24z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33C2.43 15.89 5.5 18 9 18z"/>
            <path fill="#FBBC05" d="M3.97 10.72A5.405 5.405 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.95A8.995 8.995 0 0 0 0 9c0 1.45.35 2.82.95 4.05l3.02-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.5 0 2.43 2.11.95 5.08L3.97 7.4c.71-2.12 2.69-3.7 5.03-3.7z"/>
          </svg>
          Google
        </button>

        <p className="text-center text-[13px] text-white/40">
          New to MeetMind? <Link to="/register" className="text-[#5ed29c] font-bold hover:underline">Create account</Link>
        </p>

      </div>
    </div>
  );
}
