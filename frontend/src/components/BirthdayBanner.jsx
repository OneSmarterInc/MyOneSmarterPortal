import React, { useEffect, useState } from 'react';
import { getBirthdays } from '../services/api';
import { upcomingBirthdays } from '../utils/birthdays';
import './BirthdayBanner.css';

const COLORS = ['#fbbf24', '#fb7185', '#a78bfa', '#34d399', '#38bdf8'];

function BirthdayAvatar({ person }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="birthday-avatar">
      {person.profile_photo && !failed
        ? <img src={person.profile_photo} alt={person.name} onError={() => setFailed(true)} />
        : <span aria-label={person.name}>{person.name.slice(0, 2).toUpperCase()}</span>}
      <span className="birthday-avatar-star" aria-hidden="true">{person.daysUntil === 0 ? '★' : '✦'}</span>
    </div>
  );
}

export default function BirthdayBanner() {
  const [people, setPeople] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      setNow(new Date());
      try {
        const response = await getBirthdays();
        if (active) setPeople(response.data);
      } catch {
        // A celebration must never prevent attendance or navigation from working.
      }
    };
    refresh();
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    window.addEventListener('focus', refresh);
    window.addEventListener('birthdaysUpdated', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('birthdaysUpdated', refresh);
    };
  }, []);

  const upcoming = upcomingBirthdays(people, now);
  if (!upcoming.length) return null;
  const celebratingToday = upcoming.some(person => person.daysUntil === 0);
  const celebrationKey = upcoming.map(person => person.id + ':' + person.daysUntil).join(',');
  return (
    <section aria-label="Team birthdays" className={`birthday-banner ${celebratingToday ? 'birthday-banner-today' : ''}`}>
      <div key={celebrationKey + ':' + burst} className="birthday-confetti" aria-hidden="true">
        {Array.from({ length: celebratingToday ? 72 : 36 }, (_, i) => (
          <i key={i} style={{
            left: `${(i * 37) % 100}%`,
            backgroundColor: COLORS[i % COLORS.length],
            '--delay': `${(i % 12) * 0.12}s`,
            '--duration': `${3 + (i % 5) * 0.4}s`,
            '--drift': `${((i * 23) % 160) - 80}px`,
            borderRadius: i % 3 === 0 ? '50%' : '2px',
          }} />
        ))}
      </div>
      {celebratingToday && <div className="birthday-balloons" aria-hidden="true"><span>🎈</span><span>🎈</span><span>✨</span></div>}
      <div className="birthday-intro">
        <span className="birthday-eyebrow"><span aria-hidden="true">✦</span> OUR PEOPLE, OUR CELEBRATIONS</span>
        <h2>{celebratingToday ? 'A little extra joy today.' : 'Something to celebrate.'}</h2>
        <p>{celebratingToday ? 'Birthday wishes from your OneSmarter family!' : 'The countdown is on. A teammate’s big day is almost here.'}</p>
        <button type="button" onClick={() => setBurst(value => value + 1)} className="birthday-celebrate">
          <span aria-hidden="true">🎉</span> Celebrate again
        </button>
      </div>
      <div className="birthday-people">
        {upcoming.map(person => (
          <article key={person.id} className={`birthday-person ${person.daysUntil === 0 ? 'birthday-person-today' : ''}`}>
            <BirthdayAvatar key={person.profile_photo || person.id} person={person} />
            <div className="birthday-person-copy">
              <span className="birthday-role">{person.role}</span>
              <h3>{person.name}</h3>
              <p>{person.daysUntil === 0 ? 'Happy Birthday! Make a wish.' : new Date(person.celebrationDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
              <span className="birthday-countdown">{person.daysUntil === 0 ? '🎂 Today is your day' : person.daysUntil === 1 ? 'Tomorrow!' : `In ${person.daysUntil} days`}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
