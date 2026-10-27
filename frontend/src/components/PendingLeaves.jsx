import React, { useState, useEffect } from 'react';
import { getLeaveRequests, updateLeaveRequest, getUsers } from '../services/api';
import { Person, Status } from './AdminUI';

export default function PendingLeaves() {
  const [leaves,setLeaves] = useState([]);
  const [users,setUsers] = useState([]);
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState('all');
  const [busy,setBusy] = useState(true);
  const [saving,setSaving] = useState(null);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  async function refresh() {
    setBusy(true);setError('');
    try { const [l,u]=await Promise.all([getLeaveRequests(),getUsers()]);setLeaves(l.data.filter(r=>r.status==='Pending'));setUsers(u.data); }
    catch {setError('Unable to load leave requests. Please try again.');}
    finally {setBusy(false);}
  }
  useEffect(()=>{refresh();},[]);
  const remote = r => ['WFH','Work From Home'].includes(r.request_type);
  const person = r => users.find(u=>u.id===r.user_id || u.username===r.username) || {username:r.username};
  const visible=leaves.filter(r=>(filter==='all'||(filter==='remote'?remote(r):!remote(r)))&&[r.username,r.reason,r.request_type].join(' ').toLowerCase().includes(query.toLowerCase().trim()));
  async function review(record,status) {
    setSaving(record.id);setError('');setNotice('');
    try {await updateLeaveRequest(record.id,{status});setLeaves(p=>p.filter(r=>r.id!==record.id));setNotice(`${record.username}’s request ${status.toLowerCase()}.`);}
    catch {setError('The decision could not be saved. Please try again.');}
    finally {setSaving(null);}
  }
  return <div className="w-full max-w-7xl space-y-5">
    <header className="admin-page-heading"><div><h1>Leave requests</h1><p>Review time off and work-from-home requests.</p></div><button className="admin-button" disabled={busy||saving!==null} onClick={refresh}>Refresh</button></header>
    {error&&<div role="alert" className="admin-error">{error}</div>}
    {notice&&<p role="status" className="admin-notice">{notice}</p>}
    <section className="admin-panel">
      <div className="admin-tabs">{[['all','All requests'],['leave','Time off'],['remote','Work from home']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>
      <div className="admin-toolbar p-4"><input type="search" aria-label="Search leave requests" placeholder="Search person, leave type or reason" value={query} onChange={e=>setQuery(e.target.value)}/><span className="text-sm text-slate-500">{visible.length} pending</span></div>
      <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Employee</th><th>Dates</th><th>Request & reason</th><th>Status</th><th>Decision</th></tr></thead><tbody>
      {!busy&&visible.map(r=><tr key={r.id}><td><Person person={person(r)}/></td><td>{r.start_date}<span className="block text-slate-500 mt-1">{r.end_date!==r.start_date?'to '+r.end_date:'One day'}</span></td><td className="admin-request-reason"><strong>{remote(r)?'Work from home':r.request_type}</strong><p>{r.reason || 'No reason provided'}</p></td><td><Status value="Pending"/></td><td><div className="flex gap-2"><button className="admin-button primary" disabled={saving!==null} onClick={()=>review(r,'Approved')}>{saving===r.id?'Saving…':'Approve'}</button><button className="admin-button danger" disabled={saving!==null} onClick={()=>review(r,'Rejected')}>Reject</button></div></td></tr>)}
      {(busy||!visible.length)&&<tr><td colSpan="5" className="admin-empty">{busy?'Loading requests…':error?'Requests unavailable.':'No pending requests match your filters.'}</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}
