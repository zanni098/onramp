import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const Register = () => {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName || !email || !password) return toast.error('Please fill in all fields');
    if (password.length < 8) return toast.error('Password must be at least 8 characters');
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setLoading(false); return toast.error(error.message); }

    if (data.user) {
      const publicKey = 'pk_live_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
      const secretKey = 'sk_live_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
      const webhookSecret = 'whsec_' + crypto.randomUUID().replace(/-/g, '');

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        business_name: businessName,
        public_key: publicKey,
        secret_key: secretKey,
        webhook_secret: webhookSecret,
      });

      if (profileError) {
        setLoading(false);
        return toast.error('Account created but profile setup failed.');
      }
    }

    setLoading(false);
    toast.success('Account created! Welcome to Onramp.');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <div className="absolute top-0 w-full h-[500px] bg-accent/10 blur-[150px] pointer-events-none -z-10" />
      <form onSubmit={handleRegister} className="glow-card p-10 w-full max-w-md">
        <h2 className="text-3xl mb-6 text-center">Create Account</h2>
        <div className="space-y-4">
          <input
            className="glass-input w-full"
            type="text"
            placeholder="Business Name"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
          />
          <input
            className="glass-input w-full"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            className="glass-input w-full"
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button type="submit" disabled={loading} className="glow-button w-full mt-4 disabled:opacity-50">
            {loading ? 'Creating account…' : 'Sign Up'}
          </button>
        </div>
        <p className="text-center text-sm text-zinc-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-white hover:text-accent">Log in</Link>
        </p>
      </form>
    </div>
  );
};

export default Register;
