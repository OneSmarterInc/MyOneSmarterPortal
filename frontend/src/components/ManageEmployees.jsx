import ManagerDialog from './ManagerDialog';
import './LeaveManagement.css';
import RecordTable from './RecordTable';
import { personName } from '../utils/personName';
import { portalAlert, portalConfirm } from './PortalDialog';
import './PeopleDirectory.css';
import { Avatar, Icon, Status } from './AdminUI';
import React, { useState, useEffect } from 'react';
import { getUsers, updateUser, deleteUser, getProfile, setUserAccess } from '../services/api';

export default function ManageEmployees({ onAddEmployee, initialUserId = null }) {
  const [users, setUsers] = useState([]);
  const [accessFilter, setAccessFilter] = useState('active');
  const [viewerId] = useState(() => { try { return JSON.parse(localStorage.getItem('user') || '{}').user_id; } catch { return null; } });
  const [accessBusy, setAccessBusy] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmation: '', show: false });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [copiedEmail, setCopiedEmail] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const team = users;
  const tagOptions = [...new Set(team.flatMap(u=>u.tags||[]))].sort();
  const visible = team.filter(u=>(accessFilter === 'all' || (u.is_active !== false) === (accessFilter === 'active'))&&(!roleFilter||u.role===roleFilter)&&(!tagFilter||(u.tags||[]).includes(tagFilter))&&[personName(u),u.employee_id,u.email,u.designation,u.role,u.date_of_birth,u.monthly_attendance ? `${u.monthly_attendance.attended_days}/${u.monthly_attendance.total_working_days}` : '',...(u.tags||[])].join(' ').toLowerCase().includes(query.trim().toLowerCase()));

  const [editingUser, setEditingUser] = useState(null);
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState('intern'); // Default changed to intern
  const [birthDate, setBirthDate] = useState('');
  const [today] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [joiningDate, setJoiningDate] = useState('');
  const [designation, setDesignation] = useState('');
  const [tags, setTags] = useState('');
  const [resetPassword, setResetPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [viewingProfile, setViewingProfile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchUsers();
    window.addEventListener('peopleUpdated', fetchUsers);
    return () => window.removeEventListener('peopleUpdated', fetchUsers);
  }, []);

  async function fetchUsers() {
    setFetching(true);setFetchError('');
    try {
      const res = await getUsers({ include_inactive: true });
      setUsers(res.data);
    } catch {
      setFetchError('Unable to load people. Please try again.');
    } finally {setFetching(false);}
  };

  async function toggleAccess(user) {
    const active = user.is_active !== false;
    if (!await portalConfirm(`${active ? 'Revoke access for' : 'Restore access for'} ${personName(user)}?${active ? ' Sign-in will be disabled. Existing records will be kept.' : ''}`, active)) return;
    setAccessBusy(user.id);
    try { const {data} = await setUserAccess(user.id, !active); setMsg({text:data.message,type:'success'}); await fetchUsers(); }
    catch(e) { setMsg({text:e.response?.data?.error || 'Could not change access.',type:'error'}); }
    finally { setAccessBusy(null); }
  }
  async function resetPersonPassword(e) {
    e.preventDefault();
    if (passwordBusy) return;
    if (passwordForm.password !== passwordForm.confirmation) { setPasswordError('Passwords do not match.'); return; }
    setPasswordBusy(true);setPasswordError('');
    try {
      const {data} = await updateUser(passwordTarget.id, {reset_password:true,password:passwordForm.password});
      if (data.letter_token) { const saved=JSON.parse(localStorage.getItem('user') || '{}'); localStorage.setItem('user',JSON.stringify({...saved,letter_token:data.letter_token}));window.dispatchEvent(new Event('userUpdated')); }
      setMsg({text:'Password reset. Share the temporary password securely; the user must change it at next login.',type:'success'});setPasswordTarget(null);setPasswordForm({password:'',confirmation:'',show:false});
    } catch(e) { setPasswordError(e.response?.data?.error || 'Could not reset password.'); }
    finally { setPasswordBusy(false); }
  }

  const copyEmail = async address => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopiedEmail(address);
    } catch {
      setCopiedEmail('');
      setMsg({ text: 'Could not copy email. Please check browser clipboard permissions.', type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!await portalConfirm('Remove this person from the team? Login will be disabled. Issued document records will be retained for verification.', true)) return;
    try {
      const response = await deleteUser(id);
      setUsers(previous => previous.filter(person => person.id !== id));
      setMsg({ text: response.data.message, type: 'success' });
      await fetchUsers();
    } catch (err) {
      portalAlert(err.response?.data?.error || 'Unable to delete. Please sign in again and retry.');
    }
  };

  const startEdit = async (u) => {
    let profile;
    try {
      const res = await getProfile(u.id);
      profile = res.data;
    } catch {
      portalAlert('Unable to load the profile. Please try again.');
      return;
    }
    setBirthDate(profile.date_of_birth || '');
    setDesignation(profile.designation || '');
    setTags((profile.tags || []).join(', '));
    setResetPassword(false);
    setEditingUser(u);
    setEmail(u.email);
    setEmployeeId(profile.employee_id || '');
    // Only map valid roles. If somehow manager exists, default back to intern.
    setRole(u.role === 'employee' ? 'employee' : 'intern'); 
    setJoiningDate(u.joining_date || '');
    setPhotoPreview(u.profile_photo);
    setPassword('');
    setConfirmResetPassword('');
    setShowResetPassword(false);
    setMsg({ text: '', type: '' });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (resetPassword && (password.length < 8 || password !== confirmResetPassword)) {
      setMsg({ text: password.length < 8 ? 'Temporary password must be at least 8 characters.' : 'Temporary passwords do not match.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      await updateUser(editingUser.id, { 
        email,
        role, 
        designation,
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
        ...(resetPassword ? { reset_password: true, password } : {}),
        joining_date: joiningDate,
        date_of_birth: birthDate || null 
      });
      setMsg({ text: resetPassword ? 'Password reset saved. The employee must sign in with the new temporary password and change it.' : 'Employee updated successfully.', type: 'success' });
      fetchUsers();
      setTimeout(() => setEditingUser(null), 1500);
    } catch (err) {
      setMsg({ text: err.response?.data?.error || (err.response?.data ? JSON.stringify(err.response.data) : 'Update failed.'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const openProfileView = async (u) => {
    try {
      const res = await getProfile(u.id);
      setViewingProfile({
        ...res.data,
        username: u.username,
        role: u.role,
        id: u.id
      });
    } catch {
      portalAlert('Failed to load employee profile.');
    }
  };

  useEffect(() => {
    if (initialUserId == null || fetching || fetchError) return;
    const target = users.find(u => String(u.id) === String(initialUserId));
    if (target) openProfileView(target);
  }, [initialUserId, fetching, fetchError, users]);

  return (
    <div className="w-full max-w-7xl space-y-5 relative">
      <header className="admin-page-heading"><div><h1>People directory</h1><p>Manage your team’s profiles and monthly attendance.</p></div><button className="admin-button primary" onClick={onAddEmployee}>+ Onboard employee</button></header>
      <div className="admin-toolbar"><input type="search" aria-label="Search people" placeholder="Search name, ID, email, birthday, designation or tag…" value={query} onChange={e=>{setQuery(e.target.value);}}/><select aria-label="Filter by role" value={roleFilter} onChange={e=>{setRoleFilter(e.target.value);}}><option value="">All roles</option><option value="employee">Employees</option><option value="intern">Interns</option><option value="manager">Managers</option></select><select aria-label="Filter by tag" value={tagFilter} onChange={e=>{setTagFilter(e.target.value);}}><option value="">All tags</option>{tagOptions.map(t=><option key={t}>{t}</option>)}</select><select aria-label="Filter by access" value={accessFilter} onChange={e=>setAccessFilter(e.target.value)}><option value="active">Active access</option><option value="revoked">Revoked access</option><option value="all">All access</option></select><span className="text-xs text-slate-500">{visible.length} people</span></div>
      {fetchError && <p role="alert" className="admin-error">{fetchError} <button onClick={fetchUsers}>Try again</button></p>}
      {msg.type === 'success' && msg.text && <p role="status" className="text-sm text-emerald-700">{msg.text}</p>}
      {copiedEmail && <p role="status" className="text-sm text-emerald-700">Copied email: {copiedEmail}</p>}
      {msg.type === 'error' && msg.text && <p role="alert" className="admin-error">{msg.text}</p>}
      {fetching ? <p className="admin-empty">Loading people…</p> : <div className="admin-panel overflow-hidden">
        <div className="overflow-x-auto">
          <RecordTable label="People directory" searchable={false}><table className="admin-table people-directory-table w-full">
            <thead><tr><th>Employee</th><th>Employee ID</th><th>Role</th><th>Email (click to copy)</th><th>Date of birth</th><th>Attendance this month</th><th>Access</th><th className="text-right">Actions</th></tr></thead>
            <tbody>{visible.map(u => <tr key={u.id}>
              <td><button type="button" onClick={() => openProfileView(u)} className="admin-person text-left hover:text-red-700" aria-label={`View profile for ${personName(u)}`}><Avatar person={u}/><span><span className="font-semibold">{personName(u)}</span></span></button></td>
              <td>{u.employee_id || '—'}</td>
              <td><Status value={u.role}/></td>
              <td>{u.email ? <button type="button" title="Copy email address" aria-label={`Copy email address ${u.email}`} className="text-red-700 hover:underline break-all text-left" onClick={() => copyEmail(u.email)}>{u.email} {copiedEmail === u.email ? '✓ Copied' : '⧉'}</button> : <span className="text-slate-400">No email</span>}</td>
              <td data-sort-value={u.date_of_birth || ''}>{u.date_of_birth ? new Date(`${u.date_of_birth}T12:00:00`).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '—'}</td>
              <td data-sort-value={u.monthly_attendance?.attended_days ?? ''}>{u.monthly_attendance ? <span title="Approved Present/Late check-ins on scheduled working days. Full current month, excluding dates before joining. Holidays excluded; half-days count as one working day."><strong>{u.monthly_attendance.attended_days}/{u.monthly_attendance.total_working_days}</strong><small className="block text-slate-500">{u.monthly_attendance.month}</small></span> : '—'}</td>
              <td><span className={`admin-badge ${u.is_active === false ? 'text-red-700' : 'text-emerald-700'}`}>{u.is_active === false ? 'Revoked' : 'Active'}</span></td>
              <td><div className="people-directory-actions"><button type="button" className="people-icon-button" title="View profile" aria-label={`View profile for ${personName(u)}`} onClick={() => openProfileView(u)}><Icon name="eye" /></button><button type="button" className="people-icon-button" title="Edit employee" aria-label={`Edit ${personName(u)}`} onClick={() => startEdit(u)}><Icon name="edit" /></button><button type="button" className="people-icon-button" title="Reset password" aria-label={`Reset password for ${personName(u)}`} onClick={()=>{setPasswordTarget(u);setPasswordForm({password:'',confirmation:'',show:false});setPasswordError('');}}><Icon name="key" /></button><button type="button" className="people-icon-button" disabled={accessBusy === u.id || u.id === viewerId} title={u.id === viewerId ? 'You cannot revoke your own access' : u.is_active === false ? 'Restore access' : 'Revoke access'} aria-label={`${u.is_active === false ? 'Restore' : 'Revoke'} access for ${personName(u)}`} onClick={()=>toggleAccess(u)}><Icon name={u.is_active === false ? 'unlock' : 'lock'} /></button><button type="button" className="people-icon-button people-icon-delete" title="Delete employee" aria-label={`Delete ${personName(u)}`} onClick={() => handleDelete(u.id)}><Icon name="trash" /></button></div></td>
            </tr>)}</tbody>
          </table></RecordTable>
        </div>

      </div>}
      {!fetching&&!fetchError&&!visible.length&&<p className="admin-empty">No people match your filters.</p>}

      {passwordTarget && <ManagerDialog title={`Reset password · ${personName(passwordTarget)}`} busy={passwordBusy} onClose={()=>{setPasswordTarget(null);setPasswordForm({password:'',confirmation:'',show:false});}}>{passwordError && <p className="admin-error" role="alert">{passwordError}</p>}<form className="leave-type-form" onSubmit={resetPersonPassword}><label>Temporary password<input type={passwordForm.show ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={passwordForm.password} onChange={e=>setPasswordForm({...passwordForm,password:e.target.value})}/></label><label>Confirm temporary password<input type={passwordForm.show ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={passwordForm.confirmation} onChange={e=>setPasswordForm({...passwordForm,confirmation:e.target.value})}/></label><label><span><input type="checkbox" checked={passwordForm.show} onChange={e=>setPasswordForm({...passwordForm,show:e.target.checked})}/> Show password</span></label><p className="text-sm text-slate-500">Share the temporary password securely. The person must change it when they next sign in.</p><button className="admin-button primary" disabled={passwordBusy}>{passwordBusy ? 'Resetting…' : 'Reset password'}</button></form></ManagerDialog>}

      {viewingProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200">

            <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-300 overflow-hidden shrink-0">
                  {viewingProfile.profile_photo ? (
                    <img src={viewingProfile.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs normal-case font-bold">No Image</div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-red-600 normal-case tracking-normal">{viewingProfile.role}</div>
                  <h3 className="text-2xl font-bold text-zinc-900 mt-1">{personName(viewingProfile)}</h3>
                  <div className="text-sm font-medium text-slate-500 mt-0.5">Employee ID: {viewingProfile.employee_id || 'Not assigned'}</div>
                </div>
              </div>
              <button onClick={() => setViewingProfile(null)} className="admin-button  ">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
              <div><p className="text-xs text-slate-500">Designation</p><p className="font-semibold">{viewingProfile.designation || '-'}</p></div>
              <div><p className="text-xs text-slate-500">Tags</p><p className="break-words">{(viewingProfile.tags || []).join(', ') || '-'}</p></div>
              <div>
                <label className="block text-xs font-bold normal-case tracking-normal text-slate-400 mb-1">First Name</label>
                <div className="text-sm font-semibold text-slate-800">{viewingProfile.first_name || '-'}</div>
              </div>
              <div>
                <label className="block text-xs font-bold normal-case tracking-normal text-slate-400 mb-1">Last Name</label>
                <div className="text-sm font-semibold text-slate-800">{viewingProfile.last_name || '-'}</div>
              </div>
              <div>
                <label className="block text-xs font-bold normal-case tracking-normal text-slate-400 mb-1">Email Address</label>
                <div className="text-sm font-semibold text-slate-800">{viewingProfile.email || '-'}</div>
              </div>
              <div>
                <label className="block text-xs font-bold normal-case tracking-normal text-slate-400 mb-1">Phone Number</label>
                <div className="text-sm font-semibold text-slate-800">{viewingProfile.phone || '-'}</div>
              </div>
              <div>
                <label className="block text-xs font-bold normal-case tracking-normal text-slate-400 mb-1">Date of Birth</label>
                <div className="text-sm font-semibold text-slate-800">{viewingProfile.date_of_birth || '-'}</div>
              </div>
              <div>
                <label className="block text-xs font-bold normal-case tracking-normal text-slate-400 mb-1">Joining Date</label>
                <div className="text-sm font-semibold text-slate-800">{viewingProfile.joining_date || '-'}</div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold normal-case tracking-normal text-slate-400 mb-1">Home Address</label>
                <div className="text-sm font-semibold text-slate-800 bg-slate-50 p-3 rounded border border-slate-100 min-h-[60px]">
                  {viewingProfile.address || '-'}
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8 pt-4 border-t border-slate-100">
              <button onClick={() => setViewingProfile(null)} className="admin-button primary ">
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4 sm:p-6">
          <div role="dialog" aria-modal="true" aria-label="Edit employee" className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[calc(100dvh-32px)] sm:max-h-[min(780px,calc(100dvh-48px))] flex flex-col overflow-hidden border border-slate-200">

            <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="w-14 h-14 rounded-full bg-slate-200 border border-slate-300 overflow-hidden shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs normal-case font-bold">No Image</div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Edit Employee</h3>
                <p className="text-xs font-medium text-slate-500">{personName(editingUser)}</p>
              </div>
            </div>

            {msg.text && (
              <div className={`mx-6 mt-4 p-3 rounded text-xs font-medium ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {msg.text}
              </div>
            )}

            <form id="edit-employee-form" onSubmit={handleUpdate} className="flex flex-col min-h-0 flex-1">
              <div className="space-y-4 overflow-y-auto min-h-0 flex-1 px-6 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="manageemployees-field-1" className="block text-xs font-bold normal-case tracking-normal text-slate-600 mb-1">Full name</label>
                  <input id="manageemployees-field-1" type="text" value={personName(editingUser)} readOnly aria-readonly="true" className="w-full border border-slate-200 bg-slate-50 text-slate-500 p-2 text-sm rounded" />
                </div>
                <div>
                  <label htmlFor="manageemployees-field-2" className="block text-xs font-bold normal-case tracking-normal text-slate-600 mb-1">Joining Date</label>
                  <input id="manageemployees-field-2" type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} className="w-full border border-slate-300 p-2 text-sm outline-none focus:border-red-500 rounded" />
                </div>
              </div>

              <div>
                <label htmlFor="manageemployee-employee-id" className="block text-xs font-bold text-slate-600 mb-1">Employee ID</label>
                <input id="manageemployee-employee-id" type="text" value={employeeId || 'Assigned automatically'} readOnly className="w-full border border-slate-200 bg-slate-50 p-2 text-sm rounded text-slate-500" />
              </div>
              <div>
                <label htmlFor="manageemployees-field-3" className="block text-xs font-bold normal-case tracking-normal text-slate-600 mb-1">Email</label>
                <input id="manageemployees-field-3" type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-300 p-2 text-sm outline-none focus:border-red-500 rounded" required />
              </div>

              <div>
                <label htmlFor="manageemployees-field-4" className="block text-xs font-bold normal-case tracking-normal text-slate-600 mb-1">Role</label>
                <select id="manageemployees-field-4" value={role} onChange={e => setRole(e.target.value)} className="w-full border border-slate-300 p-2 text-sm outline-none focus:border-red-500 rounded bg-white">
                  <option value="intern">Intern</option>
                  <option value="employee">Employee</option>
                </select>
              </div>

              <div>
                <label htmlFor="employee-birthday" className="block text-xs font-bold normal-case tracking-normal text-slate-600 mb-1">Date of Birth</label>
                <input id="employee-birthday" type="date" value={birthDate} max={today} onChange={e => setBirthDate(e.target.value)} className="w-full border border-slate-300 p-2 text-sm outline-none focus:border-red-500 rounded" />
              </div>

              <div>
                <label htmlFor="edit-employee-designation" className="block text-xs font-bold text-slate-600 mb-1">Designation</label>
                <input id="edit-employee-designation" type="text" maxLength={120} value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Software Engineer" className="w-full border border-slate-300 rounded p-2 text-sm" />
              </div>
              <div>
                <label htmlFor="edit-employee-tags" className="block text-xs font-bold text-slate-600 mb-1">Tags</label>
                <input id="edit-employee-tags" type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. Engineering, Remote" className="w-full border border-slate-300 rounded p-2 text-sm" />
              </div>
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <input type="checkbox" checked={resetPassword} onChange={e => { setResetPassword(e.target.checked); setPassword(''); setConfirmResetPassword(''); }} />
                  Reset this person's password
                </label>
                {resetPassword && <>
                  <input aria-label="New temporary password" name="employee-new-password" autoComplete="new-password" type={showResetPassword ? 'text' : 'password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="New temporary password" className="mt-2 w-full border border-slate-300 p-2 text-sm rounded" />
                  <input aria-label="Confirm temporary password" autoComplete="new-password" type={showResetPassword ? 'text' : 'password'} minLength={8} required value={confirmResetPassword} onChange={e => setConfirmResetPassword(e.target.value)} placeholder="Confirm temporary password" className="mt-2 w-full border border-slate-300 p-2 text-sm rounded" />
                  <label className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={showResetPassword} onChange={e => setShowResetPassword(e.target.checked)} /> Show temporary password</label>
                  <p className="mt-1 text-xs text-slate-500">They will be asked to change this temporary password at their next login.</p>
                </>}
              </div>

              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-white shrink-0">
                <button type="button" onClick={() => setEditingUser(null)} className="admin-button  ">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="admin-button primary ">
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

