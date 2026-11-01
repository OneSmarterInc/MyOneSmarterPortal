import React, { useState, useEffect } from 'react';
import RecordTable from './RecordTable';
import EmployeeLeaveDetails from './EmployeeLeaveDetails';
import { Avatar, Icon, Status } from './AdminUI';
import { personName } from '../utils/personName';
import { leaveBalances, isWFH } from '../utils/leaveBalances';
import { getUsers, getLeaveRequests, getLeaveAllocations, updateLeaveRequest, addWFHAllowance } from '../services/api';
import './PeopleDirectory.css';
import './LeaveManagement.css';
export default function ManageWFH() {
  const [users,setUsers]=useState([]), [requests,setRequests]=useState([]), [allocations,setAllocations]=useState([]);
  const [selectedIds,setSelectedIds]=useState([]), [days,setDays]=useState(''), [viewing,setViewing]=useState(null);
  const [busy,setBusy]=useState(false), [fetching,setFetching]=useState(true), [error,setError]=useState(''), [notice,setNotice]=useState('');
  async function load() {
    setFetching(true);setError('');
    try {const [u,r,a]=await Promise.all([getUsers(),getLeaveRequests(),getLeaveAllocations()]);setUsers(u.data.filter(p=>['employee','intern'].includes(p.role)));setRequests(r.data);setAllocations(a.data);}
    catch {setError('Could not load work from home balances. Please refresh.');} finally {setFetching(false);}
  }
  useEffect(()=>{load();},[]);
  async function allocate(e) {
    e.preventDefault();if(busy || !selectedIds.length)return;setBusy(true);setError('');
    try {await addWFHAllowance({user_ids:selectedIds,days:Number(days)});setNotice(`${days} WFH days added to each of ${selectedIds.length} selected people.`);setSelectedIds([]);setDays('');await load();}
    catch(e){setError(e.response?.data?.error || 'Could not allocate days. Please try again.');}finally{setBusy(false);}
  }
  async function review(id,status) {
    setBusy(true);setError('');try{await updateLeaveRequest(id,{status});await load();setNotice(`WFH request ${status.toLowerCase()}.`);}catch{setError('Could not save the decision. Please try again.');}finally{setBusy(false);}
  }
  return <div className="w-full max-w-7xl space-y-5">
    <header className="admin-page-heading"><div><h1>Work from home</h1><p>Allocate remote work days and review employee balances and history.</p></div><button className="admin-button" disabled={busy || fetching} onClick={load}>Refresh</button></header>
    {error && <p role="alert" className="admin-error">{error}</p>}{notice && <p role="status" className="admin-notice">{notice}</p>}
    <section className="admin-panel"><form onSubmit={allocate} className="leave-management-controls"><h2 className="font-semibold mr-2">Allocate WFH days</h2><label>Days per person<input required type="number" min="1" max="366" step="1" aria-label="WFH days to add" value={days} onChange={e=>setDays(e.target.value)} className="w-32"/></label><button type="button" className="admin-button" disabled={busy || fetching} onClick={()=>setSelectedIds(users.map(u=>u.id))}>Select all ({users.length})</button><button type="button" className="admin-link" disabled={busy} onClick={()=>setSelectedIds([])}>Clear selection</button><span className="text-sm">{selectedIds.length} selected across all pages</span><button className="admin-button primary" disabled={busy || fetching || !selectedIds.length}>{busy?'Allocating…':`Allocate days to ${selectedIds.length} people`}</button><p className="basis-full text-xs text-slate-500">Pending requests reserve days. Rejected or withdrawn requests release them. Each requested calendar day uses one day.</p></form></section>
    <section className="admin-panel"><div className="p-5 border-b border-slate-100"><h2 className="font-semibold">Employee WFH balances</h2><p className="mt-1 text-xs text-slate-500">Select people to allocate days, or open the eye icon for their complete WFH history.</p></div>{fetching?<p role="status" className="admin-empty">Loading balances…</p>:<RecordTable label="WFH balances"><table className="admin-table leave-balance-table"><thead><tr><th data-nosort>Select</th><th>Employee</th><th>Employee ID</th><th>Role</th><th>Allocated days</th><th>Approved / used</th><th>Pending days</th><th>Available days</th><th>Pending requests</th><th>Action</th></tr></thead><tbody>{users.map(u=>{const a=leaveBalances(u.id,allocations,requests,true)[0] || {allocated:0,approved:0,pending:0,available:0};return <tr key={u.id}><td><input type="checkbox" aria-label={`Select ${personName(u)} for WFH allocation`} checked={selectedIds.includes(u.id)} disabled={busy} onChange={()=>setSelectedIds(ids=>ids.includes(u.id)?ids.filter(id=>id!==u.id):[...ids,u.id])}/></td><td><div className="admin-person"><Avatar person={u}/>{personName(u)}</div></td><td>{u.employee_id || '—'}</td><td><Status value={u.role}/></td><td>{a.allocated}</td><td>{a.approved}</td><td>{a.pending}</td><td><strong>{a.available}</strong></td><td>{requests.filter(r=>r.user_id===u.id && isWFH(r.request_type) && r.status==='Pending').length}</td><td><button className="people-icon-button" title="View WFH details" aria-label={`View WFH details for ${personName(u)}`} onClick={()=>setViewing(u)}><Icon name="eye"/></button></td></tr>;})}</tbody></table></RecordTable>}</section>
    {viewing && <EmployeeLeaveDetails remote person={viewing} allocations={allocations} requests={requests} onClose={()=>setViewing(null)} onReview={review} busy={busy} error={error}/>}
  </div>;
}
