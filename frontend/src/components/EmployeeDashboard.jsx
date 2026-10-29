import { personName } from '../utils/personName';
import React, { useState, useEffect, useRef } from 'react';
import { getAttendance, getSchedules, getProfile, getLeaveRequests, getLeaveAllocations, getRecommendations } from '../services/api';
import { Avatar, Icon, Status, localDate } from './AdminUI';
import { formatAttendanceTime } from '../utils/attendanceTime';
import './EmployeeDashboard.css';
import { getAttendanceClock, punchAttendance, istCalendarDate } from '../services/attendanceClock';

const dateLabel = value => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const own = (items, id, key) => items.filter(item => String(item[key]) === String(id));
const minutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };

export default function EmployeeDashboard({ user, onNavigate }) {
  const [data, setData] = useState({});
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(() => istCalendarDate(new Date()));
  const [allHistory, setAllHistory] = useState(false);
  const [allRequests, setAllRequests] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dismissed, setDismissed] = useState(localStorage.getItem(`wfh-dismissed-${user.user_id}`));
  const saveLock = useRef(false);
  const requestVersion = useRef(0);
  const serverClock = useRef(null);
  function syncClock(timestamp) {
    serverClock.current = { epoch: Date.parse(timestamp), tick: performance.now() };
    setNow(istCalendarDate(new Date(serverClock.current.epoch)));
  }
  function tickClock() {
    const anchor = serverClock.current;
    if (anchor) setNow(istCalendarDate(new Date(anchor.epoch + performance.now() - anchor.tick)));
  }

  async function refresh() {
    const version = ++requestVersion.current;
    setBusy(true);
    const sources = { clock: getAttendanceClock, attendance: getAttendance, schedules: getSchedules, profile: () => getProfile(user.user_id), leaves: getLeaveRequests, allocations: getLeaveAllocations, documents: getRecommendations };
    const results = await Promise.allSettled(Object.values(sources).map(fetch => fetch()));
    if (version !== requestVersion.current) return;
    const next = {}, failed = [];
    Object.keys(sources).forEach((key, i) => {
      if (results[i].status === 'fulfilled') next[key] = results[i].value.data;
      else failed.push(key);
    });
    if (next.clock) syncClock(next.clock.now);
    setData(next); setErrors(failed); setBusy(false);
  }
  useEffect(() => {
    refresh();
    const timer = setInterval(tickClock, 1000);
    const focus = () => { tickClock(); if (!saveLock.current) refresh(); };
    window.addEventListener('focus', focus);
    return () => { requestVersion.current++; clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [user.user_id]);

  const today = localDate(now);
  const history = own(data.attendance || [], user.user_id, 'user').sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const leaves = own(data.leaves || [], user.user_id, 'user_id');
  const allocations = own(data.allocations || [], user.user_id, 'user_id');
  const profile = data.profile || {};
  const name = personName(profile);
  const record = history.find(item => item.date === today);
  const configFor = date => (data.schedules || []).find(item => item.date === localDate(date)) || (date.getDay() === 0 ? { day_type: 'Holiday', description: 'Sunday' } : { day_type: 'Working', start_time: '13:00', end_time: '21:00' });
  const config = configFor(now);
  const approvedLeave = date => leaves.find(item => item.status === 'Approved' && item.request_type !== 'Work From Home' && item.start_date <= date && item.end_date >= date);
  let holiday = null;
  if (data.schedules) for (let i = 1; i <= 366; i++) {
    const day = new Date(now); day.setDate(day.getDate() + i);
    if (configFor(day).day_type === 'Holiday') { holiday = day; break; }
  }
  const balances = {};
  allocations.filter(a => a.leave_type !== 'Work From Home').forEach(a => { balances[a.leave_type] = (balances[a.leave_type] || 0) + Number(a.total_days); });
  leaves.filter(l => l.status !== 'Rejected' && Object.hasOwn(balances, l.request_type)).forEach(l => {
    const days = l.request_type.toLowerCase().includes('half-day') ? 0.5 : Math.ceil(Math.abs(new Date(l.end_date) - new Date(l.start_date)) / 86400000) + 1;
    balances[l.request_type] -= days;
  });
  const balance = Object.values(balances).reduce((sum, value) => sum + Math.max(0, value), 0);
  const requests = [
    ...leaves.map(l => ({ key: `leave-${l.id}`, title: l.request_type, date: l.start_date, status: l.status, page: l.request_type === 'Work From Home' ? 'wfh' : 'leave', order: l.created_at || l.start_date })),
    ...(data.documents || []).map(d => ({ key: `doc-${d.id}`, title: d.document_type === 'attendance' ? 'Attendance consideration letter' : 'Recommendation letter', date: d.created_at, order: d.created_at, status: d.status, page: 'recommendations' }))
  ].sort((a, b) => String(b.order).localeCompare(String(a.order)));
  const pending = requests.filter(r => ['Pending', 'Draft', 'Sending'].includes(r.status)).length + history.filter(r => r.status === 'Pending').length;
  const elapsed = record?.check_in ? Math.max(0, minutes(record.check_out || now.toTimeString().slice(0, 8)) - minutes(record.check_in)) : 0;
  const attendanceStatus = !record ? 'Not checked in' : record.status === 'Pending' ? `${record.check_out ? 'Check-out' : 'Check-in'} pending` : record.status === 'Absent' ? 'Attendance rejected' : record.check_out ? 'Shift completed' : 'Checked in';
  const assigned = leaves.filter(l => l.request_type === 'Work From Home' && l.status === 'Approved' && l.end_date >= today && (l.reason || '').toLowerCase().includes('assigned by management')).sort((a, b) => b.id - a.id)[0];
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + weekOffset * 7);
  const week = Array.from({ length: 7 }, (_, i) => { const day = new Date(weekStart); day.setDate(day.getDate() + i); return day; });

  async function submitAttendance() {
    if (saveLock.current || busy || !data.clock || !data.attendance || record?.check_out) return;
    saveLock.current = true; setSaving(true); setMessage('');
    try {
      const response = await punchAttendance(record ? 'check_out' : 'check_in');
      syncClock(response.data.now);
      setMessage(`${record ? 'Check-out' : 'Check-in'} request sent for approval.`);
      await refresh();
    } catch { setMessage('Your attendance request could not be confirmed. Refresh before trying again.'); }
    finally { saveLock.current = false; setSaving(false); }
  }
  const valueOrDash = (ready, value) => !busy && ready ? value : '—';
  return <div className="employee-home">
    <header className="employee-greeting"><div><h1>{greeting}, {personName(profile)}</h1><p>Here’s your workday at a glance.</p></div><div className="employee-date"><span>{now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span><button className="admin-link" onClick={refresh} disabled={busy || saving}>{busy ? 'Loading…' : 'Refresh'}</button></div></header>
    {errors.length > 0 && <p className="admin-error" role="alert">Unable to load {errors.join(', ')}. Refresh to try again. Unavailable figures are shown as —.</p>}
    {message && <p className="employee-notice" role="status">{message}</p>}
    {assigned && dismissed !== String(assigned.id) && <div className="employee-notice employee-assignment"><span>Work from home assigned: {dateLabel(assigned.start_date)} – {dateLabel(assigned.end_date)}.</span><button className="admin-link" onClick={() => { localStorage.setItem(`wfh-dismissed-${user.user_id}`, String(assigned.id)); setDismissed(String(assigned.id)); }}>Dismiss</button></div>}
    <section className="employee-card employee-today" aria-label="Today’s attendance">
      <div className="employee-card-heading"><h2>Today’s attendance <small className="text-xs font-normal text-slate-500">IST</small></h2><span className={`employee-status ${record?.status === 'Pending' ? 'pending' : record?.status === 'Absent' ? 'rejected' : record ? 'approved' : ''}`}>{busy ? 'Loading…' : data.attendance ? attendanceStatus : 'Unavailable'}</span></div>
      <div className="employee-attendance-values"><div><span>Check-in</span><strong>{formatAttendanceTime(record?.check_in)}</strong></div><div><span>{record?.check_out ? 'Recorded time' : 'Time since check-in'}</span><strong>{record?.check_in ? `${Math.floor(elapsed / 60)}h ${elapsed % 60}m` : '—'}</strong></div><div><span>Shift</span><strong className="employee-shift">{valueOrDash(data.schedules, config.day_type === 'Holiday' ? config.description || 'Holiday' : `${formatAttendanceTime(config.start_time)} – ${formatAttendanceTime(config.end_time)}`)}</strong></div><div className="employee-attendance-action">{record?.check_out ? <><span>Check-out</span><strong>{formatAttendanceTime(record.check_out)}</strong></> : <button className="admin-button primary" disabled={busy || saving || !data.attendance || !data.clock} onClick={submitAttendance}>{saving ? 'Submitting…' : record ? 'Check out' : 'Check in'}</button>}</div></div>
    </section>
    <div className="employee-stats">{[
      ['calendar', 'green', valueOrDash(data.attendance, history.filter(r => r.date.startsWith(today.slice(0, 7)) && ['Present', 'Late'].includes(r.status)).length), 'Days present this month'],
      ['mail', 'blue', valueOrDash(data.leaves && data.allocations, balance), 'Days leave available'],
      ['clock', 'amber', valueOrDash(data.leaves && data.documents && data.attendance, pending), 'Pending requests'],
      ['calendar', 'red', valueOrDash(data.schedules, holiday ? holiday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'None'), 'Next holiday']
    ].map(([icon, color, value, label]) => <div className="employee-card employee-stat" key={label}><span className={`employee-stat-icon ${color}`}><Icon name={icon}/></span><div><strong>{value}</strong><span>{label}</span></div></div>)}</div>
    <div className="employee-columns">
      <section className="employee-card employee-history"><div className="employee-card-heading"><h2>My attendance</h2><button className="admin-link" onClick={() => setAllHistory(!allHistory)}>{allHistory ? 'Show recent' : 'View all'} →</button></div><div className="employee-table-scroll"><table><thead><tr><th>Date</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr></thead><tbody>{history.slice(0, allHistory ? history.length : 5).map(r => <tr key={r.id}><td>{dateLabel(r.date)}</td><td>{formatAttendanceTime(r.check_in)}</td><td>{formatAttendanceTime(r.check_out)}</td><td><Status value={r.status}/></td></tr>)}{!history.length && <tr><td colSpan="4" className="employee-empty">{busy ? 'Loading attendance…' : data.attendance ? 'No attendance recorded yet.' : 'Attendance unavailable.'}</td></tr>}</tbody></table></div><div className="employee-quick-actions">{[['calendar', 'Request leave', 'leave'], ['home', 'Work from home', 'wfh'], ['mail', 'Request document', 'recommendations']].map(([icon, label, page]) => <button key={page} className="admin-button" onClick={() => onNavigate(page)}><Icon name={icon}/>{label}</button>)}</div></section>
      <aside className="employee-side"><section className="employee-card"><div className="employee-card-heading"><h2>My requests</h2><button className="admin-link" onClick={() => setAllRequests(!allRequests)}>{allRequests ? 'Show recent' : 'View all'} →</button></div><div className="employee-request-list">{requests.slice(0, allRequests ? requests.length : 3).map(r => <button className="employee-request" key={r.key} onClick={() => onNavigate(r.page)}><span className="employee-request-icon"><Icon name={r.page === 'recommendations' ? 'mail' : 'calendar'}/></span><span className="employee-request-text"><strong>{r.title}</strong><small>{dateLabel(r.date)}</small></span><span className={`employee-status ${['Approved', 'Sent'].includes(r.status) ? 'approved' : r.status === 'Rejected' ? 'rejected' : 'pending'}`}>{r.status}</span></button>)}{!requests.length && <p className="employee-empty">{busy ? 'Loading requests…' : errors.includes('leaves') || errors.includes('documents') ? 'Requests unavailable.' : 'No requests yet.'}</p>}</div></section>
      <section className="employee-card"><div className="employee-card-heading"><h2>Your profile</h2><button className="admin-link" onClick={() => onNavigate('profile')}>View →</button></div><div className="employee-profile"><div className="employee-profile-person"><Avatar large person={{ ...profile, username: name }}/><div><strong>{name}</strong><span>{user.role === 'intern' ? 'Intern' : 'Employee'}{profile.designation ? ` · ${profile.designation}` : ''}</span></div></div><dl><div><dt>Employee ID</dt><dd>{profile.employee_id || '—'}</dd></div><div><dt>Joining date</dt><dd>{dateLabel(profile.joining_date)}</dd></div></dl></div></section></aside>
    </div>
    <section className="employee-card"><div className="employee-card-heading"><h2>Week of {dateLabel(localDate(weekStart))}</h2><div className="employee-week-actions"><button className="admin-button" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous week">←</button><button className="admin-button" onClick={() => setWeekOffset(0)}>Today</button><button className="admin-button" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Next week">→</button></div></div><div className="employee-week">{week.map(day => { const date = localDate(day), entry = history.find(r => r.date === date), dayConfig = configFor(day);
      const status = !data.attendance || !data.schedules || !data.leaves ? 'Unavailable'
        : approvedLeave(date) ? 'On leave'
        : dayConfig.day_type === 'Holiday' ? 'Holiday'
        : dayConfig.day_type === 'Half-Day' && !entry ? 'Half-day'
        : entry?.check_in && !entry?.check_out ? (date === today ? 'Waiting for checkout' : 'Checkout missing')
        : entry?.check_out ? (entry.status === 'Pending' ? 'Approval pending' : entry.status || 'Completed')
        : entry?.status === 'Absent' ? 'Absent'
        : date < today ? 'Absent'
        : date > today ? 'Upcoming'
        : 'Not checked in';
      const tone = status === 'Holiday' ? 'holiday'
        : status === 'Half-day' ? 'halfday'
        : ['Present', 'Late', 'Completed'].includes(status) ? 'present'
        : 'other';
      return <div key={date} className={`${date === today ? 'is-today ' : ''}week-tone-${tone}`}><small>{day.toLocaleDateString('en-GB', { weekday: 'short' })}</small><strong>{day.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</strong><span>{status}</span><small>{entry?.check_in ? `${formatAttendanceTime(entry.check_in)} – ${formatAttendanceTime(entry.check_out)}` : '—'}</small></div>; })}</div></section>
  </div>;
}
