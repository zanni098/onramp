import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Loader, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4';

const PERKS = [
  'No platform fees — ever',
  'Solana USDC + Polygon USDT',
  'Funds go straight to your wallet',
  'Live in under 5 minutes',
];

export default function Register() {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [loading,      setLoading]      = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName || !email || !password) return toast.error('Please fill in all fields');
    if (password.length < 8) return toast.error('Password must be at least 8 characters');
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setLoading(false); return toast.error(error.message); }

    if (data.user) {
      const publicKey      = 'pk_live_' + crypto.randomUUID().replace(/-/g,'').slice(0,24);
      const secretKey      = 'sk_live_' + crypto.randomUUID().replace(/-/g,'').slice(0,24);
      const webhookSecret  = 'whsec_'   + crypto.randomUUID().replace(/-/g,'');

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        business_name: businessName,
        public_key: publicKey,
        secret_key: secretKey,
        webhook_secret: webhookSecret,
      });

      if (profileError) { setLoading(false); return toast.error('Account created but profile setup failed.'); }
    }

    setLoading(false);
    toast.success('Welcome to Onramp!');
    navigate('/dashboard');
  };

  const inputStyle = {
    width: '100%', padding: '13px 16px', borderRadius: 12,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', overflow: 'hidden', fontFamily: "'Syne', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Syne:wght@400;500;600;700;800&display=swap');`}</style>

      {/* Left — form panel */}
      <div style={{
        width: 500, flexShrink: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 56px',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Link to="/" style={{
          fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 48,
          transition: 'color 0.2s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color='rgba(255,255,255,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color='rgba(255,255,255,0.35)')}
        >← Back to onramp</Link>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%',
            background: 'linear-gradient(135deg,#0070F3,#7c3aed)' }}/>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>onramp</span>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: '-0.03em' }}>
          Create your account
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>
          Start accepting stablecoin payments in minutes
        </p>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Business Name', type: 'text',     val: businessName, set: setBusinessName, ph: 'Your company or project name' },
            { label: 'Email',         type: 'email',    val: email,        set: setEmail,        ph: 'you@example.com' },
            { label: 'Password',      type: 'password', val: password,     set: setPassword,     ph: '8+ characters' },
          ].map(({ label, type, val, set, ph }) => (
            <div key={label}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                {label}
              </label>
              <input
                type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor='rgba(255,255,255,0.3)')}
                onBlur={e =>  (e.target.style.borderColor='rgba(255,255,255,0.1)')}
              />
            </div>
          ))}

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
              ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }}/> Creating account…</>
              : <>Create free account <ArrowRight size={16}/></>
            }
          </button>
        </form>

        <div style={{ marginTop: 28, paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>

      {/* Right — video + perks */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
        <video autoPlay loop muted playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          src={VIDEO_URL}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}/>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to left, transparent 60%, #000)',
          pointerEvents: 'none',
        }}/>

        <div style={{ position: 'relative', zIndex: 1, padding: '52px', maxWidth: 480 }}>
          <h2 style={{
            fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
            fontSize: 'clamp(32px, 3.5vw, 48px)', fontWeight: 400,
            color: '#fff', lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 32,
          }}>
            No borders.<br/>
            No permission.<br/>
            <span style={{ color: 'rgba(255,255,255,0.35)' }}>Just payments.</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {PERKS.map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckCircle size={14} color="#4ade80"/>
                </div>
                <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
