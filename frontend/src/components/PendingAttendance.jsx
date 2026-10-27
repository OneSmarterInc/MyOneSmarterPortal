import React, { useState, useEffect } from 'react';
import { getAttendance, getUsers, updateAttendance } from '../services/api';
import { formatAttendanceTime } from '../utils/attendanceTime';
import { Person, Status } from './AdminUI';

export default function PendingAttendance({ initialFilter = 'all' }) {
  const [records,setRecords] = useState([]);
  const [users,setUsers] = useState([]);
  const [filter,setFilter] = useState(initialFilter);
  const [query,setQuery] = useState('');
  const [date,setDate] = useState('');
  const [busy,setBusy] = useState(true);
  const [saving,setSaving] = useState(null);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  async function refresh() {
    setBusy(true); setError('');
    try { const [a,u] = await Promise.all([getAttendance(),getUsers()]); setRecords(a.data.filter(r=>r.status==='Pending')); setUsers(u.data); }
    catch { setError('Unable to load requests. Please try again.'); }
    finally { setBusy(false); }
  }
  useEffect(()=>{refresh();},[]);
  const person = id => users.find(u=>u.id===id) || {};
  async function review(record,status) {
    setSaving(record.id);setError('');setNotice('');
    try {
      await updateAttendance(record.id,{status});
      setRecords(previous=>previous.filter(r=>r.id!==record.id));
      setNotice(`${person(record.user).username || 'Team member'}: ${record.check_out?'check-out':'check-in'} ${status==='Absent'?'rejected':'approved'+(status==='Late'?' as late':'')}.`);
    } catch { setError('Unable to save this decision. Please try again.'); }
    finally {setSaving(null);}
  }
  const visible=records.filter(r=>(filter==='all'||(filter==='out'?!!r.check_out:!r.check_out))&&(!date||r.date===date)&&[person(r.user).username,person(r.user).designation,person(r.user).email].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="w-full max-w-7xl space-y-5">
    <header className="admin-page-heading"><div><p className="admin-eyebrow">ATTENDANCE MANAGEMENT</p><h1>Attendance approvals</h1><p>Review your team’s check-in and check-out requests.</p></div><button className="admin-button" disabled={busy||saving!==null} onClick={refresh}>Refresh</button></header>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    {notice&&<p role="status" className="rounded-lg bg-emerald-50 text-emerald-800 p-3 text-sm">{notice}</p>}
    <section className="admin-panel">
      <div className="admin-tabs" aria-label="Request type">{[['all','All requests'],['in','Check-ins'],['out','Check-outs']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label} <span className="admin-badge">{records.filter(r=>key==='all'||(key==='out'?!!r.check_out:!r.check_out)).length}</span></button>)}</div>
      <div className="admin-toolbar p-4"><input aria-label="Search requests" type="search" placeholder="Search name or designation…" value={query} onChange={e=>setQuery(e.target.value)}/><input aria-label="Filter request date" type="date" value={date} onChange={e=>setDate(e.target.value)}/>{(query||date)&&<button className="admin-link" onClick={()=>{setQuery('');setDate('');}}>Clear filters</button>}<span className="text-xs text-slate-500">{visible.length} requests</span></div>
      <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Team member</th><th>Request</th><th>Check-in</th><th>Check-out</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {!busy&&visible.map(r=><tr key={r.id}><td><Person person={person(r.user)}/></td><td><strong>{r.check_out?'Check-out':'Check-in'}</strong><small className="block text-slate-500 mt-1">{r.date}</small></td><td>{formatAttendanceTime(r.check_in)}</td><td>{formatAttendanceTime(r.check_out)}</td><td><Status value="Pending"/></td><td><div className="flex gap-2"><button className="admin-button primary" disabled={saving!==null} onClick={()=>review(r,'Present')}>{saving===r.id?'Saving…':r.check_out?'Approve check-out':'Approve check-in'}</button><button className="admin-button" disabled={saving!==null} onClick={()=>review(r,'Late')}>Approve as late</button><button className="admin-button danger" disabled={saving!==null} onClick={()=>review(r,'Absent')}>Reject</button></div></td></tr>)}
      {(busy||!visible.length)&&<tr><td colSpan="6" className="admin-empty">{busy?'Loading requests…':error?'Requests unavailable.':'No pending requests match these filters.'}</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}
