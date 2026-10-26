import React, { useState } from 'react';
import { registerUser } from '../services/api';

export default function Register({ switchToLogin }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await registerUser({ username, email, password, role });
      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => switchToLogin(), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm w-full max-w-md">
      <div className="mb-6">
        <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Onboarding</span>
        <h2 className="text-2xl font-bold text-zinc-900 mt-1">Create Account</h2>
        <p className="text-sm text-slate-500">Register as an Employee/Student or Manager.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-xs font-medium">{error}</div>}
      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg mb-4 text-xs font-medium">{success}</div>}
      
      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Username</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none"
            required 
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Email Address</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none" 
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none"
            required 
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Role Selection</label>
          <select 
            value={role} 
            onChange={(e) => setRole(e.target.value)} 
            className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-sm focus:ring-2 focus:ring-red-600 focus:outline-none"
          >
            <option value="student">Employee / Student</option>
            <option value="manager">Manager / Admin</option>
          </select>
        </div>
        <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold transition shadow-sm">
          Register Account
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">
        Already have an account?{' '}
        <button onClick={switchToLogin} className="text-red-600 font-bold hover:underline">Sign in here</button>
      </p>
    </div>
  );
}