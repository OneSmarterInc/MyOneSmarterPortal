import React, { useState, useEffect } from 'react';
import { getProfile, getCalendarAnnouncements } from '../services/api';
import { Avatar } from './AdminUI';

export default function Navbar({ user, onLogout }) {
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [readKeys, setReadKeys] = useState([]);
  const isEmployee = user && user.role !== 'manager';
  const storageKey = user?.user_id ? `employee-calendar-read:${user.user_id}` : '';
  const today = () => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  };
  const readStorage = () => {
    if (!storageKey) return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };
  useEffect(() => {
    setNotifications([]);
    setNotificationsOpen(false);
    setReadKeys(readStorage());
    if (!isEmployee) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await getCalendarAnnouncements();
        if (!active) return;
        if (!Array.isArray(response.data)) throw new Error('Invalid calendar response');
        const latestByDate = new Map();
        for (const item of response.data) {
          if (item.date < today() || latestByDate.has(item.date)) continue;
          latestByDate.set(item.date, item);
        }
        const upcoming = [...latestByDate.values()]
          .map(item => ({ ...item, key: `calendar-event-${item.id}` }))
          .filter(item => !readStorage().includes(item.key))
          .sort((a, b) => a.date.localeCompare(b.date));
        setNotifications(upcoming);
        setReadKeys(readStorage());
        setNotificationError('');
      } catch {
        if (active) setNotificationError('Could not load calendar updates.');
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 60000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('calendarUpdated', onFocus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('calendarUpdated', onFocus);
    };
  }, [user?.user_id, user?.role]);
  const unreadCount = notifications.filter(n => !readKeys.includes(n.key)).length;
  const dismissNotification = key => {
    const keys = [...new Set([...readStorage(), key])].slice(-500);
    setReadKeys(keys);
    setNotifications(items => items.filter(n => n.key !== key));
    try { localStorage.setItem(storageKey, JSON.stringify(keys)); } catch { /* storage unavailable */ }
  };
  const openNotifications = () => {
    if (!notificationsOpen) {
      const keys = [...new Set([...readStorage(), ...notifications.map(n => n.key)])].slice(-500);
      setReadKeys(keys);
      try { localStorage.setItem(storageKey, JSON.stringify(keys)); } catch { /* storage unavailable */ }
    } else {
      setNotifications([]);
    }
    setNotificationsOpen(value => !value);
  };
  useEffect(() => {
    const syncMenu = event => setAdminMenuOpen(event.detail);
    window.addEventListener('adminMenuState', syncMenu);
    return () => window.removeEventListener('adminMenuState', syncMenu);
  }, []);
  const [profile,setProfile] = useState(null);
  useEffect(()=>{let active=true;setProfile(null);if(user?.user_id)getProfile(user.user_id).then(r=>{if(active)setProfile(r.data);}).catch(()=>{});return()=>{active=false;};},[user?.user_id]);
  return (
    <header className="workspace-topbar sticky top-0 z-50 border-b border-zinc-200 bg-white/95 shadow-[0_3px_20px_rgba(0,0,0,0.035)] backdrop-blur-xl print:hidden">
      <nav aria-label="Top navigation" className="mx-auto flex h-[64px] w-full items-center justify-between gap-3 px-4 sm:px-7 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          {user && <button type="button" aria-label="Toggle navigation menu" aria-controls="workspace-navigation" aria-expanded={adminMenuOpen} onClick={() => window.dispatchEvent(new Event('toggleMobileMenu'))} className={`shrink-0 rounded-xl border border-zinc-200 p-2.5 text-zinc-800 transition hover:border-red-200 hover:bg-red-50`}>
            <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-red-100 bg-white p-1 shadow-sm sm:h-11 sm:w-11">
            <img src="/images/logo.png" alt="MyOnesmarterPortal logo" className="h-full w-full object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold leading-tight tracking-[-.045em] text-zinc-950 sm:text-xl">My<span className="text-[#c7192d]">OneSmarter</span></p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[.22em] text-zinc-500 sm:text-[10px]">Company workspace</p>
          </div>
        </div>
        {user ? <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          {isEmployee && <div className="relative">
            <button type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={notificationsOpen} aria-haspopup="true" onClick={openNotifications}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:border-red-200 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-5 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            {notificationsOpen && <div role="region" aria-label="Calendar notifications"
              className="absolute right-0 top-12 z-[100] w-[min(340px,calc(100vw-24px))] rounded-xl border border-zinc-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                <strong className="text-sm text-zinc-900">Calendar notifications</strong>
                <button type="button" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)} className="text-zinc-500 hover:text-red-600">✕</button>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {notificationError && <p role="alert" className="p-3 text-xs text-red-700">{notificationError}</p>}
                {!notificationError && notifications.length === 0 && <p className="p-4 text-center text-sm text-zinc-500">No upcoming holiday or half-day announcements.</p>}
                {notifications.map(n => <div key={n.key} className="mb-1 rounded-lg border border-zinc-100 p-3 last:mb-0">
                  <p className="text-sm font-semibold text-zinc-900">{n.day_type === 'Holiday' ? 'Company holiday' : n.day_type === 'Cancelled' ? 'Holiday / half-day cancelled' : 'Company half-day'}</p>
                  <p className="mt-1 text-xs font-medium text-red-700">{new Date(`${n.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  {n.description && <p className="mt-1 text-xs text-zinc-600">{n.description}</p>}
                  <button type="button" className="mt-2 text-xs font-semibold text-red-700 underline" onClick={() => dismissNotification(n.key)}>Mark as read</button>
                   {n.day_type === 'Half-Day' && n.start_time && n.end_time && <p className="mt-1 text-xs text-zinc-600">{n.start_time.slice(0,5)} – {n.end_time.slice(0,5)}</p>}
                </div>)}
              </div>
            </div>}
          </div>}
          <div className="hidden text-right sm:block"><p className="text-sm font-bold text-zinc-900">{user.username}</p><p className="text-[10px] font-semibold uppercase tracking-widest text-red-600">{user.role === 'manager' ? 'Administrator' : user.role === 'intern' ? 'Intern' : user.role === 'employee' ? 'Employee' : 'Team member'}</p></div>
          <span className="hidden sm:inline-flex"><Avatar person={{...profile,username:user.username}} /></span>
          <button type="button" onClick={onLogout} className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs font-bold text-zinc-800 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:px-5">Sign out</button>
        </div> : <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-600"><span className="h-2 w-2 rounded-full bg-[#c7192d]"/>Secure portal</div>}
      </nav>
    </header>
  );
}
