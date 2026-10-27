import { Avatar, Status } from './AdminUI';
import React, { useState, useEffect } from 'react';
import { getUsers, updateUser, deleteUser, getProfile } from '../services/api';

export default function ManageEmployees({ onAddEmployee }) {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const team = users.filter(u=>['employee','intern','student'].includes(u.role));
  const tagOptions = [...new Set(team.flatMap(u=>u.tags||[]))].sort();
  const visible = team.filter(u=>(!roleFilter||u.role===roleFilter)&&(!tagFilter||(u.tags||[]).includes(tagFilter))&&[u.username,u.email,u.designation,...(u.tags||[])].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  
  const [editingUser, setEditingUser] = useState(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('intern'); // Default changed to intern
  const [birthDate, setBirthDate] = useState('');
  const [today] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [joiningDate, setJoiningDate] = useState('');
  const [designation, setDesignation] = useState('');
  const [tags, setTags] = useState('');
  const [resetPassword, setResetPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  
  const [viewingProfile, setViewingProfile] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setFetching(true);setFetchError('');
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch {
      setFetchError('Unable to load people. Please try again.');
    } finally {setFetching(false);}
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this employee?')) return;
    try {
      await deleteUser(id);
      fetchUsers();
    } catch {
      alert('Failed to delete user.');
    }
  };

  const startEdit = async (u) => {
    let profile;
    try {
      const res = await getProfile(u.id);
      profile = res.data;
    } catch {
      alert('Unable to load the profile. Please try again.');
      return;
    }
    setBirthDate(profile.date_of_birth || '');
    setDesignation(profile.designation || '');
    setTags((profile.tags || []).join(', '));
    setResetPassword(false);
    setEditingUser(u);
    setUsername(u.username);
    setEmail(u.email);
    // Only map valid roles. If somehow manager exists, default back to intern.
    setRole(u.role === 'employee' ? 'employee' : 'intern'); 
    setJoiningDate(u.joining_date || '');
    setPhotoPreview(u.profile_photo);
    setPassword('');
    setMsg({ text: '', type: '' });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateUser(editingUser.id, { 
        username, 
        email, 
        role, 
        designation,
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
        ...(resetPassword ? { reset_password: true, password } : {}),
        joining_date: joiningDate,
        date_of_birth: birthDate || null 
      });
      window.dispatchEvent(new Event('birthdaysUpdated'));
      setMsg({ text: 'Employee updated successfully.', type: 'success' });
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
      alert('Failed to load employee profile.');
    }
  };

  return (
    <div className="w-full max-w-7xl space-y-5 relative">
      <header className="admin-page-heading"><div><h1>People directory</h1><p>Manage your team’s profiles, designations and tags.</p></div><button className="admin-button primary" onClick={onAddEmployee}>+ Add employee</button></header>
      <div className="admin-toolbar"><input type="search" aria-label="Search people" placeholder="Search name, email, designation or tag…" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Filter by role" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="">All roles</option><option value="employee">Employees</option><option value="intern">Interns</option></select><select aria-label="Filter by tag" value={tagFilter} onChange={e=>setTagFilter(e.target.value)}><option value="">All tags</option>{tagOptions.map(t=><option key={t}>{t}</option>)}</select><span className="text-xs text-slate-500">{visible.length} people</span></div>
      {fetchError && <p role="alert" className="admin-error">{fetchError} <button onClick={fetchUsers}>Try again</button></p>}
      {fetching ? <p className="admin-empty">Loading people…</p> : <div className="admin-people-grid">{visible.map(u=><article className="admin-people-card" key={u.id}>
        <header><Avatar person={u} large/><div><h2>{u.username}</h2><p>{u.designation || 'No designation yet'}</p></div></header>
        <Status value={u.role}/><span className="admin-email">{u.email || 'No email provided'}</span>
        <div className="admin-tags">{(u.tags||[]).map(tag=><span key={tag}>{tag}</span>)}</div>
        <div className="admin-card-actions"><button className="admin-button" onClick={()=>openProfileView(u)}>View profile</button><button className="admin-button" onClick={()=>startEdit(u)}>Edit</button><button className="admin-link" aria-label={'Delete '+u.username} onClick={()=>handleDelete(u.id)}>Delete</button></div>
      </article>)}</div>}
      {!fetching&&!fetchError&&!visible.length&&<p className="admin-empty">No people match your filters.</p>}

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
                  <h3 className="text-2xl font-bold text-zinc-900 mt-1">@{viewingProfile.username}</h3>
                  <div className="text-sm font-medium text-slate-500 mt-0.5">ID: #{viewingProfile.id}</div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80]">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-200">
            
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
              <div className="w-14 h-14 rounded-full bg-slate-200 border border-slate-300 overflow-hidden shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs normal-case font-bold">No Image</div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Edit Employee</h3>
                <p className="text-xs font-medium text-slate-500">@{editingUser.username}</p>
              </div>
            </div>
            
            {msg.text && (
              <div className={`p-3 mb-4 rounded text-xs font-medium ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="manageemployees-field-1" className="block text-xs font-bold normal-case tracking-normal text-slate-600 mb-1">Username</label>
                  <input id="manageemployees-field-1" type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full border border-slate-300 p-2 text-sm outline-none focus:border-red-500 rounded" required />
                </div>
                <div>
                  <label htmlFor="manageemployees-field-2" className="block text-xs font-bold normal-case tracking-normal text-slate-600 mb-1">Joining Date</label>
                  <input id="manageemployees-field-2" type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} className="w-full border border-slate-300 p-2 text-sm outline-none focus:border-red-500 rounded" />
                </div>
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
                <p className="mt-1 text-xs text-slate-500">Celebrations appear seven days before their birthday. Clear this field to remove it.</p>
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
                  <input type="checkbox" checked={resetPassword} onChange={e => { setResetPassword(e.target.checked); setPassword(''); }} />
                  Reset this person's password
                </label>
                {resetPassword && <>
                  <input aria-label="New temporary password" name="employee-new-password" autoComplete="new-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full border border-slate-300 p-2 text-sm rounded" />
                  <p className="mt-1 text-xs text-slate-500">They will be asked to change this temporary password at their next login.</p>
                </>}
              </div>

              <div className="flex justify-end gap-3 mt-6">
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

