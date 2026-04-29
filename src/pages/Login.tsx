import React from 'react';
import { Link } from 'react-router-dom';

const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <div className="absolute top-0 w-full h-[500px] bg-accent/10 blur-[150px] pointer-events-none -z-10" />
      <div className="glow-card p-10 w-full max-w-md">
        <h2 className="text-3xl mb-6 text-center">Welcome Back</h2>
        <div className="space-y-4">
          <input className="glass-input w-full" type="email" placeholder="Email" />
          <input className="glass-input w-full" type="password" placeholder="Password" />
          <button className="glow-button w-full mt-4">Sign In</button>
        </div>
        <p className="text-center text-sm text-zinc-500 mt-6">
          Don't have an account? <Link to="/register" className="text-white hover:text-accent">Register</Link>
        </p>
      </div>
    </div>
  );
};
export default Login;
