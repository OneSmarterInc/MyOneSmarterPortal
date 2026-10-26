import React, { useState } from 'react';
import { loginUser } from '../services/api';

export default function Login({ setUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await loginUser({ username, password });
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials or connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm w-full max-w-md">
      <div className="mb-6">
        <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Secure Access</span>
        <h2 className="text-2xl font-bold text-zinc-900 mt-1">Portal Login</h2>
        <p className="text-sm text-slate-500">Sign in to manage attendance and compliance logs.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-xs font-medium">{error}</div>}
      
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Username</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none"
            placeholder="Enter your username"
            required 
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none"
            placeholder="••••••••"
            required 
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-2.5 rounded-lg text-sm font-semibold transition shadow-sm mt-2"
        >
          {loading ? 'Authenticating...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}