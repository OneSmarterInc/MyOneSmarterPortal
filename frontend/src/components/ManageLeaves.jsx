import React, { useEffect, useState } from 'react';
import RecordTable from './RecordTable';
import ManagerDialog from './ManagerDialog';
import EmployeeLeaveDetails from './EmployeeLeaveDetails';
import { Avatar, Icon, Status } from './AdminUI';
import { portalConfirm } from './PortalDialog';
import { personName } from '../utils/personName';
import { leaveBalances } from '../utils/leaveBalances';
import { getUsers, getLeaveAllocations, deleteLeaveAllocation, getLeaveRequests, getLeaveTypes, createLeaveType, editLeaveType, deleteLeaveType, allocateLeaveType } from '../services/api';
import './PeopleDirectory.css';
import './LeaveManagement.css';

const blank = { name: '', description: '', days: '' };
const messageOf = error => error.response?.data?.error || (error.response?.data ? Object.values(error.response.data).flat().join(' ') : 'Could not save. Please try again.');
export default function ManageLeaves() {
  const [users, setUsers] = useState([]), [allocations, setAllocations] = useState([]), [history, setHistory] = useState([]), [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(''), [selectedIds, setSelectedIds] = useState([]);
  const [editor, setEditor] = useState(null), [form, setForm] = useState(blank), [assigning, setAssigning] = useState(false), [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false), [fetching, setFetching] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const policy = types.find(t => String(t.id) === selectedType);
  async function load() {
    setFetching(true); setError('');
    try {
      const [u,a,h,t] = await Promise.all([getUsers(), getLeaveAllocations(), getLeaveRequests(), getLeaveTypes()]);
      setUsers(u.data.filter(p => ['employee','intern'].includes(p.role))); setAllocations(a.data); setHistory(h.data); setTypes(t.data);
      setSelectedType(current => t.data.some(p => String(p.id) === current) ? current : String(t.data[0]?.id || ''));
    } catch { setError('Could not load leave balances. Please refresh.'); }
    finally { setFetching(false); }
  }
  useEffect(() => { load(); }, []);
  async function saveType(e) {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { const data = { ...form, days: Number(form.days) }; if (editor.id) await editLeaveType(editor.id, data); else await createLeaveType(data); setEditor(null); setNotice('Leave type saved. Existing allowance amounts are unchanged.'); await load(); }
    catch(e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  async function removeType() {
    if (!policy || !await portalConfirm(`Remove ${policy.name} from the available leave types? Existing balances and history will be retained.`, true)) return;
    setBusy(true); setError('');
    try { await deleteLeaveType(policy.id); setNotice('Leave type removed. Existing balances and history retained.'); await load(); } catch(e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  async function assign() {
    if (busy || !policy || !selectedIds.length) return; setBusy(true); setError('');
    try { const {data} = await allocateLeaveType(policy.id, selectedIds); setNotice(data.message); setAssigning(false); setSelectedIds([]); await load(); } catch(e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  async function revoke(id) {
    if (!window.confirm('Revoke this allowance? Existing leave requests will remain in history.')) return;
    setBusy(true); try { await deleteLeaveAllocation(id); await load(); } catch(e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  return <div className="w-full max-w-7xl space-y-5">
    <header className="admin-page-heading"><div><h1>Leave quotas</h1><p>Manage leave types and review each person’s available days.</p></div><button className="admin-button" disabled={busy || fetching} onClick={load}>Refresh</button></header>
    {error && <p role="alert" className="admin-error">{error}</p>}{notice && <p role="status" className="admin-notice">{notice}</p>}
    <section className="admin-panel"><div className="leave-management-controls">
      <label>Leave type<select aria-label="Leave type" value={selectedType} onChange={e=>setSelectedType(e.target.value)} disabled={busy || fetching}><option value="">Select leave type</option>{types.map(t=><option key={t.id} value={t.id}>{t.name} · {Number(t.days)} days</option>)}</select></label>
      <button className="admin-button primary" disabled={busy || fetching} onClick={()=>{setEditor({});setForm(blank);setError('');}}>Add leave type</button>
      <button className="people-icon-button" title="Edit leave type" aria-label="Edit leave type" disabled={!policy || busy} onClick={()=>{setEditor(policy);setForm({...policy, days:Number(policy.days)});setError('');}}><Icon name="edit"/></button>
      <button className="people-icon-button people-icon-delete" title="Delete leave type" aria-label="Delete leave type" disabled={!policy || busy} onClick={removeType}><Icon name="trash"/></button>
      <button className="admin-button" disabled={!policy || busy || fetching} onClick={()=>{setAssigning(true);setSelectedIds([]);setError('');}}>Allocate selected type</button>
      {policy?.description && <p className="basis-full text-sm text-slate-500">{policy.description}</p>}
    </div></section>
    <section className="admin-panel"><div className="p-5 border-b border-slate-100"><h2 className="font-semibold">Employee leave balances</h2><p className="text-xs text-slate-500 mt-1">Available days exclude approved and pending requests. Open the eye icon for full history.</p></div>
      {fetching ? <p role="status" className="admin-empty">Loading balances…</p> : <RecordTable label="Leave balances"><table className="admin-table leave-balance-table"><thead><tr><th>Employee</th><th>Employee ID</th><th>Role</th><th>Allocated</th><th>Approved / used</th><th>Pending</th><th>Available days</th><th>By leave type</th><th>Action</th></tr></thead><tbody>{users.map(u=>{const rows=leaveBalances(u.id,allocations,history), total=key=>rows.reduce((sum,row)=>sum+row[key],0);return <tr key={u.id}><td><div className="admin-person"><Avatar person={u}/>{personName(u)}</div></td><td>{u.employee_id || '—'}</td><td><Status value={u.role}/></td><td>{total('allocated')}</td><td>{total('approved')}</td><td>{total('pending')}</td><td><strong>{total('available')}</strong></td><td className="leave-balance-breakdown">{rows.length ? rows.map(row=><span key={row.type}>{row.type}: <strong>{row.available}</strong></span>) : 'No allowance assigned'}</td><td><button className="people-icon-button" aria-label={`View leave details for ${personName(u)}`} title="View leave details" onClick={()=>setViewing(u)}><Icon name="eye"/></button></td></tr>;})}</tbody></table></RecordTable>}
    </section>
    {editor && <ManagerDialog title={editor.id ? 'Edit leave type' : 'Add leave type'} busy={busy} onClose={()=>setEditor(null)}>{error && <p role="alert" className="admin-error">{error}</p>}<form className="leave-type-form" onSubmit={saveType}><label>Name<input required maxLength={100} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Days per allocation<input required type="number" min="0.5" max="366" step="0.5" value={form.days} onChange={e=>setForm({...form,days:e.target.value})}/></label><label>Description<textarea maxLength={1000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><p className="text-xs text-slate-500">Editing the default day count affects future allocations only.</p><button className="admin-button primary" disabled={busy}>{busy?'Saving…':'Save leave type'}</button></form></ManagerDialog>}
    {assigning && policy && <ManagerDialog title={`Allocate ${policy.name}`} busy={busy} onClose={()=>setAssigning(false)}>{error && <p role="alert" className="admin-error">{error}</p>}<p>{Number(policy.days)} days will be added to each selected person.</p><div className="flex gap-3"><button className="admin-button" disabled={busy} onClick={()=>setSelectedIds(users.map(u=>u.id))}>Select all ({users.length})</button><button className="admin-button" disabled={busy} onClick={()=>setSelectedIds([])}>Clear selection</button><span>{selectedIds.length} selected</span></div><RecordTable label="Leave allocation people"><table className="admin-table"><thead><tr><th data-nosort>Select</th><th>Name</th><th>Role</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><input type="checkbox" disabled={busy} aria-label={`Select ${personName(u)}`} checked={selectedIds.includes(u.id)} onChange={()=>setSelectedIds(ids=>ids.includes(u.id)?ids.filter(id=>id!==u.id):[...ids,u.id])}/></td><td>{personName(u)}</td><td>{u.role}</td></tr>)}</tbody></table></RecordTable><button className="admin-button primary" disabled={busy || !selectedIds.length} onClick={assign}>{busy?'Allocating…':'Allocate leave'}</button></ManagerDialog>}
    {viewing && <EmployeeLeaveDetails person={viewing} allocations={allocations} requests={history} onClose={()=>setViewing(null)} onRevoke={revoke} busy={busy} error={error}/>}
  </div>;
}
