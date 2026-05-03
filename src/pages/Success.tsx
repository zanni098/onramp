import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, AlertCircle, Loader, ExternalLink } from 'lucide-react';
import { fetchSession } from '../lib/api';

// /success?session=<uuid>
//
// We do NOT trust the navigation — we re-read the session from the DB and
// reflect its real status. If a user shares this URL or refreshes, they see
// the truth, not a hardcoded "thank you" message.

interface SessionRow {
  id: string;
  status: 'awaiting_payment' | 'confirming' | 'confirmed' | 'failed' | 'expired';
  network: 'solana' | 'polygon';
  amount_minor: number;
  tx_hash: string | null;
  failure_reason: string | null;
  confirmed_at: string | null;
}

const Success = () => {
  const [params] = useSearchParams();
  const sessionId = params.get('session');
  const [session, setSession] = useState<SessionRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setError('Missing session id');
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const s = (await fetchSession(sessionId)) as SessionRow;
        if (!alive) return;
        setSession(s);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? 'Could not load session');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <Center>
        <Loader className="animate-spin text-accent" size={32} />
      </Center>
    );
  }

  if (error || !session) {
    return (
      <Center>
        <Card>
          <AlertCircle className="mx-auto mb-4 text-red-400" size={40} />
          <h2 className="text-2xl text-white mb-2">Session not found</h2>
          <p className="text-zinc-500">{error ?? 'No session matched that id.'}</p>
          <Link to="/" className="glow-button inline-block mt-8">
            Return Home
          </Link>
        </Card>
      </Center>
    );
  }

  if (session.status === 'confirmed') {
    return (
      <Center>
        <Card>
          <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto border border-success">
            <Check className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-4xl text-white font-serif mt-4">Payment Confirmed</h2>
          <p className="text-zinc-400 mt-2">
            ${(session.amount_minor / 1_000_000).toFixed(2)} confirmed on-chain.
          </p>
          {session.tx_hash && (
            <a
              href={explorerUrl(session.network, session.tx_hash)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent inline-flex items-center gap-1 mt-3"
            >
              View transaction <ExternalLink size={12} />
            </a>
          )}
          <Link to="/" className="glow-button inline-block mt-8">
            Return Home
          </Link>
        </Card>
      </Center>
    );
  }

  if (session.status === 'failed' || session.status === 'expired') {
    return (
      <Center>
        <Card>
          <AlertCircle className="mx-auto mb-4 text-red-400" size={40} />
          <h2 className="text-2xl text-white mb-2">
            Payment {session.status}
          </h2>
          <p className="text-zinc-500">
            {session.failure_reason ?? `This checkout ${session.status}.`}
          </p>
          <Link to="/" className="glow-button inline-block mt-8">
            Return Home
          </Link>
        </Card>
      </Center>
    );
  }

  // Still awaiting / confirming — they shouldn't normally land here, but if
  // they did, we don't lie to them.
  return (
    <Center>
      <Card>
        <Loader className="mx-auto mb-4 animate-spin text-accent" size={32} />
        <h2 className="text-2xl text-white mb-2">Awaiting confirmation</h2>
        <p className="text-zinc-500">
          Your payment is still being confirmed on-chain. This page will update
          once it's final.
        </p>
      </Card>
    </Center>
  );
};

export default Success;

const Center = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    {children}
  </div>
);

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-md w-full text-center space-y-4">{children}</div>
);

function explorerUrl(network: 'solana' | 'polygon', hash: string) {
  if (network === 'solana') return `https://solscan.io/tx/${hash}`;
  return `https://polygonscan.com/tx/${hash}`;
}
