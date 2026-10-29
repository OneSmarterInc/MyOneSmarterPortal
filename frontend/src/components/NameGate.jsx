import React, { useEffect, useState } from 'react';
import { completeName, getProfile } from '../services/api';

export default function NameGate({ user, children }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setReady(false);
    getProfile(user.user_id).then(({ data }) => {
      if (!active) return;
      setFirst(data.first_name || ''); setLast(data.last_name || '');
      setReady(Boolean(data.first_name?.trim() && data.last_name?.trim()));
      const saved = JSON.parse(localStorage.getItem('user') || '{}');
      if (saved.first_name !== data.first_name || saved.last_name !== data.last_name) {
        localStorage.setItem('user', JSON.stringify({ ...saved, first_name: data.first_name, last_name: data.last_name, full_name: data.full_name }));
        window.dispatchEvent(new Event('userUpdated'));
      }
    }).catch(() => { if (active) setError('Unable to load your profile. Please retry or sign in again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.user_id, user.letter_token, attempt]);
  async function save(event) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const { data } = await completeName({ first_name: first.trim(), last_name: last.trim() });
      const saved = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...saved, ...data }));
      window.dispatchEvent(new Event('userUpdated'));
      setReady(true);
    } catch { setError('Unable to save. Enter your first and last name, then try again.'); }
    finally { setLoading(false); }
  }
  if (ready) return children;
  return <div className="flex w-full items-center justify-center p-5 sm:p-10"><section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7">
    <h1 className="text-2xl font-semibold">Complete your name</h1>
    <p className="mt-2 mb-6 text-sm text-slate-600">Enter your first and last name before continuing. Your full name will appear throughout the portal.</p>
    {error && <p role="alert" className="mb-4 text-sm text-red-700">{error} <button className="underline" onClick={() => setAttempt(n => n + 1)}>Retry</button></p>}
    <form onSubmit={save} className="space-y-4">
      <label className="block text-sm font-semibold">First name<input autoComplete="given-name" required maxLength={150} value={first} onChange={e => setFirst(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
      <label className="block text-sm font-semibold">Last name<input autoComplete="family-name" required maxLength={150} value={last} onChange={e => setLast(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
      <button disabled={loading || !first.trim() || !last.trim()} className="w-full rounded-lg bg-red-700 p-3 font-semibold text-white disabled:opacity-50">{loading ? 'Please wait…' : 'Save and continue'}</button>
    </form>
  </section></div>;
}
