import React, { useState } from 'react';
import { loginUser } from '../services/api';

export default function Login({ setUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleLogin = async e => {
    e.preventDefault(); setLoading(true); setError('');
    try { const res = await loginUser({ username, password }); setUser(res.data); localStorage.setItem('user', JSON.stringify(res.data)); }
    catch (err) { setError(err.response?.data?.error || 'Invalid credentials or connection error.'); }
    finally { setLoading(false); }
  };
  return <div className="grid w-full max-w-[1040px] overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_30px_90px_rgba(22,22,28,.12)] lg:min-h-[540px] lg:grid-cols-[1.05fr_1fr]">
    <section className="relative hidden flex-col justify-between overflow-hidden bg-[#151519] p-12 text-white lg:flex">
      <div className="pointer-events-none absolute -right-28 -top-32 h-96 w-96 rounded-full border-[65px] border-red-600/10"/>
      <div className="pointer-events-none absolute -bottom-40 -left-28 h-96 w-96 rounded-full bg-red-700/10 blur-3xl"/>
      <div className="relative"><div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-[.2em] text-red-200"><span className="h-2 w-2 rounded-full bg-red-500"/>OneSmarter workspace</div><h1 className="mt-12 text-5xl font-extrabold leading-[1.1] tracking-[-.05em]">One place.<br/><span className="text-red-500">Better workdays.</span></h1><p className="mt-6 max-w-sm text-base leading-7 text-zinc-400">Your secure home for attendance, leave management, schedules, and team operations.</p></div>
      <div className="relative flex items-center gap-3 border-t border-white/10 pt-6 text-xs font-medium text-zinc-400"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600/20 text-red-400">✓</span>Built for a simpler, more connected workday.</div>
    </section>
    <section className="flex flex-col justify-center px-6 py-10 sm:px-12 sm:py-14">
      <div className="mb-9"><p className="mb-3 text-[11px] font-extrabold uppercase tracking-[.2em] text-[#c7192d]">Welcome back</p><h2 className="text-3xl font-extrabold tracking-[-.045em] text-zinc-950 sm:text-4xl">Sign in to your portal</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Enter your credentials to access your workspace.</p></div>
      {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700">{error}</div>}
      <form onSubmit={handleLogin} className="space-y-5">
        <div><label htmlFor="portal-username" className="mb-2 block text-xs font-bold text-zinc-800">Username</label><input id="portal-username" autoComplete="username" type="text" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter your username" required className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10"/></div>
        <div><label htmlFor="portal-password" className="mb-2 block text-xs font-bold text-zinc-800">Password</label><div className="relative"><input id="portal-password" autoComplete="current-password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" required className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 pr-16 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10"/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(v=>!v)} className="absolute inset-y-0 right-3 text-xs font-bold text-zinc-500 hover:text-red-600">{showPassword?'Hide':'Show'}</button></div></div>
        <button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#c7192d] px-5 py-3.5 text-sm font-bold text-white shadow-[0_9px_22px_rgba(199,25,45,.22)] transition hover:bg-[#a91325] hover:shadow-[0_12px_26px_rgba(199,25,45,.3)] disabled:opacity-60">{loading?'Signing in…':'Sign in to workspace'} {!loading && <span aria-hidden="true">→</span>}</button>
      </form>
      <p className="mt-9 text-center text-xs text-zinc-400">Authorized personnel only · Secure access</p>
    </section>
  </div>;
}
