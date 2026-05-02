import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Lock, Globe, Shield, ChevronDown, CheckCircle } from 'lucide-react';

const FONT_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');

  * { box-sizing: border-box; }

  @keyframes fade-up {
    from { opacity: 0; transform: translateY(28px); filter: blur(4px); }
    to   { opacity: 1; transform: translateY(0);    filter: blur(0);   }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(-1deg); }
    50%       { transform: translateY(-18px) rotate(1deg); }
  }
  @keyframes float2 {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-12px); }
  }
  @keyframes pulse-ring {
    0%   { transform: scale(1);   opacity: 0.6; }
    100% { transform: scale(2.2); opacity: 0;   }
  }
  @keyframes glow-pulse {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1;   }
  }
  @keyframes scroll-x {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes scan-line {
    0%   { top: 0%;   opacity: 1; }
    95%  { top: 100%; opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes count-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
  @keyframes border-glow {
    0%, 100% { border-color: rgba(0,112,243,0.2); box-shadow: 0 0 0px rgba(0,112,243,0); }
    50%       { border-color: rgba(0,112,243,0.6); box-shadow: 0 0 20px rgba(0,112,243,0.15); }
  }

  .au { animation: fade-up  0.7s cubic-bezier(0.16,1,0.3,1) both; }
  .ai { animation: fade-in  0.5s ease-out both; }
  .fl { animation: float    7s ease-in-out infinite; }
  .fl2 { animation: float2  5s ease-in-out infinite; }
  .bgl { animation: border-glow 3s ease-in-out infinite; }

  .dot-grid {
    background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px);
    background-size: 28px 28px;
  }
  .ticker-wrap { overflow: hidden; }
  .ticker { display: flex; animation: scroll-x 22s linear infinite; white-space: nowrap; }
`;

const TXS = [
  { amount: '250.00', coin: 'USDC', net: 'Solana',  time: '2s ago' },
  { amount: '1,200.00', coin: 'USDT', net: 'Polygon', time: '14s ago' },
  { amount: '89.99',  coin: 'USDC', net: 'Solana',  time: '31s ago' },
  { amount: '5,000.00', coin: 'USDT', net: 'Polygon', time: '1m ago' },
  { amount: '300.00', coin: 'USDC', net: 'Solana',  time: '2m ago' },
];

const FEATURES = [
  { icon: <Lock size={20}/>, title: 'Non-Custodial', body: 'Funds land directly in your wallet. We never hold, touch, or control your money.' },
  { icon: <Zap  size={20}/>, title: 'Instant Settlement', body: 'Blockchain finality in seconds. No 3–5 day bank holds, no chargebacks.' },
  { icon: <Globe size={20}/>, title: 'No Borders', body: 'No LLC. No ITIN. No SSN. Accept payments from any country, any client.' },
  { icon: <Shield size={20}/>, title: 'Zero Hidden Fees', body: 'Pay only network gas. No monthly plans, no percentage cuts, no surprises.' },
];

const STEPS = [
  { n: '01', title: 'Create a Product', body: 'Add a product name, description, and price in USD from your dashboard.' },
  { n: '02', title: 'Share Your Link', body: 'Copy the checkout link and send it to your client — email, WhatsApp, anywhere.' },
  { n: '03', title: 'Get Paid On-Chain', body: 'Client connects their wallet and pays in USDC or USDT. Hits your wallet in seconds.' },
];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [txIdx, setTxIdx] = useState(0);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTxIdx(i => (i + 1) % TXS.length), 2800);
    return () => clearInterval(t);
  }, []);

  const tx = TXS[txIdx];

  return (
    <div style={{ fontFamily: "'Syne', sans-serif", background: '#000', color: '#fff', overflowX: 'hidden' }}>
      <style>{FONT_STYLE}</style>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        padding: '20px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(0,0,0,0.8)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #0070F3, #7c3aed)',
            position: 'relative', flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'inherit', animation: 'pulse-ring 2s ease-out infinite',
            }}/>
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em' }}>onramp</span>
        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 36, alignItems: 'center' }} className="hidden-mobile">
          {['How it works','Networks','Pricing'].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g,'-')}`}
              style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: 500,
                textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color='#fff')}
              onMouseLeave={e => (e.currentTarget.style.color='rgba(255,255,255,0.55)')}
            >{l}</a>
          ))}
        </div>

        {/* Right CTAs */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link to="/login" style={{
            padding: '9px 20px', borderRadius: 100, fontSize: 14, fontWeight: 600,
            color: 'rgba(255,255,255,0.7)', textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.12)',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='rgba(255,255,255,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'; }}
          >Log in</Link>
          <Link to="/register" style={{
            padding: '9px 20px', borderRadius: 100, fontSize: 14, fontWeight: 700,
            background: '#fff', color: '#000', textDecoration: 'none',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform='scale(1.03)'; e.currentTarget.style.boxShadow='0 0 20px rgba(255,255,255,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}
          >Get Started</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', alignItems: 'center',
        padding: '0 40px', paddingTop: 100,
      }}>
        {/* Dot grid bg */}
        <div className="dot-grid" style={{ position: 'absolute', inset: 0, zIndex: 0 }}/>

        {/* Gradient orbs */}
        <div style={{
          position: 'absolute', top: '-10%', left: '20%',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,112,243,0.15) 0%, transparent 70%)',
          filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
          animation: 'glow-pulse 4s ease-in-out infinite',
        }}/>
        <div style={{
          position: 'absolute', bottom: '-10%', right: '10%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
          filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
          animation: 'glow-pulse 5s ease-in-out infinite 1s',
        }}/>

        <div style={{
          maxWidth: 1200, margin: '0 auto', width: '100%',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60,
          alignItems: 'center', position: 'relative', zIndex: 1,
        }}>

          {/* LEFT – Text */}
          <div>
            {/* Badge */}
            <div className="au" style={{ animationDelay: '0s',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 100,
              background: 'rgba(0,112,243,0.1)', border: '1px solid rgba(0,112,243,0.25)',
              fontSize: 12, fontWeight: 600, color: '#60a5fa',
              letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 28,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa',
                animation: 'glow-pulse 1.5s ease-in-out infinite' }}/>
              Live on Solana &amp; Polygon
            </div>

            <h1 className="au" style={{
              animationDelay: '0.1s',
              fontSize: 'clamp(42px, 5.5vw, 80px)',
              fontWeight: 800, lineHeight: 1.0,
              letterSpacing: '-0.04em', marginBottom: 24,
            }}>
              Get Paid.<br/>
              <span style={{
                background: 'linear-gradient(135deg, #fff 0%, #93c5fd 50%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>No Borders.<br/>No Permission.</span>
            </h1>

            <p className="au" style={{
              animationDelay: '0.25s',
              fontSize: 18, lineHeight: 1.7,
              color: 'rgba(255,255,255,0.55)', maxWidth: 440, marginBottom: 36,
            }}>
              Accept USDC &amp; USDT directly to your wallet. Non-custodial, instant settlement, zero paperwork — built for developers everywhere Stripe won't go.
            </p>

            {/* CTAs */}
            <div className="au" style={{ animationDelay: '0.4s', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/register" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '14px 8px 14px 22px', borderRadius: 100,
                background: '#fff', color: '#000',
                fontWeight: 700, fontSize: 16, textDecoration: 'none',
                transition: 'all 0.25s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.boxShadow='0 0 30px rgba(255,255,255,0.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}
              >
                Start Accepting Payments
                <span style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#0070F3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ArrowRight size={16} color="#fff"/>
                </span>
              </Link>

              <a href="#how-it-works" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '14px 20px', borderRadius: 100,
                color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 16,
                textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='rgba(255,255,255,0.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.6)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; }}
              >
                See how it works <ChevronDown size={16}/>
              </a>
            </div>

            {/* Social proof */}
            <div className="au" style={{ animationDelay: '0.55s', marginTop: 36, display: 'flex', gap: 24 }}>
              {[['0%','Platform fees'],['<3s','Settlement time'],['2','Networks']].map(([v,l]) => (
                <div key={l}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 500, color: '#fff' }}>{v}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT – Floating payment card */}
          <div className="fl" style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>

            {/* Main card */}
            <div className="bgl au" style={{
              animationDelay: '0.3s',
              background: 'rgba(10,10,10,0.9)',
              border: '1px solid rgba(0,112,243,0.2)',
              borderRadius: 24, padding: '28px 28px',
              width: '100%', maxWidth: 380,
              backdropFilter: 'blur(20px)',
              boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.05)',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Scan line effect */}
              <div style={{
                position: 'absolute', left: 0, right: 0, height: 2,
                background: 'linear-gradient(90deg, transparent, rgba(0,112,243,0.4), transparent)',
                animation: 'scan-line 3s ease-in-out infinite',
              }}/>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
                  letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" }}>
                  Payment Received
                </span>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 600, color: '#4ade80',
                  background: 'rgba(74,222,128,0.1)', padding: '4px 10px', borderRadius: 100,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80',
                    animation: 'glow-pulse 1s infinite' }}/>
                  Confirmed
                </span>
              </div>

              {/* Amount - cycles through TXS */}
              <div key={txIdx} style={{ marginBottom: 20, animation: 'count-up 0.4s ease-out both' }}>
                <div style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 42, fontWeight: 500, lineHeight: 1,
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(135deg, #fff, rgba(255,255,255,0.7))',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  {tx.amount}
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                  {tx.coin} · {tx.net}
                </div>
              </div>

              {/* Network badge */}
              <div style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: 12,
                padding: '12px 16px', marginBottom: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Network</span>
                <span style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 13, fontWeight: 500, color: '#fff',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%',
                    background: tx.net === 'Solana' ? '#9945ff' : '#8247e5' }}/>
                  {tx.net}
                </span>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: 12,
                padding: '12px 16px', marginBottom: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Settled</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#4ade80' }}>
                  {tx.time}
                </span>
              </div>

              <div style={{
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
                marginBottom: 16,
              }}/>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={14} color="#4ade80"/>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  Funds sent directly to your wallet
                </span>
              </div>
            </div>

            {/* Floating badge 1 */}
            <div className="fl2" style={{
              position: 'absolute', top: -16, right: -20,
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
              padding: '10px 16px', animationDelay: '0.5s',
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Platform fee</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 500, color: '#4ade80' }}>0%</div>
            </div>

            {/* Floating badge 2 */}
            <div className="fl2" style={{
              position: 'absolute', bottom: -12, left: -20,
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
              padding: '10px 16px', animationDelay: '1.2s',
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>No KYC</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color: '#93c5fd' }}>
                Just a wallet
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div style={{
        background: 'rgba(0,112,243,0.06)',
        borderTop: '1px solid rgba(0,112,243,0.15)',
        borderBottom: '1px solid rgba(0,112,243,0.15)',
        padding: '14px 0', overflow: 'hidden',
      }}>
        <div className="ticker">
          {[...Array(2)].map((_, r) => (
            <div key={r} style={{ display: 'flex', gap: 48, paddingRight: 48 }}>
              {TXS.concat(TXS).map((t, i) => (
                <span key={i} style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 13, color: 'rgba(255,255,255,0.45)',
                  display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap',
                }}>
                  <CheckCircle size={12} color="#4ade80"/>
                  <span style={{ color: '#fff', fontWeight: 500 }}>{t.amount} {t.coin}</span>
                  via {t.net}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── PROBLEM ── */}
      <section style={{ padding: '100px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 24, padding: '60px 64px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center',
        }}>
          <div>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: 11,
              color: '#60a5fa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16,
            }}>Why we built this</div>
            <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', fontWeight: 800,
              letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 20 }}>
              Stripe doesn't serve<br/>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>70% of the world.</span>
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: 'rgba(255,255,255,0.5)' }}>
              We built Onramp because we needed it. No LLC, no ITIN, no SSN — no Stripe. Meanwhile clients in the US and EU have money ready to pay. The gap isn't technical. It's paperwork.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { x: '❌', t: 'Stripe — Not available in Pakistan, Nigeria, Bangladesh...' },
              { x: '❌', t: 'PayPal — Withdrawal blocked or heavily restricted' },
              { x: '❌', t: 'US LLC workaround — $500–$2,000/yr + weeks of setup' },
              { x: '✅', t: 'Onramp — A wallet address. That\'s it.' },
            ].map(({ x, t }) => (
              <div key={t} style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                padding: '14px 18px', borderRadius: 12,
                background: x === '✅' ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${x === '✅' ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{x}</span>
                <span style={{ fontSize: 14, color: x === '✅' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ padding: '80px 40px 100px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11,
            color: '#60a5fa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            How it works
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', fontWeight: 800,
            letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Three steps to your first payment
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {STEPS.map((s, i) => (
            <div key={s.n} style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 20, padding: '36px 32px',
              position: 'relative', overflow: 'hidden',
              transition: 'border-color 0.3s, transform 0.3s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(0,112,243,0.4)'; e.currentTarget.style.transform='translateY(-4px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.transform='translateY(0)'; }}
            >
              {/* Step number watermark */}
              <div style={{
                position: 'absolute', top: -10, right: 16,
                fontFamily: "'DM Mono', monospace",
                fontSize: 80, fontWeight: 700, lineHeight: 1,
                color: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
              }}>{s.n}</div>

              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'rgba(0,112,243,0.1)',
                border: '1px solid rgba(0,112,243,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20, fontFamily: "'DM Mono', monospace",
                fontSize: 14, color: '#60a5fa', fontWeight: 500,
              }}>{String(i + 1).padStart(2, '0')}</div>

              <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 }}>{s.title}</h3>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="networks" style={{ padding: '80px 40px 100px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', fontWeight: 800,
            letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Built different
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 20, padding: '36px',
              display: 'flex', gap: 20,
              transition: 'border-color 0.3s, background 0.3s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(0,112,243,0.3)'; e.currentTarget.style.background='rgba(0,112,243,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.background='rgba(255,255,255,0.02)'; }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: 'rgba(0,112,243,0.1)', border: '1px solid rgba(0,112,243,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#60a5fa',
              }}>{f.icon}</div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>{f.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Networks */}
        <div style={{
          marginTop: 20, background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '36px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
        }}>
          {[
            { name: 'Solana', coin: 'USDC', color: '#9945ff', desc: 'Sub-second finality, near-zero fees. The fastest stablecoin settlement on the planet.' },
            { name: 'Polygon', coin: 'USDT', color: '#8247e5', desc: 'EVM-compatible, widely supported. Your clients with MetaMask are already ready.' },
          ].map(n => (
            <div key={n.name} style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: '24px',
              border: `1px solid rgba(${n.name === 'Solana' ? '153,69,255' : '130,71,229'},0.15)`,
              display: 'flex', gap: 16, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: `${n.color}22`,
                border: `1px solid ${n.color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>
                {n.name === 'Solana' ? '◎' : '⬡'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{n.name}</span>
                  <span style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 11,
                    color: n.color, background: `${n.color}20`,
                    padding: '2px 8px', borderRadius: 100,
                  }}>{n.coin}</span>
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>{n.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '80px 40px 120px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,112,243,0.1) 0%, rgba(124,58,237,0.08) 100%)',
          border: '1px solid rgba(0,112,243,0.2)',
          borderRadius: 28, padding: '80px 64px',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          {/* Glow */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 400, height: 200,
            background: 'radial-gradient(ellipse, rgba(0,112,243,0.15), transparent)',
            filter: 'blur(40px)', pointerEvents: 'none',
          }}/>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 56px)', fontWeight: 800,
              letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 18 }}>
              Your wallet is the bank.<br/>
              <span style={{
                background: 'linear-gradient(135deg, #93c5fd, #a78bfa)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>Start using it.</span>
            </h2>

            <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', marginBottom: 40, maxWidth: 440, margin: '0 auto 40px' }}>
              Set up in under 5 minutes. No approval process. No borders.
            </p>

            <Link to="/register" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '16px 10px 16px 28px', borderRadius: 100,
              background: '#fff', color: '#000',
              fontWeight: 700, fontSize: 17, textDecoration: 'none',
              transition: 'all 0.25s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.boxShadow='0 0 40px rgba(255,255,255,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}
            >
              Create Free Account
              <span style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#0070F3', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ArrowRight size={18} color="#fff"/>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '32px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        maxWidth: 1200, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%',
            background: 'linear-gradient(135deg, #0070F3, #7c3aed)' }}/>
          <span style={{ fontWeight: 700, fontSize: 15 }}>onramp</span>
        </div>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
          Non-custodial · No borders · Open source
        </span>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Privacy','Terms','GitHub'].map(l => (
            <a key={l} href="#" style={{
              fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'none',
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color='rgba(255,255,255,0.7)')}
              onMouseLeave={e => (e.currentTarget.style.color='rgba(255,255,255,0.3)')}
            >{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
