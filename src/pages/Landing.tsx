import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Lock, Globe, Shield, CheckCircle, Menu, X } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

const VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4';
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');`;

const TXS = [
  { amount: '250.00',   coin: 'USDC', net: 'Solana',  time: '2s ago' },
  { amount: '1,200.00', coin: 'USDT', net: 'Polygon', time: '14s ago' },
  { amount: '89.99',    coin: 'USDC', net: 'Solana',  time: '31s ago' },
  { amount: '5,000.00', coin: 'USDT', net: 'Polygon', time: '1m ago' },
  { amount: '300.00',   coin: 'USDC', net: 'Solana',  time: '2m ago' },
];

const FEATURES = [
  { icon: <Lock size={20}/>,   title: 'Non-Custodial',      body: 'Funds land directly in your wallet. We never hold, touch, or control your money.' },
  { icon: <Zap size={20}/>,    title: 'Instant Settlement',  body: 'Blockchain finality in seconds. No 3–5 day bank holds, no chargebacks.' },
  { icon: <Globe size={20}/>,  title: 'No Borders',          body: 'No LLC. No ITIN. No SSN. Accept payments from any country, any client.' },
  { icon: <Shield size={20}/>, title: 'Zero Hidden Fees',    body: 'Pay only network gas. No monthly plans, no percentage cuts, no surprises.' },
];

const STEPS = [
  { n: '01', title: 'Create a Product',   body: 'Add a product name, description, and price in USD from your dashboard.' },
  { n: '02', title: 'Share Your Link',    body: 'Copy the checkout link and send it to your client — email, WhatsApp, anywhere.' },
  { n: '03', title: 'Get Paid On-Chain', body: 'Client connects their wallet and pays in USDC or USDT. Hits your wallet in seconds.' },
];

export default function Landing() {
  const [scrolled,    setScrolled]    = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  void useState(0); // txIdx unused but keep ticker cycling
  const isMobile = useMobile();

  useEffect(() => {
    const fn = () => { setScrolled(window.scrollY > 40); };
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // close menu on nav click
  const closeMenu = () => setMenuOpen(false);

  return (
    <div style={{ fontFamily: "'Syne', sans-serif", background: '#000', color: '#fff', overflowX: 'hidden' }}>
      <style>{FONTS}</style>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: 'fixed', top: isMobile ? 0 : 16, left: 0, right: 0, zIndex: 100,
        padding: isMobile ? '0' : '0 24px',
      }}>
        {/* Desktop pill nav */}
        {!isMobile && (
          <div className="liquid-glass" style={{
            maxWidth: 1100, margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 24px', borderRadius: 9999,
            background: scrolled ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.04)',
            transition: 'background 0.3s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#0070F3,#7c3aed)', flexShrink: 0 }}/>
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff' }}>onramp</span>
            </div>
            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              {[['How it works','#how-it-works'],['Networks','#networks'],['Pricing','#pricing']].map(([l,h]) => (
                <a key={l} href={h} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e=>(e.currentTarget.style.color='#fff')}
                  onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.55)')}
                >{l}</a>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link to="/login" style={{ padding: '8px 18px', borderRadius: 9999, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.65)', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.2s' }}
                onMouseEnter={e=>{ e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='rgba(255,255,255,0.3)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.color='rgba(255,255,255,0.65)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; }}
              >Log in</Link>
              <Link to="/register" className="liquid-glass-strong" style={{ padding: '8px 18px', borderRadius: 9999, fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none', transition: 'all 0.2s' }}
                onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.04)')}
                onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')}
              >Get Started</Link>
            </div>
          </div>
        )}

        {/* Mobile top bar */}
        {isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            background: scrolled || menuOpen ? 'rgba(0,0,0,0.9)' : 'transparent',
            backdropFilter: scrolled || menuOpen ? 'blur(20px)' : 'none',
            borderBottom: menuOpen ? '1px solid rgba(255,255,255,0.06)' : 'none',
            transition: 'background 0.3s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#0070F3,#7c3aed)' }}/>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>onramp</span>
            </div>
            <button onClick={() => setMenuOpen(v => !v)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
              {menuOpen ? <X size={22}/> : <Menu size={22}/>}
            </button>
          </div>
        )}

        {/* Mobile dropdown */}
        {isMobile && menuOpen && (
          <div style={{
            background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '16px 20px 28px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {[['How it works','#how-it-works'],['Networks','#networks'],['Pricing','#pricing']].map(([l,h]) => (
              <a key={l} href={h} onClick={closeMenu} style={{
                color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 500,
                textDecoration: 'none', padding: '12px 4px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>{l}</a>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Link to="/login" onClick={closeMenu} style={{
                flex: 1, textAlign: 'center', padding: '12px', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.15)', color: '#fff',
                textDecoration: 'none', fontWeight: 600, fontSize: 14,
              }}>Log in</Link>
              <Link to="/register" onClick={closeMenu} style={{
                flex: 1, textAlign: 'center', padding: '12px', borderRadius: 12,
                background: '#fff', color: '#000',
                textDecoration: 'none', fontWeight: 700, fontSize: 14,
              }}>Get Started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
        <video autoPlay loop muted playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
          src={VIDEO_URL}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1 }}/>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 200, background: 'linear-gradient(to bottom, transparent, #000)', zIndex: 2, pointerEvents: 'none' }}/>

        <div style={{
          position: 'relative', zIndex: 3,
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          padding: isMobile ? '130px 24px 80px' : '0 24px',
          paddingTop: isMobile ? 130 : 200,
          paddingBottom: isMobile ? 80 : 120,
        }}>
          {/* Badge */}
          <div className="liquid-glass animate-fade-rise" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 5px 5px 14px', borderRadius: 9999, marginBottom: 28,
          }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Live on Solana &amp; Polygon</span>
            <span style={{ background: '#fff', color: '#000', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 9999 }}>New</span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-rise-d1" style={{
            fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
            fontSize: isMobile ? 52 : 'clamp(52px, 8vw, 110px)',
            fontWeight: 400, lineHeight: 0.97, letterSpacing: '-0.03em',
            maxWidth: isMobile ? '100%' : 900, marginBottom: 24, color: '#fff',
          }}>
            Get Paid.<br/>
            <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.38)' }}>No Borders.</em><br/>
            No Permission.
          </h1>

          {/* Sub */}
          <p className="animate-fade-rise-d2" style={{
            fontSize: isMobile ? 15 : 18, color: 'rgba(255,255,255,0.55)',
            maxWidth: isMobile ? '100%' : 440, lineHeight: 1.7, marginBottom: 36,
          }}>
            Accept USDC &amp; USDT directly to your wallet. Non-custodial, instant settlement, zero paperwork — built for developers everywhere Stripe won't go.
          </p>

          {/* CTAs */}
          <div className="animate-fade-rise-d3" style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: 12, alignItems: 'center', width: isMobile ? '100%' : 'auto',
          }}>
            <Link to="/register" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              padding: '14px 8px 14px 24px', borderRadius: 9999,
              background: '#fff', color: '#000', fontWeight: 700, fontSize: 15,
              textDecoration: 'none', transition: 'all 0.25s',
              width: isMobile ? '100%' : 'auto',
            }}
              onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.03)'; e.currentTarget.style.boxShadow='0 0 28px rgba(255,255,255,0.2)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}
            >
              Start Accepting Payments
              <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#0070F3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ArrowRight size={16} color="#fff"/>
              </span>
            </Link>
            <a href="#how-it-works" className="liquid-glass-strong" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px 22px', borderRadius: 9999,
              color: 'rgba(255,255,255,0.75)', fontWeight: 600, fontSize: 15,
              textDecoration: 'none', transition: 'color 0.2s',
              width: isMobile ? '100%' : 'auto',
            }}
              onMouseEnter={e=>(e.currentTarget.style.color='#fff')}
              onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.75)')}
            >See how it works</a>
          </div>

          {/* Stats */}
          <div className="liquid-glass animate-fade-rise-d3" style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? '20px 32px' : 48,
            marginTop: 52, padding: isMobile ? '20px 28px' : '20px 40px',
            borderRadius: 20, animationDelay: '0.55s',
            width: isMobile ? '100%' : 'auto',
          }}>
            {[['0%','Platform fees'],['<3s','Settlement'],['2','Networks'],['∞','Countries']].map(([v,l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: isMobile ? 20 : 22, fontWeight: 500, color: '#fff', lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{l}</div>
              </div>
            ))}
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
                <span key={i} style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
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
      <section style={{ padding: isMobile ? '60px 20px' : '100px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 24, padding: isMobile ? '32px 24px' : '60px',
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? 36 : 60, alignItems: 'center',
        }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#60a5fa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Why we built this</div>
            <h2 style={{
              fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
              fontSize: isMobile ? 34 : 'clamp(30px, 3.5vw, 52px)', fontWeight: 400,
              letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 16, color: '#fff',
            }}>
              Stripe doesn't serve<br/>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>70% of the world.</span>
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.75, color: 'rgba(255,255,255,0.5)' }}>
              We built Onramp because we needed it. No LLC, no ITIN, no SSN — no Stripe. Meanwhile clients in the US and EU have money ready to pay. The gap isn't technical. It's paperwork.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { x: '❌', t: 'Stripe — Not available in Pakistan, Nigeria, Bangladesh...' },
              { x: '❌', t: 'PayPal — Withdrawal blocked or heavily restricted' },
              { x: '❌', t: 'US LLC workaround — $500–$2,000/yr + weeks of setup' },
              { x: '✅', t: "Onramp — A wallet address. That's it." },
            ].map(({ x, t }) => (
              <div key={t} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 16px', borderRadius: 12,
                background: x === '✅' ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${x === '✅' ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{x}</span>
                <span style={{ fontSize: 13, color: x === '✅' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ padding: isMobile ? '60px 20px 80px' : '80px 40px 100px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 40 : 60 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#60a5fa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>How it works</div>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: isMobile ? 32 : 'clamp(30px, 3.5vw, 52px)', fontWeight: 400, color: '#fff' }}>Three steps to your first payment</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
          {STEPS.map((s, i) => (
            <div key={s.n} style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 20, padding: isMobile ? '28px 24px' : '36px 32px',
              position: 'relative', overflow: 'hidden', transition: 'border-color 0.3s, transform 0.3s',
            }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(0,112,243,0.4)'; e.currentTarget.style.transform='translateY(-4px)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.transform='translateY(0)'; }}
            >
              <div style={{ position: 'absolute', top: -10, right: 16, fontFamily: "'DM Mono', monospace", fontSize: 80, fontWeight: 700, color: 'rgba(255,255,255,0.04)', lineHeight: 1, pointerEvents: 'none' }}>{s.n}</div>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(0,112,243,0.1)', border: '1px solid rgba(0,112,243,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, fontFamily: "'DM Mono', monospace", fontSize: 14, color: '#60a5fa', fontWeight: 500 }}>{String(i+1).padStart(2,'0')}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8, color: '#fff' }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>{s.body}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 36 }}>
          <Link to="/register" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: 9999,
            background: '#fff', color: '#000', fontWeight: 700, fontSize: 15, textDecoration: 'none', transition: 'all 0.2s',
          }}
            onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.boxShadow='0 0 24px rgba(255,255,255,0.18)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}
          >Try it free <ArrowRight size={15}/></Link>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="networks" style={{ padding: isMobile ? '60px 20px 80px' : '80px 40px 100px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 36 : 52 }}>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: isMobile ? 32 : 'clamp(30px, 3.5vw, 52px)', fontWeight: 400, color: '#fff' }}>Built different</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 14, marginBottom: 14 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 18, padding: isMobile ? '24px' : '30px', display: 'flex', gap: 16,
              transition: 'border-color 0.3s, background 0.3s',
            }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(0,112,243,0.3)'; e.currentTarget.style.background='rgba(0,112,243,0.04)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.background='rgba(255,255,255,0.02)'; }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: 'rgba(0,112,243,0.1)', border: '1px solid rgba(0,112,243,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>{f.icon}</div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#fff' }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>{f.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
          {[
            { name: 'Solana', coin: 'USDC', color: '#9945ff', symbol: '◎', desc: 'Sub-second finality, near-zero fees. The fastest stablecoin settlement on the planet.' },
            { name: 'Polygon', coin: 'USDT', color: '#8247e5', symbol: '⬡', desc: 'EVM-compatible, widely supported. Your clients with MetaMask are already ready.' },
          ].map(n => (
            <div key={n.name} style={{ background: `${n.color}08`, border: `1px solid ${n.color}28`, borderRadius: 18, padding: isMobile ? '22px' : '28px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: `${n.color}18`, border: `1px solid ${n.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{n.symbol}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{n.name}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: n.color, background: `${n.color}22`, padding: '2px 8px', borderRadius: 9999 }}>{n.coin}</span>
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.65 }}>{n.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: isMobile ? '60px 20px 80px' : '80px 40px 100px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 36 : 52 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#60a5fa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Pricing</div>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: isMobile ? 32 : 'clamp(30px, 3.5vw, 52px)', fontWeight: 400, color: '#fff' }}>Simple. Honest. Free.</h2>
        </div>
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,112,243,0.3)', borderRadius: 24, padding: isMobile ? '36px 28px' : '48px', textAlign: 'center', boxShadow: '0 0 60px rgba(0,112,243,0.07)' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#60a5fa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Free forever</div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 68, fontWeight: 400, color: '#fff', lineHeight: 1 }}>$0</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 32, marginTop: 8 }}>No monthly fees. No percentage cut. Pay only network gas.</div>
            {['Unlimited products','Unlimited transactions','Solana USDC + Polygon USDT','Webhook notifications','Dashboard & analytics','API access'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, textAlign: 'left' }}>
                <CheckCircle size={15} color="#4ade80"/>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>{f}</span>
              </div>
            ))}
            <Link to="/register" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 28, padding: '14px 28px', borderRadius: 9999,
              background: '#fff', color: '#000', fontWeight: 700, fontSize: 15,
              textDecoration: 'none', transition: 'all 0.2s',
            }}
              onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.03)'; e.currentTarget.style.boxShadow='0 0 24px rgba(255,255,255,0.18)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}
            >Get started free <ArrowRight size={15}/></Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: isMobile ? '40px 20px 80px' : '60px 40px 120px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,112,243,0.08) 0%, rgba(124,58,237,0.06) 100%)',
          border: '1px solid rgba(0,112,243,0.2)', borderRadius: 24,
          padding: isMobile ? '48px 28px' : '80px 60px',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 200, background: 'radial-gradient(ellipse, rgba(0,112,243,0.12), transparent)', filter: 'blur(40px)', pointerEvents: 'none' }}/>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{
              fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
              fontSize: isMobile ? 36 : 'clamp(32px, 4vw, 60px)', fontWeight: 400,
              letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 16, color: '#fff',
            }}>
              Your wallet is the bank.<br/>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>Start using it.</span>
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: 'rgba(255,255,255,0.5)', marginBottom: 36, maxWidth: 400, margin: '0 auto 36px' }}>Set up in under 5 minutes. No approval process. No borders.</p>
            <Link to="/register" style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              padding: '15px 10px 15px 26px', borderRadius: 9999,
              background: '#fff', color: '#000', fontWeight: 700, fontSize: isMobile ? 15 : 17,
              textDecoration: 'none', transition: 'all 0.25s',
            }}
              onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.boxShadow='0 0 36px rgba(255,255,255,0.22)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}
            >
              Create Free Account
              <span style={{ width: 38, height: 38, borderRadius: '50%', background: '#0070F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowRight size={17} color="#fff"/>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: isMobile ? '28px 20px' : '32px 40px',
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
        gap: isMobile ? 20 : 0,
        maxWidth: 1100, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #0070F3, #7c3aed)' }}/>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>onramp</span>
        </div>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Non-custodial · No borders · Open source</span>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Privacy','Terms','GitHub'].map(l => (
            <a key={l} href="#" style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e=>(e.currentTarget.style.color='rgba(255,255,255,0.7)')}
              onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.3)')}
            >{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
