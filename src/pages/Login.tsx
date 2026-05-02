import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please fill in all fields');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Welcome back!');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <div className="absolute top-0 w-full h-[500px] bg-accent/10 blur-[150px] pointer-events-none -z-10" />
      <form onSubmit={handleLogin} className="glow-card p-10 w-full max-w-md">
        <h2 className="text-3xl mb-6 text-center">Welcome Back</h2>
        <div className="space-y-4">
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
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button type="submit" disabled={loading} className="glow-button w-full mt-4 disabled:opacity-50">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </div>
        <p className="text-center text-sm text-zinc-500 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-white hover:text-accent">Register</Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
