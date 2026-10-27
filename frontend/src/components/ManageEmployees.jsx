import React, { useState, useEffect } from 'react';
import { getUsers, updateUser, deleteUser, getProfile } from '../services/api';

export default function ManageEmployees() {
  const [users, setUsers] = useState([]);
  
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

  const fetchUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this employee?')) return;
    try {
      await deleteUser(id);
      fetchUsers();
    } catch (err) {
      alert('Failed to delete user.');
    }
  };

  const startEdit = async (u) => {
    let profile;
    try {
      const res = await getProfile(u.id);
      profile = res.data;
    } catch {
      alert('Unable to load the birthday. Please try again.');
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
    } catch (err) {
      alert('Failed to load employee profile.');
    }
  };

  return (
    <div className="w-full max-w-6xl space-y-6 relative">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Database</span>
          <h2 className="text-xl font-bold text-zinc-900 mt-0.5">Manage Employees</h2>
          <p className="text-xs text-slate-500">View profiles, edit credentials, manage birthdays and joining dates, or remove access.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase">
              <th className="p-4 font-bold">Employee</th>
              <th className="p-4 font-bold">Email</th>
              <th className="p-4 font-bold">Role</th>
              <th className="p-4 font-bold">Joining Date</th>
              <th className="p-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 overflow-hidden shrink-0">
                    {u.profile_photo ? (
                      <img src={u.profile_photo} alt={u.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px] font-bold">N/A</div>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-zinc-900">{u.username}</div>
                    <div className="text-[10px] font-medium text-slate-500">ID: #{u.id}</div>
                    <div className="text-xs text-slate-600 mt-1">{u.designation || 'No designation'}</div>
                    <div className="flex flex-wrap gap-1 mt-1">{(u.tags || []).map(tag => <span key={tag} className="rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[10px] break-all">{tag}</span>)}</div>
                  </div>
                </td>
                <td className="p-4 text-slate-600">{u.email}</td>
                <td className="p-4 capitalize text-slate-700">{u.role}</td>
                <td className="p-4 text-slate-600">{u.joining_date || '-'}</td>
                <td className="p-4 text-right space-x-3">
                  <button onClick={() => openProfileView(u)} className="text-xs font-bold text-emerald-600 hover:text-emerald-800 uppercase tracking-wider">
                    View
                  </button>
                  <button onClick={() => startEdit(u)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(u.id)} className="text-xs font-bold text-red-600 hover:text-red-800 uppercase tracking-wider">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewingProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-2xl border border-slate-200">
            
            <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-300 overflow-hidden shrink-0">
                  {viewingProfile.profile_photo ? (
                    <img src={viewingProfile.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px] uppercase font-bold">No Image</div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-red-600 uppercase tracking-widest">{viewingProfile.role}</div>
                  <h3 className="text-2xl font-bold text-zinc-900 mt-1">@{viewingProfile.username}</h3>
                  <div className="text-sm font-medium text-slate-500 mt-0.5">ID: #{viewingProfile.id}</div>
                </div>
              </div>
              <button onClick={() => setViewingProfile(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
              <div><p className="text-xs text-slate-500">Designation</p><p className="font-semibold">{viewingProfile.designation || '-'}</p></div>
              <div><p className="text-xs text-slate-500">Tags</p><p className="break-words">{(viewingProfile.tags || []).join(', ') || '-'}</p></div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">First Name</label>
                <div className="text-sm font-semibold text-slate-800">{viewingProfile.first_name || '-'}</div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Last Name</label>
                <div className="text-sm font-semibold text-slate-800">{viewingProfile.last_name || '-'}</div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Email Address</label>
                <div className="text-sm font-semibold text-slate-800">{viewingProfile.email || '-'}</div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Phone Number</label>
                <div className="text-sm font-semibold text-slate-800">{viewingProfile.phone || '-'}</div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Date of Birth</label>
                <div className="text-sm font-semibold text-slate-800">{viewingProfile.date_of_birth || '-'}</div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Joining Date</label>
                <div className="text-sm font-semibold text-slate-800">{viewingProfile.joining_date || '-'}</div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Home Address</label>
                <div className="text-sm font-semibold text-slate-800 bg-slate-50 p-3 rounded border border-slate-100 min-h-[60px]">
                  {viewingProfile.address || '-'}
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8 pt-4 border-t border-slate-100">
              <button onClick={() => setViewingProfile(null)} className="px-6 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition">
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-200">
            
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
              <div className="w-14 h-14 rounded-full bg-slate-200 border border-slate-300 overflow-hidden shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px] uppercase font-bold">No Image</div>
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
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Username</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full border border-slate-300 p-2 text-sm outline-none focus:border-red-500 rounded" required />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Joining Date</label>
                  <input type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} className="w-full border border-slate-300 p-2 text-sm outline-none focus:border-red-500 rounded" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-300 p-2 text-sm outline-none focus:border-red-500 rounded" required />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Role</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="w-full border border-slate-300 p-2 text-sm outline-none focus:border-red-500 rounded bg-white">
                  <option value="intern">Intern</option>
                  <option value="employee">Employee</option>
                </select>
              </div>

              <div>
                <label htmlFor="employee-birthday" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Date of Birth</label>
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
                <p className="mt-1 text-xs text-slate-500">Separate tags with commas. Up to 20 tags, 40 characters each.</p>
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
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-100 rounded transition">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded shadow-sm transition disabled:bg-red-400">
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

