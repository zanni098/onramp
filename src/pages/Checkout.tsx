import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader, AlertCircle, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price_usd: number;
  merchant_id: string;
}

interface MerchantWallets {
  solana_wallet: string | null;
  polygon_wallet: string | null;
}

type Network = 'solana' | 'polygon';
type PaymentStep = 'select' | 'connecting' | 'awaiting' | 'confirming';

const Checkout = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [wallets, setWallets] = useState<MerchantWallets | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [network, setNetwork] = useState<Network>('solana');
  const [step, setStep] = useState<PaymentStep>('select');
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [_txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    const fetch = async () => {
      const { data: prod } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();
      if (!prod) { setNotFound(true); setLoading(false); return; }
      setProduct(prod);

      const { data: profile } = await supabase
        .from('profiles')
        .select('solana_wallet, polygon_wallet')
        .eq('id', prod.merchant_id)
        .single();
      setWallets(profile);
      setLoading(false);
    };
    fetch();
  }, [productId]);

  const connectPhantom = async () => {
    setStep('connecting');
    try {
      const phantom = (window as any).solana;
      if (!phantom?.isPhantom) {
        toast.error('Phantom wallet not found. Please install it from phantom.app');
        setStep('select');
        return;
      }
      const resp = await phantom.connect();
      setConnectedWallet(resp.publicKey.toString());
      setStep('awaiting');
      toast.success('Wallet connected');
    } catch {
      toast.error('Connection cancelled');
      setStep('select');
    }
  };

  const connectMetaMask = async () => {
    setStep('connecting');
    try {
      const eth = (window as any).ethereum;
      if (!eth) {
        toast.error('MetaMask not found. Please install it from metamask.io');
        setStep('select');
        return;
      }
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      setConnectedWallet(accounts[0]);
      setStep('awaiting');
      toast.success('Wallet connected');
    } catch {
      toast.error('Connection cancelled');
      setStep('select');
    }
  };

  const handleConnect = () => {
    if (network === 'solana') connectPhantom();
    else connectMetaMask();
  };

  const handleSendPayment = async () => {
    if (!product || !wallets || !connectedWallet) return;
    const destinationWallet = network === 'solana' ? wallets.solana_wallet : wallets.polygon_wallet;
    if (!destinationWallet) {
      toast.error('Merchant has not configured a wallet for this network');
      return;
    }

    setStep('confirming');
    toast('Confirm the transaction in your wallet…', { icon: '🔐' });

    try {
      let hash: string | null = null;

      if (network === 'solana') {
        // Solana USDC transfer via Phantom
        const phantom = (window as any).solana;
        if (!phantom) throw new Error('Phantom not available');

        const { Connection, PublicKey, Transaction } = await import('@solana/web3.js');
        const { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');

        const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

        const fromPubkey = new PublicKey(connectedWallet);
        const toPubkey = new PublicKey(destinationWallet);

        const fromATA = await getAssociatedTokenAddress(USDC_MINT, fromPubkey);
        const toATA = await getAssociatedTokenAddress(USDC_MINT, toPubkey);
        const amount = Math.round(product.price_usd * 1_000_000); // USDC has 6 decimals

        const tx = new Transaction().add(
          createTransferInstruction(fromATA, toATA, fromPubkey, amount, [], TOKEN_PROGRAM_ID)
        );
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromPubkey;

        const signed = await phantom.signAndSendTransaction(tx);
        hash = signed.signature;

      } else {
        // Polygon USDT transfer via MetaMask
        const { ethers } = await import('ethers');
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();

        const USDT_POLYGON = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
        const ERC20_ABI = [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function decimals() view returns (uint8)',
        ];
        const token = new ethers.Contract(USDT_POLYGON, ERC20_ABI, signer);
        const decimals = await token.decimals();
        const amount = ethers.parseUnits(product.price_usd.toString(), decimals);
        const txResp = await token.transfer(destinationWallet, amount);
        hash = txResp.hash;
      }

      if (!hash) throw new Error('No transaction hash returned');
      setTxHash(hash);

      // Record transaction in Supabase
      await supabase.from('transactions').insert({
        merchant_id: product.merchant_id,
        product_id: product.id,
        amount_usd: product.price_usd,
        network,
        tx_hash: hash,
        payer_address: connectedWallet,
        status: 'pending',
      });

      navigate('/success');
    } catch (err: any) {
      toast.error(err?.message ?? 'Transaction failed');
      setStep('awaiting');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader className="animate-spin text-accent" size={32} />
    </div>
  );

  if (notFound || !product) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="mx-auto mb-4 text-red-400" size={40} />
        <h2 className="text-2xl text-white mb-2">Product not found</h2>
        <p className="text-zinc-500">This checkout link may be invalid or expired.</p>
      </div>
    </div>
  );

  const networkDisabled = network === 'solana' ? !wallets?.solana_wallet : !wallets?.polygon_wallet;

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 relative">
      <div className="absolute top-0 w-full h-[500px] bg-accent/5 blur-[150px] pointer-events-none -z-10" />
      <div className="glow-card max-w-md w-full p-10 space-y-8">

        <div className="text-center">
          <h2 className="text-3xl font-serif text-white mb-1">{product.name}</h2>
          {product.description && <p className="text-zinc-500 text-sm">{product.description}</p>}
        </div>

        <div className="bg-black/40 rounded-2xl p-6 border border-zinc-800 text-center">
          <div className="text-5xl text-white mb-1 font-serif">${product.price_usd.toFixed(2)}</div>
          <p className="text-zinc-500 text-sm">USD · paid in stablecoins</p>
        </div>

        {/* Network selector */}
        {step === 'select' && (
          <div>
            <p className="text-sm text-zinc-400 mb-3">Select network</p>
            <div className="grid grid-cols-2 gap-3">
              {(['solana', 'polygon'] as Network[]).map(n => (
                <button
                  key={n}
                  onClick={() => setNetwork(n)}
                  className={`py-3 rounded-xl border text-sm font-medium capitalize transition ${
                    network === n
                      ? 'border-accent bg-accent/10 text-white'
                      : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {n === 'solana' ? '⬡ Solana · USDC' : '⬡ Polygon · USDT'}
                </button>
              ))}
            </div>
            {networkDisabled && (
              <p className="text-xs text-yellow-500 mt-2">Merchant has not enabled this network.</p>
            )}
          </div>
        )}

        {/* CTA button */}
        {step === 'select' && (
          <button
            onClick={handleConnect}
            disabled={networkDisabled}
            className="glow-button w-full flex items-center justify-center gap-2 py-3 disabled:opacity-40"
          >
            <Wallet size={16} /> Connect Wallet
          </button>
        )}

        {step === 'connecting' && (
          <div className="flex items-center justify-center gap-3 py-4 text-zinc-400">
            <Loader size={18} className="animate-spin" /> Connecting wallet…
          </div>
        )}

        {step === 'awaiting' && (
          <div className="space-y-4">
            <div className="bg-black/40 rounded-xl p-4 border border-zinc-800">
              <p className="text-xs text-zinc-500 mb-1">Connected wallet</p>
              <p className="font-mono text-sm text-white">
                {connectedWallet?.slice(0, 8)}…{connectedWallet?.slice(-6)}
              </p>
            </div>
            <button
              onClick={handleSendPayment}
              className="glow-button w-full flex items-center justify-center gap-2 py-3"
            >
              Pay ${product.price_usd.toFixed(2)}
            </button>
            <button
              onClick={() => { setStep('select'); setConnectedWallet(null); }}
              className="glow-button-secondary w-full text-sm py-2"
            >
              Use different wallet
            </button>
          </div>
        )}

        {step === 'confirming' && (
          <div className="flex flex-col items-center gap-3 py-4 text-zinc-400">
            <Loader size={24} className="animate-spin text-accent" />
            <p>Waiting for blockchain confirmation…</p>
            <p className="text-xs text-zinc-600">Do not close this window</p>
          </div>
        )}

        <p className="text-center text-xs text-zinc-600">
          Non-custodial · Funds go directly to merchant wallet
        </p>
      </div>
    </div>
  );
};

export default Checkout;
