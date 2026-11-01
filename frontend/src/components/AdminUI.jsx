import { personName } from '../utils/personName';
import React, { useState } from 'react';

export function Avatar({ person = {}, large = false }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const name = personName(person);
  return <span className={`admin-avatar ${large ? 'admin-avatar-large' : ''}`}>
    {person.profile_photo && failedUrl !== person.profile_photo
      ? <img src={person.profile_photo} alt="" onError={() => setFailedUrl(person.profile_photo)} />
      : <span aria-hidden="true">{name.split(/[ _.-]+/).map(s => s[0]).slice(0, 2).join('').toUpperCase()}</span>}
  </span>;
}
export function Person({ person = {} }) {
  return <div className="admin-person"><Avatar person={person} /><div><strong>{personName(person)}</strong><small>{person.designation || person.role || 'Team member'}</small></div></div>;
}
export function Status({ value }) {
  return <span className={`admin-badge status-${String(value).toLowerCase()}`}>{value}</span>;
}
export function localDate(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}
export function Icon({ name = 'dashboard' }) {
  const paths = {
    dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87',
    calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
    clock: 'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    check: 'M9 12l2 2 4-4 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    report: 'M4 21V3 M4 21h17 M9 17v-5 M14 17V7 M19 17V4',
    mail: 'M3 5h18v14H3z M3 5l9 7 9-7',
    key: 'M15 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0 M6 11L2 15v4h4v-3h3l3-3',
    lock: 'M6 10V6a6 6 0 0 1 12 0v4 M4 10h16v12H4z M12 14v4',
    unlock: 'M6 10V6a6 6 0 0 1 11-3 M4 10h16v12H4z M12 14v4',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    edit: 'M16 3l5 5 M4 20l4-1 13-13a2.8 2.8 0 0 0-4-4L4 15z',
    trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
    home: 'M3 10l9-7 9 7 M5 9v12h14V9 M9 21v-7h6v7',
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.dashboard} /></svg>;
}
