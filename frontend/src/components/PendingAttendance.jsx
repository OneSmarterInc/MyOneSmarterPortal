import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { getAttendance, getUsers } from '../services/api';
import { formatAttendanceTime } from '../utils/attendanceTime';
import { Person, Status } from './AdminUI';
import { enqueueReview, subscribeReviews, getReviews, clearSavedReviews } from '../services/attendanceReviewQueue';

export default function PendingAttendance({ initialFilter = 'all' }) {
  const [records,setRecords] = useState([]);
  const [users,setUsers] = useState([]);
  const [filter,setFilter] = useState(initialFilter);
  const [query,setQuery] = useState('');
  const [date,setDate] = useState('');
  const [busy,setBusy] = useState(true);
  const reviews = useSyncExternalStore(subscribeReviews, getReviews);
  const queuedCount = Object.values(reviews).filter(job => ['queued', 'saving'].includes(job.state)).length;
  const [error,setError] = useState('');

  async function refresh() {
    setBusy(true); setError('');
    clearSavedReviews();
    try { const [a,u] = await Promise.all([getAttendance(),getUsers()]); setRecords(a.data.filter(r=>r.status==='Pending')); setUsers(u.data); }
    catch { setError('Unable to load requests. Please try again.'); }
    finally { setBusy(false); }
  }
  useEffect(()=>{refresh();},[]);
  const person = id => users.find(u=>u.id===id) || {};
  function review(record, status) { enqueueReview(record, status); }
  // Hide decisions immediately; the queue saves them serially in the background.
  // Failed decisions become visible again so the administrator can retry.
  const pendingRecords = records.filter(r => !(['queued', 'saving', 'saved'].includes(reviews[r.id]?.state) && reviews[r.id].checkOut === (r.check_out || null)));
  const visible=pendingRecords.filter(r=>(filter==='all'||(filter==='out'?!!r.check_out:!r.check_out))&&(!date||r.date===date)&&[person(r.user).username,person(r.user).designation,person(r.user).email].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="w-full max-w-7xl space-y-5">
    <header className="admin-page-heading"><div><h1>Attendance approvals</h1><p>Review your team’s check-in and check-out requests.</p></div><button className="admin-button" disabled={busy||queuedCount>0} onClick={refresh}>Refresh</button></header>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    <section className="admin-panel">
      <div className="admin-tabs" aria-label="Request type">{[['all','All requests'],['in','Check-ins'],['out','Check-outs']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label} <span className="admin-badge">{pendingRecords.filter(r=>key==='all'||(key==='out'?!!r.check_out:!r.check_out)).length}</span></button>)}</div>
      <div className="admin-toolbar p-4"><input aria-label="Search requests" type="search" placeholder="Search name or designation…" value={query} onChange={e=>setQuery(e.target.value)}/><input aria-label="Filter request date" type="date" value={date} onChange={e=>setDate(e.target.value)}/>{(query||date)&&<button className="admin-link" onClick={()=>{setQuery('');setDate('');}}>Clear filters</button>}<span className="text-xs text-slate-500">{visible.length} requests</span></div>
      <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Team member</th><th>Request</th><th>Check-in</th><th>Check-out</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {!busy&&visible.map(r=><tr key={r.id}><td><Person person={person(r.user)}/></td><td><strong>{r.check_out?'Check-out':'Check-in'}</strong><small className="block text-slate-500 mt-1">{r.date}</small></td><td>{formatAttendanceTime(r.check_in)}</td><td>{formatAttendanceTime(r.check_out)}</td><td><Status value={reviews[r.id]?.state === 'saving' ? 'Processing' : reviews[r.id]?.state === 'queued' ? 'Queued' : 'Pending'}/></td><td><div className="flex gap-2"><button className="admin-button primary" disabled={['queued','saving'].includes(reviews[r.id]?.state)} onClick={()=>review(r,'Present')}>{reviews[r.id]?.state === 'saving' ? 'Processing…' : reviews[r.id]?.state === 'queued' ? 'Queued' :r.check_out?'Approve check-out':'Approve check-in'}</button><button className="admin-button" disabled={['queued','saving'].includes(reviews[r.id]?.state)} onClick={()=>review(r,'Late')}>Approve as late</button><button className="admin-button danger" disabled={['queued','saving'].includes(reviews[r.id]?.state)} onClick={()=>review(r,'Absent')}>Reject</button></div>{reviews[r.id]?.state === 'failed' && <p role="alert" className="mt-2 text-xs text-red-700">Decision could not be confirmed. <button type="button" className="underline font-semibold" onClick={() => review(r, reviews[r.id].status)}>Retry decision</button></p>}</td></tr>)}
      {(busy||!visible.length)&&<tr><td colSpan="6" className="admin-empty">{busy?'Loading requests…':error?'Requests unavailable.':'No pending requests match these filters.'}</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}
