import React, { useState } from 'react';
import './BirthdayCelebration.css';

const EVENT_DATE = '2026-10-29';
export default function BirthdayCelebration({ user }) {
  const key = `sahil-birthday-corner-2026:${user.user_id}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(key) === 'yes'; } catch { return false; }
  });
  const [posterFailed, setPosterFailed] = useState(false);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (dismissed || today !== EVENT_DATE) return null;
  function close() {
    setDismissed(true);
    try { localStorage.setItem(key, 'yes'); } catch { /* Dismiss for this visit if storage is unavailable. */ }
  }
  return <aside className="birthday-corner" aria-label="Birthday celebration">
    <button type="button" className="birthday-corner-close" aria-label="Close birthday celebration" onClick={close}>×</button>
    <div className="birthday-corner-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, i) =>
      <i key={i} style={{ '--i': i, left: `${(i * 37) % 98}%`, animationDelay: `${(i % 5) * .12}s` }} />)}</div>
    {!posterFailed ? <img className="birthday-corner-photo" src="/images/sahil-birthday.jpg" alt="Birthday poster for Sahil" onError={() => setPosterFailed(true)} />
      : <span className="birthday-corner-cake" aria-hidden="true">🎂</span>}
    <div className="birthday-corner-copy"><p>OneSmarter celebrations</p><h2>Happy Birthday, Sahil!</h2><span>Wishing you a wonderful year ahead.</span></div>
  </aside>;
}
