import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader, AlertCircle, Wallet, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  createCheckoutSession,
  verifyPayment,
  type CheckoutSession,
} from '../lib/api';

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------
//
// The checkout state machine mirrors the server's. We never invent transitions;
// the server is the source of truth. Local-only states ('select','connecting',
// 'submitting') are pre-server states that exist before a session is created
// or before a tx_hash has been broadcast.

type Network = 'solana' | 'polygon';

type UiStep =
  | 'select'             // user picking network / not yet connected
  | 'connecting'         // wallet popup open
  | 'creating_session'   // POST /create-checkout-session in flight
  | 'awaiting_payment'   // session exists; waiting for user to click pay
  | 'submitting'         // wallet signing / broadcasting
  | 'confirming'         // tx broadcast; polling verify-payment
  | 'confirmed'
  | 'failed'
  | 'expired';

interface ProductDisplay {
  id: string;
  name: string;
  description: string | null;
  price_usd: number;             // display only — never used for charging
  merchant_id: string;
}

interface MerchantDisplay {
  solana_wallet: string | null;
  polygon_wallet: string | null;
}

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_MS = 10 * 60 * 1000; // 10 minutes hard cap on the client

const Checkout = () => {
  const { productId } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState<ProductDisplay | null>(null);
  const [wallets, setWallets] = useState<MerchantDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [network, setNetwork] = useState<Network>('solana');
  const [step, setStep] = useState<UiStep>('select');
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);

  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  // Cancel in-flight polls if the component unmounts.
  const pollAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => pollAbortRef.current?.abort(), []);

  // ---- Load product (display only). The server re-validates everything. ----
  //
  // We use SECURITY DEFINER RPCs that take a UUID arg and return at most one
  // row, NOT direct table SELECTs. The unguessable product UUID is the
  // capability token — an anon caller without the id cannot enumerate any
  // merchant's catalog.
  useEffect(() => {
    if (!productId) return;
    (async () => {
      const { data: prodRows } = await supabase
        .rpc('get_product_for_checkout', { p_id: productId });
      const prod = Array.isArray(prodRows) ? prodRows[0] : prodRows;
      if (!prod) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProduct(prod as ProductDisplay);
      // Privacy-preserving: we only get a {has_solana, has_polygon} pair
      // from the server, never the raw wallet addresses. The actual
      // destination wallet comes back from create-checkout-session, which
      // is server-authoritative.
      const { data: netsRows } = await supabase
        .rpc('get_merchant_supported_networks', { p_id: prod.merchant_id });
      const nets = Array.isArray(netsRows) ? netsRows[0] : netsRows;
      setWallets({
        solana_wallet: nets?.has_solana ? '__configured__' : null,
        polygon_wallet: nets?.has_polygon ? '__configured__' : null,
      });
      setLoading(false);
    })();
  }, [productId]);

  // -------------------------------------------------------------------------
  // Wallet connect
  // -------------------------------------------------------------------------

  const connectPhantom = async () => {
    setStep('connecting');
    try {
      const phantom = (window as any).solana;
      if (!phantom?.isPhantom) {
        toast.error('Phantom wallet not found. Install it from phantom.app');
        setStep('select');
        return;
      }
      const resp = await phantom.connect();
      setConnectedWallet(resp.publicKey.toString());
      await openSession('solana');
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
        toast.error('MetaMask not found. Install it from metamask.io');
        setStep('select');
        return;
      }
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      setConnectedWallet(accounts[0]);
      // Also nudge to Polygon mainnet (chainId 0x89). Best-effort; ignore if user declines.
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x89' }],
        });
      } catch { /* user may decline; verifier will reject wrong-chain txs */ }
      await openSession('polygon');
    } catch {
      toast.error('Connection cancelled');
      setStep('select');
    }
  };

  const handleConnect = () => {
    if (network === 'solana') connectPhantom();
    else connectMetaMask();
  };

  // -------------------------------------------------------------------------
  // Open a server-authoritative checkout session
  // -------------------------------------------------------------------------

  const openSession = async (net: Network) => {
    if (!product) return;
    setStep('creating_session');
    try {
      const s = await createCheckoutSession({ product_id: product.id, network: net });
      setSession(s);
      setStep('awaiting_payment');
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not open checkout session');
      setStep('select');
    }
  };

  // -------------------------------------------------------------------------
  // Sending payment — server-issued amount/destination/reference are sacred.
  // -------------------------------------------------------------------------

  const handleSendPayment = async () => {
    if (!session || !connectedWallet) return;
    setStep('submitting');
    setFailureReason(null);
    toast('Confirm in your wallet…', { icon: '🔐' });

    try {
      const hash =
        session.network === 'solana'
          ? await sendSolanaPayment(session, connectedWallet)
          : await sendPolygonPayment(session, connectedWallet);

      if (!hash) throw new Error('No transaction hash returned');
      setTxHash(hash);
      setStep('confirming');
      pollUntilTerminal(session.session_id, hash);
    } catch (err: any) {
      toast.error(err?.message ?? 'Transaction failed');
      setStep('awaiting_payment');
    }
  };

  // -------------------------------------------------------------------------
  // Poll verify-payment until the session reaches a terminal state.
  // -------------------------------------------------------------------------

  const pollUntilTerminal = async (sessionId: string, hash: string) => {
    pollAbortRef.current?.abort();
    const ac = new AbortController();
    pollAbortRef.current = ac;

    const start = Date.now();
    while (!ac.signal.aborted) {
      if (Date.now() - start > POLL_MAX_MS) {
        setFailureReason('timed out waiting for confirmation; refresh to retry');
        setStep('failed');
        return;
      }
      try {
        const r = await verifyPayment({ session_id: sessionId, tx_hash: hash });
        if (r.status === 'confirmed') {
          setStep('confirmed');
          // Brief pause so the user sees the success state before the route swap.
          setTimeout(
            () => navigate(`/success?session=${sessionId}`, { replace: true }),
            800,
          );
          return;
        }
        if (r.status === 'failed') {
          setFailureReason(r.reason ?? 'verification failed');
          setStep('failed');
          return;
        }
        if (r.status === 'expired') {
          setStep('expired');
          return;
        }
        // 'pending' or 'confirming' — keep polling.
      } catch (err) {
        // Transient error: keep polling. Verifier endpoint already swallows
        // RPC outages and returns pending.
        // eslint-disable-next-line no-console
        console.warn('verify-payment poll error', err);
      }
      await sleep(POLL_INTERVAL_MS);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-red-400" size={40} />
          <h2 className="text-2xl text-white mb-2">Product not found</h2>
          <p className="text-zinc-500">This checkout link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  const networkDisabled =
    network === 'solana' ? !wallets?.solana_wallet : !wallets?.polygon_wallet;

  const displayAmount = session
    ? (session.amount_minor / 10 ** session.decimals).toFixed(session.decimals)
    : product.price_usd.toFixed(2);

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 relative">
      <div className="absolute top-0 w-full h-[500px] bg-accent/5 blur-[150px] pointer-events-none -z-10" />
      <div className="glow-card max-w-md w-full p-10 space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-serif text-white mb-1">{product.name}</h2>
          {product.description && (
            <p className="text-zinc-500 text-sm">{product.description}</p>
          )}
        </div>

        <div className="bg-black/40 rounded-2xl p-6 border border-zinc-800 text-center">
          <div className="text-5xl text-white mb-1 font-serif">${displayAmount}</div>
          <p className="text-zinc-500 text-sm">
            {session
              ? `${session.token} · ${session.network}`
              : 'USD · paid in stablecoins'}
          </p>
          {session?.network === 'polygon' && (
            <p className="text-xs text-zinc-600 mt-2">
              Pay this exact amount — the trailing digits identify your order.
            </p>
          )}
        </div>

        {step === 'select' && (
          <>
            <div>
              <p className="text-sm text-zinc-400 mb-3">Select network</p>
              <div className="grid grid-cols-2 gap-3">
                {(['solana', 'polygon'] as Network[]).map((n) => (
                  <button
                    key={n}
                    onClick={() => setNetwork(n)}
                    className={`py-3 rounded-xl border text-sm font-medium capitalize transition ${network === n
                        ? 'border-accent bg-accent/10 text-white'
                        : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'
                      }`}
                  >
                    {n === 'solana' ? '⬡ Solana · USDC' : '⬡ Polygon · USDT'}
                  </button>
                ))}
              </div>
              {networkDisabled && (
                <p className="text-xs text-yellow-500 mt-2">
                  Merchant has not enabled this network.
                </p>
              )}
            </div>
            <button
              onClick={handleConnect}
              disabled={networkDisabled}
              className="glow-button w-full flex items-center justify-center gap-2 py-3 disabled:opacity-40"
            >
              <Wallet size={16} /> Connect Wallet
            </button>
          </>
        )}

        {step === 'connecting' && (
          <CenteredSpinner label="Connecting wallet…" />
        )}
        {step === 'creating_session' && (
          <CenteredSpinner label="Preparing secure checkout…" />
        )}

        {step === 'awaiting_payment' && session && (
          <div className="space-y-4">
            <DetailRow label="Connected wallet" value={short(connectedWallet)} />
            <DetailRow
              label="Pay to"
              value={short(session.destination)}
              hint="Server-verified merchant address"
            />
            <button
              onClick={handleSendPayment}
              className="glow-button w-full flex items-center justify-center gap-2 py-3"
            >
              Pay ${displayAmount} {session.token}
            </button>
            <button
              onClick={() => {
                pollAbortRef.current?.abort();
                setSession(null);
                setConnectedWallet(null);
                setStep('select');
              }}
              className="glow-button-secondary w-full text-sm py-2"
            >
              Use different wallet
            </button>
          </div>
        )}

        {step === 'submitting' && (
          <CenteredSpinner label="Awaiting wallet signature…" />
        )}

        {step === 'confirming' && (
          <div className="flex flex-col items-center gap-3 py-4 text-zinc-400">
            <Loader size={24} className="animate-spin text-accent" />
            <p>Waiting for blockchain confirmation…</p>
            {txHash && session && (
              <a
                href={explorerUrl(session.network, txHash)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent inline-flex items-center gap-1"
              >
                View transaction <ExternalLink size={12} />
              </a>
            )}
            <p className="text-xs text-zinc-600">
              You can safely close this tab; we'll keep verifying.
            </p>
          </div>
        )}

        {step === 'confirmed' && (
          <div className="text-center py-4 text-success">
            ✅ Payment confirmed. Redirecting…
          </div>
        )}

        {step === 'failed' && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 text-sm">
            <p className="text-red-300 font-medium mb-1">Payment failed</p>
            <p className="text-zinc-400 text-xs">
              {failureReason ?? 'verification failed'}
            </p>
            {txHash && session && (
              <a
                href={explorerUrl(session.network, txHash)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent inline-flex items-center gap-1 mt-2"
              >
                View transaction <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        {step === 'expired' && (
          <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-4 text-sm text-yellow-200">
            This checkout has expired. Refresh the page to start a new session.
          </div>
        )}

        <p className="text-center text-xs text-zinc-600">
          Non-custodial · Funds go directly to the merchant wallet
        </p>
      </div>
    </div>
  );
};

export default Checkout;

// ---------------------------------------------------------------------------
// Solana payment — SPL transfer + Memo Program instruction binding the tx
// to the server-issued reference. Also creates the destination ATA if it
// does not yet exist (paid by the customer).
// ---------------------------------------------------------------------------

async function sendSolanaPayment(
  session: CheckoutSession,
  payer: string,
): Promise<string> {
  const phantom = (window as any).solana;
  if (!phantom) throw new Error('Phantom not available');

  const {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
  } = await import('@solana/web3.js');
  const {
    getAssociatedTokenAddress,
    createTransferInstruction,
    createAssociatedTokenAccountInstruction,
    TOKEN_PROGRAM_ID,
  } = await import('@solana/spl-token');

  const rpcUrl =
    import.meta.env.VITE_HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_API_KEY}`
      : 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  const mint = new PublicKey(session.token_mint);
  const fromPubkey = new PublicKey(payer);
  const toPubkey = new PublicKey(session.destination);

  const fromATA = await getAssociatedTokenAddress(mint, fromPubkey);
  const toATA = await getAssociatedTokenAddress(mint, toPubkey);

  const tx = new Transaction();

  // Create the destination ATA if it doesn't exist (first-time merchant).
  const toATAInfo = await connection.getAccountInfo(toATA);
  if (!toATAInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        fromPubkey, // payer for the rent
        toATA,
        toPubkey,
        mint,
      ),
    );
  }

  // The actual SPL transfer.
  tx.add(
    createTransferInstruction(
      fromATA,
      toATA,
      fromPubkey,
      BigInt(session.amount_minor),
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  // Memo Program — binds this on-chain tx to the server's session.reference.
  const MEMO_PROGRAM_ID = new PublicKey(
    'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
  );
  tx.add(
    new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: new TextEncoder().encode(`onramp:${session.reference}`) as any,
    }),
  );

  const { blockhash } = await connection.getLatestBlockhash('finalized');
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubkey;

  const signed = await phantom.signAndSendTransaction(tx);
  return signed.signature as string;
}

// ---------------------------------------------------------------------------
// Polygon payment — ERC-20 transfer of the EXACT server-issued amount_minor.
// Reference binding is the sub-cent suffix already encoded in amount_minor.
// ---------------------------------------------------------------------------

async function sendPolygonPayment(
  session: CheckoutSession,
  _payer: string,
): Promise<string> {
  const { ethers } = await import('ethers');
  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();

  // Defensive chain check.
  const net = await provider.getNetwork();
  if (net.chainId !== 137n) {
    throw new Error('Wrong network: switch MetaMask to Polygon (chainId 137)');
  }

  const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];
  const token = new ethers.Contract(session.token_mint, ERC20_ABI, signer);

  const txResp = await token.transfer(
    session.destination,
    BigInt(session.amount_minor),
  );
  return txResp.hash as string;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

const CenteredSpinner = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center gap-3 py-4 text-zinc-400">
    <Loader size={18} className="animate-spin" /> {label}
  </div>
);

const DetailRow = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="bg-black/40 rounded-xl p-4 border border-zinc-800">
    <p className="text-xs text-zinc-500 mb-1">{label}</p>
    <p className="font-mono text-sm text-white">{value}</p>
    {hint && <p className="text-[10px] text-zinc-600 mt-1">{hint}</p>}
  </div>
);

function short(v: string | null | undefined) {
  if (!v) return '—';
  return `${v.slice(0, 8)}…${v.slice(-6)}`;
}

function explorerUrl(network: 'solana' | 'polygon', hash: string) {
  if (network === 'solana') return `https://solscan.io/tx/${hash}`;
  return `https://polygonscan.com/tx/${hash}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
