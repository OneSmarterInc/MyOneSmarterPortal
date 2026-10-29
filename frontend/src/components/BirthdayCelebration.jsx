import React, { useEffect, useState } from 'react';
import './BirthdayCelebration.css';

const EVENT_DATE = '2026-10-29';
const dateInIndia = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date()).replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$1-$2');

export default function BirthdayCelebration({ user }) {
  const [visible, setVisible] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const key = `sahil-birthday-2026-seen:${user?.user_id || 'unknown'}`;
  useEffect(() => {
    if (!user || dateInIndia() !== EVENT_DATE) return;
    if (localStorage.getItem(key) !== 'yes') setVisible(true);
  }, [user?.user_id]);
  useEffect(() => {
    if (!visible) return;
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible]);
  function close() { localStorage.setItem(key, 'yes'); setVisible(false); }
  if (!visible || dateInIndia() !== EVENT_DATE) return null;
  return <div className="birthday-overlay" role="presentation">
    <section className="birthday-dialog" role="dialog" aria-modal="true" aria-label="Happy birthday Sahil">
      <button type="button" className="birthday-close" aria-label="Close birthday celebration" onClick={close}>×</button>
      <div className="birthday-sparkles" aria-hidden="true">{Array.from({ length: 25 }, (_, i) =>
        <i key={i} style={{ '--i': i, left: `${(i * 37) % 98}%`, animationDelay: `${(i % 9) * .17}s` }} />)}</div>
      <h2>🎉 Happy Birthday, Sahil! 🎂</h2>
      <p>Everyone at OneSmarter wishes you a wonderful birthday!</p>
      {!posterFailed
        ? <img className="birthday-poster" src="/images/sahil-birthday.png" onError={() => setPosterFailed(true)} alt="Birthday poster celebrating Sahil" />
        : <div className="birthday-poster-fallback">🎈 🎊 🎁<strong>Happy Birthday Sahil!</strong><span>Have an amazing day!</span>🎂</div>}
      <button type="button" className="birthday-celebrate" onClick={close}>Celebrate! 🎈</button>
    </section>
  </div>;
}
