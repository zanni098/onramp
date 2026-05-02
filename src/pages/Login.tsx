import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';

const VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4';

export default function Login() {
  const navigate  = useNavigate();
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

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', overflow: 'hidden', fontFamily: "'Syne', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Syne:wght@400;500;600;700;800&display=swap');`}</style>

      {/* Left — video panel */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
        <video autoPlay loop muted playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          src={VIDEO_URL}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}/>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, transparent 60%, #000)',
          pointerEvents: 'none',
        }}/>

        {/* Logo & tagline over video */}
        <div style={{ position: 'relative', zIndex: 1, padding: '48px', maxWidth: 460 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg,#0070F3,#7c3aed)',
            }}/>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>onramp</span>
          </div>
          <h2 style={{
            fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
            fontSize: 'clamp(36px, 4vw, 56px)', fontWeight: 400,
            color: '#fff', lineHeight: 1.05, letterSpacing: '-0.02em',
            marginBottom: 16,
          }}>
            The world's payment<br/>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>infrastructure.</span>
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
            Non-custodial · Instant settlement · No borders
          </p>
        </div>
      </div>

      {/* Right — form panel */}
      <div style={{
        width: 480, flexShrink: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 56px',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Back to site */}
        <Link to="/" style={{
          fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 48,
          transition: 'color 0.2s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color='rgba(255,255,255,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color='rgba(255,255,255,0.35)')}
        >
          ← Back to onramp
        </Link>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: '-0.03em' }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 36 }}>
          Sign in to your merchant account
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%', padding: '13px 16px', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
                fontFamily: 'inherit',
              }}
              onFocus={e => (e.target.style.borderColor='rgba(255,255,255,0.3)')}
              onBlur={e =>  (e.target.style.borderColor='rgba(255,255,255,0.1)')}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '13px 16px', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
                fontFamily: 'inherit',
              }}
              onFocus={e => (e.target.style.borderColor='rgba(255,255,255,0.3)')}
              onBlur={e =>  (e.target.style.borderColor='rgba(255,255,255,0.1)')}
            />
          </div>

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '14px 24px', borderRadius: 9999,
              background: loading ? 'rgba(255,255,255,0.5)' : '#fff',
              color: '#000', fontWeight: 700, fontSize: 15,
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform='scale(1.02)'; e.currentTarget.style.boxShadow='0 0 24px rgba(255,255,255,0.2)'; }}}
            onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}
          >
            {loading
              ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }}/> Signing in…</>
              : <>Sign in <ArrowRight size={16}/></>
            }
          </button>
        </form>

        <div style={{ marginTop: 32, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none' }}>
            Create one free
          </Link>
        </div>
      </div>
    </div>
  );
}
