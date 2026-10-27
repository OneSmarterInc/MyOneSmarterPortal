import React, { useState } from 'react';
import { formatAttendanceTime } from '../utils/attendanceTime';
import { Person, Status, Icon, localDate } from './AdminUI';

export default function AdminOverview({ records, users, pendingLeaves, busy, error, retry, navigate, addEmployee }) {
  const [now] = useState(()=>new Date());
  const today = localDate(now);
  const todays = records.filter(r => r.date === today);
  const pending = records.filter(r => r.status === 'Pending');
  const approved = records.filter(r => ['Present','Late'].includes(r.status));
  const days = Array.from({length:7}, (_,i) => { const d = new Date(now); d.setDate(d.getDate()-6+i); return {date:localDate(d), label:d.toLocaleDateString('en',{weekday:'short'})}; });
  const counts = days.map(d => new Set(approved.filter(r=>r.date===d.date).map(r=>r.user)).size);
  const maximum = Math.max(1,...counts);
  const person = id => users.find(u => u.id === id) || {};
  const latest = [...records].sort((a,b) => b.date.localeCompare(a.date) || (b.check_out || b.check_in || '').localeCompare(a.check_out || a.check_in || '') || b.id-a.id).slice(0,4);
  const metrics = [
    {label:'Present today', value:new Set(approved.filter(r=>r.date===today).map(r=>r.user)).size, detail:'Approved present & late', icon:'people', action:()=>document.getElementById('today-attendance')?.scrollIntoView({behavior:'smooth'})},
    {label:'Pending check-ins',value:pending.filter(r=>!r.check_out).length,detail:'Waiting for your review',icon:'clock',action:()=>navigate('pending-attendance','in')},
    {label:'Pending check-outs',value:pending.filter(r=>r.check_out).length,detail:'Waiting for your review',icon:'check',action:()=>navigate('pending-attendance','out')},
    {label:'Leave & WFH requests',value:pendingLeaves,detail:'Pending approval',icon:'calendar',action:()=>navigate('pending-leaves')}
  ];
  return <>
    <header className="admin-page-heading"><div><p className="admin-eyebrow">YOUR WORKSPACE AT A GLANCE</p><h1>Dashboard</h1><p>Welcome back. Here’s what’s happening with your team.</p></div><button className="admin-button primary" onClick={addEmployee}>+ Add employee</button></header>
    {error && <div className="admin-error" role="alert">{error} <button onClick={retry}>Try again</button></div>}
    <div className="admin-metrics">{metrics.map(m=><button className="admin-metric" key={m.label} onClick={m.action}><span className="admin-metric-icon"><Icon name={m.icon}/></span><span>{m.label}</span><strong>{busy || error ? '—' : m.value}</strong><small>{m.detail} <span aria-hidden="true">↗</span></small></button>)}</div>
    <div className="admin-overview-grid">
      <section className="admin-panel" id="today-attendance"><div className="admin-panel-title"><div><h2>Today’s attendance</h2><p>{now.toLocaleDateString('en',{weekday:'long',day:'numeric',month:'long'})}</p></div><button className="admin-link" onClick={()=>navigate('pending-attendance')}>Review requests →</button></div>
        <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Team member</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr></thead><tbody>
        {!busy && !error && todays.map(r=><tr key={r.id}><td><Person person={person(r.user)}/></td><td>{formatAttendanceTime(r.check_in)}</td><td>{formatAttendanceTime(r.check_out)}</td><td><Status value={r.status}/></td></tr>)}
        {(busy || error || !todays.length) && <tr><td colSpan="4" className="admin-empty">{busy?'Loading attendance…':error?'Attendance unavailable.':'No attendance recorded today.'}</td></tr>}
        </tbody></table></div>
      </section>
      <section className="admin-panel"><div className="admin-panel-title"><div><h2>Attendance this week</h2><p>Approved present & late · last 7 days</p></div><Icon name="report"/></div>
        {busy || error ? <p className="admin-empty">{busy?'Loading…':'Attendance unavailable.'}</p> : <div className="admin-chart" role="img" aria-label={days.map((d,i)=>d.date+': '+counts[i]+' approved').join(', ')}>{days.map((d,i)=><div className="admin-chart-column" key={d.date}><strong>{counts[i]}</strong><div className="admin-chart-track"><span style={{height:`${counts[i]/maximum*100}%`}} /></div><small>{d.label}</small></div>)}</div>}
      </section>
    </div>
    <section className="admin-panel"><div className="admin-panel-title"><div><h2>Latest attendance</h2><p>Most recent recorded check-ins and check-outs</p></div><button className="admin-link" onClick={()=>navigate('employees')}>View people →</button></div><div className="admin-activity">{!busy && !error && latest.map(r=><div key={r.id}><Person person={person(r.user)}/><p>{r.check_out?'Check-out':'Check-in'} · {formatAttendanceTime(r.check_out || r.check_in)}<small>{r.date} · {r.status}</small></p></div>)}{(busy || error || !latest.length)&&<p className="admin-empty">{busy?'Loading…':error?'Activity unavailable.':'No activity yet.'}</p>}</div></section>
  </>;
}
