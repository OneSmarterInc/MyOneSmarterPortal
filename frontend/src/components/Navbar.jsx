import React, { useState, useEffect } from 'react';
import { getProfile } from '../services/api';
import { Avatar } from './AdminUI';

export default function Navbar({ user, onLogout }) {
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  useEffect(() => {
    const syncMenu = event => setAdminMenuOpen(event.detail);
    window.addEventListener('adminMenuState', syncMenu);
    return () => window.removeEventListener('adminMenuState', syncMenu);
  }, []);
  const [profile,setProfile] = useState(null);
  useEffect(()=>{let active=true;setProfile(null);if(user?.user_id)getProfile(user.user_id).then(r=>{if(active)setProfile(r.data);}).catch(()=>{});return()=>{active=false;};},[user?.user_id]);
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 shadow-[0_3px_20px_rgba(0,0,0,0.035)] backdrop-blur-xl print:hidden">
      <nav aria-label="Top navigation" className="mx-auto flex h-[64px] w-full items-center justify-between gap-3 px-4 sm:px-7 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          {user && <button type="button" aria-label="Toggle navigation menu" aria-controls={user.role === 'manager' ? 'admin-navigation' : undefined} aria-expanded={user.role === 'manager' ? adminMenuOpen : undefined} onClick={() => window.dispatchEvent(new Event('toggleMobileMenu'))} className={`shrink-0 rounded-xl border border-zinc-200 p-2.5 text-zinc-800 transition hover:border-red-200 hover:bg-red-50 ${user.role === 'manager' ? '' : 'md:hidden'}`}>
            <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-red-100 bg-white p-1 shadow-sm sm:h-11 sm:w-11">
            <img src="/images/logo.png" alt="MyOnesmarterPortal logo" className="h-full w-full object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold leading-tight tracking-[-.045em] text-zinc-950 sm:text-xl">My<span className="text-[#c7192d]">OnesmarterPortal</span></p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[.22em] text-zinc-500 sm:text-[10px]">Employee workspace</p>
          </div>
        </div>
        {user ? <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <div className="hidden text-right sm:block"><p className="text-sm font-bold text-zinc-900">{user.username}</p><p className="text-[10px] font-semibold uppercase tracking-widest text-red-600">{user.role === 'manager' ? 'Administrator' : 'Employee'}</p></div>
          <span className="hidden sm:inline-flex"><Avatar person={{...profile,username:user.username}} /></span>
          <button type="button" onClick={onLogout} className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs font-bold text-zinc-800 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:px-5">Sign out</button>
        </div> : <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-600"><span className="h-2 w-2 rounded-full bg-[#c7192d]"/>Secure portal</div>}
      </nav>
    </header>
  );
}
