import React from 'react';
import { Link } from 'react-router-dom';

const Register = () => {
  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <div className="absolute top-0 w-full h-[500px] bg-accent/10 blur-[150px] pointer-events-none -z-10" />
      <div className="glow-card p-10 w-full max-w-md">
        <h2 className="text-3xl mb-6 text-center">Create Account</h2>
        <div className="space-y-4">
          <input className="glass-input w-full" type="text" placeholder="Business Name" />
          <input className="glass-input w-full" type="email" placeholder="Email" />
          <input className="glass-input w-full" type="password" placeholder="Password" />
          <button className="glow-button w-full mt-4">Sign Up</button>
        </div>
        <p className="text-center text-sm text-zinc-500 mt-6">
          Already have an account? <Link to="/login" className="text-white hover:text-accent">Log in</Link>
        </p>
      </div>
    </div>
  );
};
export default Register;
