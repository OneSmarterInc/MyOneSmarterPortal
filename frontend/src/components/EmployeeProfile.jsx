import React, { useState, useEffect } from 'react';
import { getProfile, updateProfile, changePassword } from '../services/api';

export default function EmployeeProfile({ user }) {
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    joining_date: '',
    date_of_birth: '',
    profile_photo: null
  });
  
  const [newUsername, setNewUsername] = useState(user.username || '');
  const [usernamePassword, setUsernamePassword] = useState('');
  const [usernameMsg, setUsernameMsg] = useState({ text: '', type: '' });
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [currentUsername, setCurrentUsername] = useState(user.username || '');

  const saveUsername = async (event) => {
    event.preventDefault();
    setUsernameSaving(true);
    setUsernameMsg({text:'',type:''});
    try {
      const data = new FormData();
      data.append('username', newUsername.trim());
      data.append('current_password', usernamePassword);
      const response = await updateProfile(user.user_id, data);
      const username = response.data.username;
      setCurrentUsername(username);
      setNewUsername(username);
      setUsernamePassword('');
      const savedUser = JSON.parse(localStorage.getItem('user') || 'null');
      if (savedUser?.user_id === user.user_id) {
        localStorage.setItem('user', JSON.stringify({...savedUser, username}));
        window.dispatchEvent(new Event('userUpdated'));
      }
      setUsernameMsg({text:'Username updated. Use it the next time you sign in.',type:'success'});
    } catch (error) {
      setUsernameMsg({text:error.response?.data?.error || 'Unable to update username.',type:'error'});
    } finally {setUsernameSaving(false);}
  };

  const [employment, setEmployment] = useState({ employee_id: '', designation: '', tags: [] });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  // Password State
  const [pwdData, setPwdData] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [pwdMsg, setPwdMsg] = useState({ text: '', type: '' });
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await getProfile(user.user_id);
      setNewUsername(res.data.username || user.username);
      setCurrentUsername(res.data.username || user.username);
      setProfile({
        first_name: res.data.first_name || '',
        last_name: res.data.last_name || '',
        email: res.data.email || '',
        phone: res.data.phone || '',
        address: res.data.address || '',
        joining_date: res.data.joining_date || '',
        date_of_birth: res.data.date_of_birth || '',
      });
      setEmployment({ employee_id: res.data.employee_id || '', designation: res.data.designation || '', tags: res.data.tags || [] });
      setPhotoPreview(res.data.profile_photo);
    } catch (err) {
      console.error(err);
    }
  };

  const handleProfileChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ text: '', type: '' });

    const formData = new FormData();
    Object.keys(profile).forEach(key => formData.append(key, profile[key]));
    if (photoFile) formData.append('profile_photo', photoFile);

    try {
      const res = await updateProfile(user.user_id, formData);
      setMsg({ text: res.data.message, type: 'success' });
    } catch (err) {
      setMsg({ text: 'Failed to update profile.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    setPwdMsg({ text: '', type: '' });

    if (pwdData.new_password !== pwdData.confirm_password) {
      return setPwdMsg({ text: 'New passwords do not match.', type: 'error' });
    }

    setPwdLoading(true);
    try {
      await changePassword({
        username: currentUsername,
        old_password: pwdData.old_password,
        new_password: pwdData.new_password
      });
      setPwdMsg({ text: 'Password updated successfully!', type: 'success' });
      setPwdData({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPwdMsg({ text: err.response?.data?.error || 'Failed to update password.', type: 'error' });
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-5">
      
      <header>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-red-700">Employee workspace / Account</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900">My profile</h1>
        <p className="mt-2 text-sm text-slate-600">Keep your contact details current and manage your account securely.</p>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-wrap items-center gap-5">
        <div className="h-16 w-16 shrink-0 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center text-xl font-semibold text-red-700">
          {photoPreview ? <img src={photoPreview} alt="Profile" className="h-full w-full object-cover"/> : currentUsername?.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0"><h2 className="text-lg font-semibold text-zinc-900 break-words">{profile.first_name || profile.last_name ? [profile.first_name,profile.last_name].filter(Boolean).join(' ') : currentUsername}</h2>
          <p className="text-sm text-slate-600 break-all">{profile.email}</p>
          <span className="mt-2 inline-flex rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">{user.role === 'intern' ? 'Intern' : 'Employee'}</span>
        </div>
      </section>
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200">
        <h2 className="text-lg font-semibold text-zinc-900 mb-1">Employment details</h2>
        <p className="text-xs text-slate-500 mb-4">Managed by your administrator.</p>
        <p className="text-xs font-bold text-slate-500">{user.role === 'intern' ? 'Intern ID' : 'Employee ID'}</p>
        <p className="text-sm font-semibold mt-1 mb-3">{employment.employee_id || 'Not assigned'}</p>
        <p className="text-xs font-bold text-slate-500">Designation</p>
        <p className="text-sm font-semibold mt-1 mb-3">{employment.designation || 'Not assigned'}</p>
        <p className="text-xs font-bold text-slate-500 mb-2">Tags</p>
        <div className="flex flex-wrap gap-2">{employment.tags.length ? employment.tags.map(tag => <span key={tag} className="rounded-full bg-red-50 text-red-700 px-3 py-1 text-xs break-all">{tag}</span>) : <span className="text-sm text-slate-500">No tags assigned</span>}</div>
      </div>
      {/* Personal Info Card */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200">
        <h2 className="text-lg font-semibold text-zinc-900 mb-6">Personal information</h2>
        
        {msg.text && (
          <div className={`p-3 mb-6 rounded text-sm font-medium ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={saveProfile} className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-6 items-stretch sm:items-start mb-6 border-b border-slate-100 pb-6">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 border border-slate-300 shrink-0">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs uppercase font-bold">No Image</div>
              )}
            </div>
            <div className="flex-grow min-w-0">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Profile Photo</label>
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="block max-w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-bold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 transition" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">First Name</label>
              <input type="text" name="first_name" value={profile.first_name} onChange={handleProfileChange} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Last Name</label>
              <input type="text" name="last_name" value={profile.last_name} onChange={handleProfileChange} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Email Address</label>
              <input type="email" name="email" value={profile.email} onChange={handleProfileChange} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Phone Number</label>
              <input type="text" name="phone" value={profile.phone} onChange={handleProfileChange} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Date of Birth</label>
              <input type="date" name="date_of_birth" value={profile.date_of_birth} onChange={handleProfileChange} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Joining Date (Read-Only)</label>
              <input type="date" name="joining_date" value={profile.joining_date} disabled className="w-full border border-slate-200 bg-slate-50 text-slate-500 p-2.5 text-sm rounded-lg outline-none cursor-not-allowed" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-2">Home Address</label>
              <textarea name="address" rows="3" value={profile.address} onChange={handleProfileChange} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500"></textarea>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="admin-button primary">
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {['employee','intern'].includes(user.role) && <section className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-semibold text-zinc-900 mb-2">Change username</h3>
        <p className="text-sm text-slate-500 mb-4">Your username is used to sign in. Confirm your current password to change it.</p>
        {usernameMsg.text && <p role={usernameMsg.type==='error'?'alert':'status'} className={`p-3 rounded mb-4 text-sm ${usernameMsg.type==='error'?'bg-red-50 text-red-700':'bg-emerald-50 text-emerald-700'}`}>{usernameMsg.text}</p>}
        <form onSubmit={saveUsername} className="space-y-4 max-w-md">
          <div><label htmlFor="self-username" className="block text-sm font-semibold mb-1">Username</label><input id="self-username" autoComplete="username" required maxLength={150} value={newUsername} onChange={event=>setNewUsername(event.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5" /></div>
          <div><label htmlFor="username-password" className="block text-sm font-semibold mb-1">Current password to change username</label><input id="username-password" type="password" autoComplete="current-password" required value={usernamePassword} onChange={event=>setUsernamePassword(event.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5" /></div>
          <button type="submit" disabled={usernameSaving || !newUsername.trim() || newUsername.trim()===currentUsername} className="admin-button primary">{usernameSaving?'Saving…':'Save username'}</button>
        </form>
      </section>}

      {/* Password Change Card */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">Change password</h3>
        
        {pwdMsg.text && (
          <div className={`p-3 mb-4 rounded text-sm font-medium ${pwdMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {pwdMsg.text}
          </div>
        )}

        <form onSubmit={updatePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Current Password</label>
            <input type="password" value={pwdData.old_password} onChange={e => setPwdData({...pwdData, old_password: e.target.value})} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">New Password</label>
            <input type="password" value={pwdData.new_password} onChange={e => setPwdData({...pwdData, new_password: e.target.value})} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Confirm New Password</label>
            <input type="password" value={pwdData.confirm_password} onChange={e => setPwdData({...pwdData, confirm_password: e.target.value})} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" required />
          </div>
          <button type="submit" disabled={pwdLoading} className="admin-button primary">
            {pwdLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

    </div>
  );
}

