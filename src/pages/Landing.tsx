import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Lock, Globe } from 'lucide-react';

const Landing = () => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-accent/20 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Navbar */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-5xl z-50">
        <div className="bg-black/40 backdrop-blur-md rounded-full border border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-serif text-white flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-accent animate-pulse" />
            onramp
          </div>
          <div className="flex gap-4">
            <Link to="/login" className="glow-button-secondary">Login</Link>
            <Link to="/register" className="glow-button">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-48 px-6 pb-24 text-center max-w-5xl mx-auto">
        <h1 className="text-6xl md:text-8xl mb-6">
          The future of <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-white">stablecoin payments.</span>
        </h1>
        <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
          Non-custodial, lightning-fast USDC & USDT gateway for merchants. Zero hidden fees. Instant settlements.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/register" className="glow-button px-8 py-4 text-lg flex items-center gap-2">
            Start Accepting Payments <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Features Preview */}
        <div className="grid md:grid-cols-3 gap-6 mt-32 text-left">
          <div className="glow-card p-8">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
              <Zap className="text-accent w-6 h-6" />
            </div>
            <h3 className="text-2xl mb-3">Instant Settlement</h3>
            <p className="text-zinc-400">Funds go directly to your Solana or Polygon wallet. No middlemen.</p>
          </div>
          <div className="glow-card p-8">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
              <Lock className="text-accent w-6 h-6" />
            </div>
            <h3 className="text-2xl mb-3">Non-Custodial</h3>
            <p className="text-zinc-400">We never touch your money. You own your private keys.</p>
          </div>
          <div className="glow-card p-8">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
              <Globe className="text-accent w-6 h-6" />
            </div>
            <h3 className="text-2xl mb-3">Global Access</h3>
            <p className="text-zinc-400">Accept payments from anyone, anywhere. No borders.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Landing;
