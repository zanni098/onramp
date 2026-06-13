import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Copy, Loader, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price_usd: number;
  created_at: string;
}

const Products = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [revenueByProduct, setRevenueByProduct] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  // Bumped after a successful create to re-run the fetch effect.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchProducts = async () => {
      const [prodRes, txnRes] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('merchant_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('transactions')
          .select('product_id, amount_usd, status')
          .eq('merchant_id', user.id)
          .eq('status', 'confirmed')
          .limit(2000),
      ]);
      if (prodRes.error) {
        console.error('products query failed:', prodRes.error);
        toast.error('Could not load products. Try refreshing.');
        setLoading(false);
        return;
      }
      // Revenue is decoration here — a failed query just hides the badges.
      const rev = new Map<string, number>();
      for (const t of txnRes.data ?? []) {
        if (!t.product_id) continue;
        rev.set(t.product_id, (rev.get(t.product_id) ?? 0) + (t.amount_usd ?? 0));
      }
      setRevenueByProduct(rev);
      setProducts(prodRes.data ?? []);
      setLoading(false);
    };
    fetchProducts();
  }, [user, refreshKey]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return toast.error('Name and price are required');
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) return toast.error('Enter a valid price');
    setSaving(true);
    // Write both representations: `price_minor` is the canonical 6-decimal
    // integer used by the server-side verifier (USDC/USDT have 6dp), and
    // `price_usd` is kept for the legacy/display path. Round to whole cents
    // first so the trailing 4 digits stay zero — Polygon checkout encodes
    // a per-session reference suffix into those digits.
    const cents = Math.round(parsedPrice * 100);
    const priceMinor = cents * 10000; // cents * 10^4 = 6dp minor units
    const { error } = await supabase.from('products').insert({
      merchant_id: user!.id,
      name,
      description: description || null,
      price_usd: parsedPrice,
      price_minor: priceMinor,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Product created');
    setName(''); setDescription(''); setPrice('');
    setCreateOpen(false);
    setRefreshKey(k => k + 1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
    if (error) return toast.error(error.message);
    toast.success('Product deleted');
    setProducts(prev => prev.filter(p => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const copyCheckoutLink = (productId: string) => {
    const url = `${window.location.origin}/checkout/${productId}`;
    navigator.clipboard.writeText(url);
    toast.success('Checkout link copied');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin text-white" size={26} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl">Products</h1>
          <p className="text-sub text-sm mt-0.5">
            Every product is a shareable checkout link.
          </p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="glow-button inline-flex items-center gap-2">
          <Plus size={15} /> New product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="glow-card">
          <EmptyState
            variant="products"
            title="No products yet"
            body="Create a product to mint a checkout link you can drop into an invoice, a DM, or anywhere a client can click."
            action={
              <button onClick={() => setCreateOpen(true)} className="glow-button inline-flex items-center gap-2">
                <Plus size={15} /> Create your first product
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {products.map((p) => (
            <div key={p.id} className="glow-card p-5 flex flex-col group">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="text-[15px] truncate">{p.name}</h3>
                <button
                  onClick={() => setDeleteTarget(p)}
                  className="p-1.5 -m-1.5 rounded-lg text-muted hover:text-down hover:bg-down/10 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Delete ${p.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {p.description && (
                <p className="text-[13px] text-sub line-clamp-2 mb-3">{p.description}</p>
              )}
              <div className="mt-auto">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <div className="text-[22px] font-semibold tabular-nums text-white">
                    ${p.price_usd.toFixed(2)}
                  </div>
                  {(revenueByProduct.get(p.id) ?? 0) > 0 && (
                    <span className="okx-chip okx-chip-up" title="Lifetime settled revenue">
                      +${revenueByProduct.get(p.id)!.toFixed(2)} earned
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted mb-4">
                  Added {new Date(p.created_at).toLocaleDateString()}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyCheckoutLink(p.id)}
                    className="glow-button-secondary flex-1 inline-flex items-center justify-center gap-2"
                  >
                    <Copy size={13} /> Copy link
                  </button>
                  <a
                    href={`/checkout/${p.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="glow-button-secondary inline-flex items-center justify-center px-3"
                    aria-label="Open checkout"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create modal ── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New product"
        subtitle="Name it, price it, share the link"
        width={440}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-[13px] text-sub mb-1.5">Name</label>
            <input
              className="glass-input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Landing page build"
              maxLength={120}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[13px] text-sub mb-1.5">
              Description <span className="text-muted">(optional)</span>
            </label>
            <input
              className="glass-input w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What the client is paying for"
              maxLength={240}
            />
          </div>
          <div>
            <label className="block text-[13px] text-sub mb-1.5">Price (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
              <input
                className="glass-input w-full pl-8 tabular-nums"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="250.00"
                inputMode="decimal"
              />
            </div>
            <p className="text-[11px] text-muted mt-1.5">
              Paid in USDC (Solana) or USDT (Polygon) at $1 = 1 token.
            </p>
          </div>
          <button type="submit" disabled={saving} className="glow-button w-full flex items-center justify-center gap-2">
            {saving ? <Loader size={15} className="animate-spin" /> : <Plus size={15} />}
            Create product
          </button>
        </form>
      </Modal>

      {/* ── Delete confirm ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete product?"
        width={400}
      >
        <p className="text-sub text-[13px] leading-relaxed mb-5">
          <span className="text-white font-medium">{deleteTarget?.name}</span> will be
          removed and its checkout link will stop working immediately. Past
          transactions are kept.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            className="flex-1 rounded-lg bg-down text-white font-semibold px-5 py-2.5 text-sm hover:bg-down/85 transition"
          >
            Delete
          </button>
          <button onClick={() => setDeleteTarget(null)} className="glow-button-secondary flex-1">
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Products;
