import React, { useEffect, useState } from 'react';
import { getUpcomingCalendar } from '../services/api';

const dateLabel = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function UpcomingCalendar({ refreshKey }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await getUpcomingCalendar();
        if (active) { setEvents(response.data); setError(false); }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }
    load();
    const refresh = () => { if (document.visibilityState === 'visible') load(); };
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [refreshKey, retry]);
  return <aside className="upcoming-calendar" aria-label="Upcoming holidays and approved leave">
    <h2>Upcoming holidays & leaves</h2>
    <p className="upcoming-subtitle">Nearest dates first</p>
    <div className="upcoming-legend"><span>🔵 Company holiday</span><span>🟣 Approved leave</span></div>
    {loading ? <p role="status">Loading upcoming dates…</p> : error ? <p role="alert">Could not load upcoming dates. <button className="admin-link" onClick={() => setRetry(value => value + 1)}>Try again</button></p> : events.length ? <ul className="upcoming-event-list">{events.map(event => <li key={event.id} className={`upcoming-event upcoming-${event.kind}`}>
      <span className="upcoming-event-type">{event.kind === 'holiday' ? 'Company holiday' : 'Approved leave'}</span>
      <strong>{event.title}</strong>
      {event.employee_name && <span>{event.employee_name}</span>}
      <time dateTime={event.start_date}>{dateLabel(event.start_date)}{event.end_date !== event.start_date ? ` – ${dateLabel(event.end_date)}` : ''}</time>
    </li>)}</ul> : <p className="upcoming-empty">No upcoming holidays or approved leave.</p>}
  </aside>;
}
