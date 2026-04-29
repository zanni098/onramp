import React, { useState } from 'react';
import { useParams } from 'react-router-dom';

const Checkout = () => {
  const { productId } = useParams();
  const [chain, setChain] = useState('SOLANA');

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-0 w-full h-[500px] bg-accent/5 blur-[150px] pointer-events-none -z-10" />
      <div className="glow-card max-w-md w-full space-y-8 p-10">
        <div>
          <h2 className="text-center text-3xl font-serif text-white">
            Complete Payment
          </h2>
          <p className="mt-2 text-center text-sm text-zinc-400">
            Product #{productId}
          </p>
        </div>
        <div className="bg-black/40 rounded-2xl p-6 border border-zinc-800 text-center">
             <div className="text-5xl text-white mb-2">$99.00 <span className="text-lg text-zinc-500 text-top">USD</span></div>
             <p className="text-zinc-500">~99 USDC</p>
        </div>
        <div className="space-y-4">
          <button className="glow-button w-full flex justify-center py-3">
             Connect Wallet
          </button>
        </div>
      </div>
    </div>
  );
};
export default Checkout;
