import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Copy, Loader, ExternalLink, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('merchant_id', user!.id)
      .order('created_at', { ascending: false });
    setProducts(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) fetchProducts(); }, [user]);

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
    setName(''); setDescription(''); setPrice(''); setShowForm(false);
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Product deleted');
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const copyCheckoutLink = (productId: string) => {
    const url = `${window.location.origin}/checkout/${productId}`;
    navigator.clipboard.writeText(url);
    toast.success('Checkout link copied');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl">Products</h1>
        <button onClick={() => setShowForm(v => !v)} className="glow-button flex items-center gap-2">
          <Plus size={16} /> New Product
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="glow-card p-8 mb-8 max-w-xl">
          <h3 className="text-xl mb-6">New Product</h3>
          <div className="space-y-4">
            <input className="glass-input w-full" placeholder="Product name" value={name} onChange={e => setName(e.target.value)} />
            <textarea className="glass-input w-full h-24 resize-none" placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
            <input className="glass-input w-full" type="number" step="0.01" min="0.01" placeholder="Price in USD" value={price} onChange={e => setPrice(e.target.value)} />
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="glow-button disabled:opacity-50">
                {saving ? 'Creating…' : 'Create Product'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="glow-button-secondary">Cancel</button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader className="animate-spin text-accent" size={28} /></div>
      ) : products.length === 0 ? (
        <div className="glow-card p-10 text-center text-zinc-500">
          <Package size={40} className="mx-auto mb-4 opacity-30" />
          <p>No products yet. Create your first product to get a checkout link.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map(p => (
            <div key={p.id} className="glow-card p-6 flex items-center justify-between">
              <div>
                <h4 className="text-white font-medium mb-1">{p.name}</h4>
                {p.description && <p className="text-sm text-zinc-500 mb-2">{p.description}</p>}
                <span className="text-accent font-serif text-lg">${p.price_usd.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => copyCheckoutLink(p.id)} className="glow-button-secondary flex items-center gap-2 text-sm">
                  <Copy size={14} /> Copy Link
                </button>
                <a href={`/checkout/${p.id}`} target="_blank" rel="noreferrer" className="glow-button-secondary p-2">
                  <ExternalLink size={14} />
                </a>
                <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Products;
