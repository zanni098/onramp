import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useMobile } from '../hooks/useMobile';

const VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4';
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Syne:wght@400;500;600;700;800&display=swap');`;

export default function Login() {
  const navigate  = useNavigate();
  const isMobile  = useMobile();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please fill in all fields');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Welcome back!');
    navigate('/dashboard');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px', borderRadius: 12,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', fontSize: 15, outline: 'none', transition: 'border-color 0.2s',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };

  const Form = (
    <div style={{
      width: isMobile ? '100%' : 480, flexShrink: 0,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: isMobile ? '40px 24px 60px' : '60px 56px',
      borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.06)',
    }}>
      <Link to="/" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 40, transition: 'color 0.2s' }}
        onMouseEnter={e=>(e.currentTarget.style.color='rgba(255,255,255,0.7)')}
        onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.35)')}
      >← Back to onramp</Link>

      {/* Logo (mobile only) */}
      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#0070F3,#7c3aed)' }}/>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>onramp</span>
        </div>
      )}

      <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: '-0.03em' }}>Welcome back</h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>Sign in to your merchant account</p>

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle}
            onFocus={e=>(e.target.style.borderColor='rgba(255,255,255,0.35)')}
            onBlur={e=>(e.target.style.borderColor='rgba(255,255,255,0.1)')}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={inputStyle}
            onFocus={e=>(e.target.style.borderColor='rgba(255,255,255,0.35)')}
            onBlur={e=>(e.target.style.borderColor='rgba(255,255,255,0.1)')}
          />
        </div>
        <button type="submit" disabled={loading} style={{
          marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '14px 24px', borderRadius: 9999,
          background: loading ? 'rgba(255,255,255,0.5)' : '#fff',
          color: '#000', fontWeight: 700, fontSize: 15,
          border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s', fontFamily: 'inherit', width: '100%',
        }}
          onMouseEnter={e=>{ if (!loading) { e.currentTarget.style.transform='scale(1.02)'; e.currentTarget.style.boxShadow='0 0 24px rgba(255,255,255,0.18)'; }}}
          onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}
        >
          {loading ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }}/> Signing in…</> : <>Sign in <ArrowRight size={16}/></>}
        </button>
      </form>

      <div style={{ marginTop: 28, paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
        Don't have an account?{' '}
        <Link to="/register" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none' }}>Create one free</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', overflow: 'hidden', fontFamily: "'Syne', sans-serif", flexDirection: isMobile ? 'column' : 'row' }}>
      <style>{FONTS}</style>

      {/* On mobile: video hero at top, form below. On desktop: video left, form right */}
      {isMobile ? (
        <>
          {/* Mobile video header */}
          <div style={{ position: 'relative', height: 240, flexShrink: 0 }}>
            <video autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} src={VIDEO_URL}/>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}/>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to bottom, transparent, #000)', pointerEvents: 'none' }}/>
            <div style={{ position: 'absolute', bottom: 28, left: 24, zIndex: 1 }}>
              <h2 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 28, fontWeight: 400, color: '#fff', lineHeight: 1.1 }}>
                The world's payment<br/><span style={{ color: 'rgba(255,255,255,0.4)' }}>infrastructure.</span>
              </h2>
            </div>
          </div>
          {Form}
        </>
      ) : (
        <>
          {/* Desktop: video panel left */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
            <video autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} src={VIDEO_URL}/>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}/>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 60%, #000)', pointerEvents: 'none' }}/>
            <div style={{ position: 'relative', zIndex: 1, padding: '48px', maxWidth: 460 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#0070F3,#7c3aed)' }}/>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>onramp</span>
              </div>
              <h2 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: 400, color: '#fff', lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 14 }}>
                The world's payment<br/><span style={{ color: 'rgba(255,255,255,0.4)' }}>infrastructure.</span>
              </h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>Non-custodial · Instant settlement · No borders</p>
            </div>
          </div>
          {Form}
        </>
      )}
    </div>
  );
}
