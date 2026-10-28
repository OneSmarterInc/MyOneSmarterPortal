import AttendanceTimeEditor from './AttendanceTimeEditor';
import React from 'react';
import { formatAttendanceTime } from '../utils/attendanceTime';
import { Person, Avatar, Status, Icon, localDate } from './AdminUI';
import './CalmDashboard.css';

export default function AdminOverview({ records, users, pendingLeaves, leaveRequests = [], busy, error, retry, navigate, addEmployee, onSelectEmployee }) {
  const now = new Date();
  const today = localDate(now);
  const todays = records.filter(r => r.date === today);
  const pending = records.filter(r => r.status === 'Pending');
  const approved = records.filter(r => ['Present', 'Late'].includes(r.status));
  const person = id => users.find(u => u.id === id) || {};
  const team = users.filter(u => ['employee', 'intern'].includes(u.role));
  const present = new Set(approved.filter(r => r.date === today).map(r => r.user)).size;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - 6 + i);
    return { date: localDate(d), label: d.toLocaleDateString('en', { weekday: 'short' }) };
  });
  const counts = days.map(d => new Set(approved.filter(r => r.date === d.date).map(r => r.user)).size);
  const maximum = Math.max(1, ...counts);
  const metrics = [
    { label: 'Present today', value: present, icon: 'people', action: () => document.getElementById('today-attendance')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: 'Check-ins to review', value: pending.filter(r => !r.check_out).length, icon: 'clock', action: () => navigate('pending-attendance', 'in') },
    { label: 'Check-outs to review', value: pending.filter(r => r.check_out).length, icon: 'check', action: () => navigate('pending-attendance', 'out') },
    { label: 'Leave & WFH requests', value: pendingLeaves, icon: 'calendar', action: () => navigate('pending-leaves') }
  ];
  const requests = [
    ...pending.map(r => ({ key: `attendance-${r.id}`, person: person(r.user), label: r.check_out ? 'Check-out request' : 'Check-in request', date: r.date, action: () => navigate('pending-attendance', r.check_out ? 'out' : 'in') })),
    ...leaveRequests.map(r => ({ key: `leave-${r.id}`, person: users.find(u => u.id === r.user_id || u.username === r.username) || { username: r.username }, label: ['WFH', 'Work From Home'].includes(r.request_type) ? 'Work from home' : 'Leave request', date: r.start_date, action: () => navigate('pending-leaves') }))
  ].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let name = '';
  try { name = JSON.parse(localStorage.getItem('user') || '{}')?.username || ''; } catch { /* A missing session name does not block the dashboard. */ }
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const unavailable = busy || error;
  return <div className="calm-dashboard">
    <header className="admin-page-heading calm-heading">
      <div><p className="calm-eyebrow">COMPANY OVERVIEW</p><h1>{greeting}{name ? `, ${name}` : ''}</h1><p>Your people, daily operations, and decisions — in one place.</p></div>
      <div className="calm-heading-actions"><time dateTime={today}>{now.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</time><button className="admin-button" onClick={addEmployee}>+ Add employee</button></div>
    </header>
    {error && <div className="admin-error" role="alert">{error} <button onClick={retry}>Try again</button></div>}
    <div className="workspace-quick-actions" aria-label="Company quick actions">
      <button onClick={() => navigate('pending-attendance')}><span>01 / TAKE ACTION</span><strong>Review attendance <b aria-hidden="true">↗</b></strong><small>Keep your team’s workday moving</small></button>
      <button onClick={() => navigate('schedule')}><span>02 / PLAN AHEAD</span><strong>Company calendar <b aria-hidden="true">↗</b></strong><small>Manage holidays and working days</small></button>
      <button onClick={() => navigate('report')}><span>03 / STAY INFORMED</span><strong>Reports & insights <b aria-hidden="true">↗</b></strong><small>Explore attendance and team records</small></button>
    </div>
    <div className="calm-layout">
      <div className="calm-column">
        <section className="admin-panel"><div className="admin-panel-title"><h2>Today at a glance</h2><button className="admin-link" onClick={() => navigate('pending-attendance')}>View attendance →</button></div>
          <div className="calm-metrics">{metrics.map((m, i) => <button className={`calm-metric calm-tone-${i}`} key={m.label} onClick={m.action}><span className="calm-icon"><Icon name={m.icon}/></span><strong>{unavailable ? '—' : m.value}</strong><span>{m.label}</span></button>)}</div>
        </section>
        <section className="admin-panel" id="today-attendance"><div className="admin-panel-title"><div><h2>Team activity</h2><p>Today’s recorded check-ins and check-outs</p></div><button className="admin-link" onClick={retry} disabled={busy}>Refresh</button></div>
          <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Team member</th><th>Check-in</th><th>Check-out</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {!unavailable && todays.map(r => <tr key={r.id}><td><Person person={person(r.user)}/></td><td>{formatAttendanceTime(r.check_in)}</td><td>{formatAttendanceTime(r.check_out)}</td><td><Status value={r.status}/></td><td><AttendanceTimeEditor record={r} name={person(r.user).username} onSaved={retry}/></td></tr>)}
            {(unavailable || !todays.length) && <tr><td colSpan="5" className="admin-empty">{busy ? 'Loading attendance…' : error ? 'Attendance unavailable.' : 'No attendance recorded today.'}</td></tr>}
          </tbody></table></div>
          <div className="calm-panel-footer">{unavailable ? '—' : `${todays.length} attendance records today`}<button className="admin-link" onClick={() => navigate('employees')}>View people →</button></div>
        </section>
        <section className="admin-panel"><div className="admin-panel-title"><div><h2>Attendance this week</h2><p>Last 7 days · approved attendance</p></div><Icon name="report"/></div>
          {unavailable ? <p className="admin-empty">{busy ? 'Loading…' : 'Attendance unavailable.'}</p> : <div className="admin-chart" role="img" aria-label={days.map((d, i) => `${d.date}: ${counts[i]} approved`).join(', ')}>{days.map((d, i) => <div className="admin-chart-column" key={d.date}><strong>{counts[i]}</strong><div className="admin-chart-track"><span style={{ height: `${counts[i] / maximum * 100}%` }}/></div><small>{d.label}</small></div>)}</div>}
        </section>
      </div>
      <div className="calm-column calm-team-column">
        <section className="admin-panel"><div className="admin-panel-title"><h2>Needs your review <span className="calm-count">{unavailable ? '—' : requests.length}</span></h2></div>
          {unavailable || !requests.length ? <p className="admin-empty">{busy ? 'Loading requests…' : error ? 'Requests unavailable.' : 'You’re all caught up. No requests waiting.'}</p> : <div className="calm-requests">{requests.slice(0, 5).map(r => <div className="calm-request" key={r.key}><div><Person person={r.person}/><p>{r.label}<small>{r.date}</small></p></div><button className="admin-button" onClick={r.action} aria-label={`Review ${r.label.toLowerCase()} for ${r.person.username || 'team member'}`}>Review</button></div>)}</div>}
          <div className="calm-review-links"><button className="admin-link" onClick={() => navigate('pending-attendance')}>Attendance requests →</button><button className="admin-link" onClick={() => navigate('pending-leaves')}>Leave & WFH requests →</button></div>
        </section>
        <section className="admin-panel calm-team-panel"><div className="admin-panel-title"><div><h2>Your team</h2><p>{unavailable ? 'Team overview' : `${team.length} employees and interns`}</p></div><button className="admin-link" onClick={() => navigate('employees')}>View all →</button></div>
          {unavailable || !team.length ? <p className="admin-empty">{busy ? 'Loading team…' : error ? 'Team unavailable.' : 'Add your first team member to get started.'}</p> : <div className="calm-team" tabIndex={0} role="region" aria-label="Employees and interns">{team.map(u => <button type="button" key={u.id} className="calm-team-member" aria-label={`View ${u.username} in people directory`} onClick={() => onSelectEmployee(u.id)}><Avatar person={u}/><strong>{u.username}</strong><small>{u.designation?.trim() || 'Intern'}</small></button>)}</div>}
        </section>
      </div>
    </div>
  </div>;
}

