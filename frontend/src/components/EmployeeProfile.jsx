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
      setProfile({
        first_name: res.data.first_name || '',
        last_name: res.data.last_name || '',
        email: res.data.email || '',
        phone: res.data.phone || '',
        address: res.data.address || '',
        joining_date: res.data.joining_date || '',
        date_of_birth: res.data.date_of_birth || '',
      });
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
        username: user.username,
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
    <div className="w-full max-w-4xl space-y-6">
      
      {/* Personal Info Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-zinc-900 mb-6">Personal Information</h2>
        
        {msg.text && (
          <div className={`p-3 mb-6 rounded text-sm font-medium ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={saveProfile} className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start mb-6 border-b border-slate-100 pb-6">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 border border-slate-300 shrink-0">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs uppercase font-bold">No Image</div>
              )}
            </div>
            <div className="flex-grow">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Profile Photo</label>
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-bold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 transition" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">First Name</label>
              <input type="text" name="first_name" value={profile.first_name} onChange={handleProfileChange} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Last Name</label>
              <input type="text" name="last_name" value={profile.last_name} onChange={handleProfileChange} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Email Address</label>
              <input type="email" name="email" value={profile.email} onChange={handleProfileChange} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Phone Number</label>
              <input type="text" name="phone" value={profile.phone} onChange={handleProfileChange} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Date of Birth</label>
              <input type="date" name="date_of_birth" value={profile.date_of_birth} onChange={handleProfileChange} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Joining Date (Read-Only)</label>
              <input type="date" name="joining_date" value={profile.joining_date} disabled className="w-full border border-slate-200 bg-slate-50 text-slate-500 p-2.5 text-sm rounded-lg outline-none cursor-not-allowed" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Home Address</label>
              <textarea name="address" rows="3" value={profile.address} onChange={handleProfileChange} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500"></textarea>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="bg-zinc-900 hover:bg-black text-white px-6 py-2.5 rounded-lg text-sm font-bold transition">
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Password Change Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-zinc-900 mb-4">Change Password</h3>
        
        {pwdMsg.text && (
          <div className={`p-3 mb-4 rounded text-sm font-medium ${pwdMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {pwdMsg.text}
          </div>
        )}

        <form onSubmit={updatePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Current Password</label>
            <input type="password" value={pwdData.old_password} onChange={e => setPwdData({...pwdData, old_password: e.target.value})} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" required />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">New Password</label>
            <input type="password" value={pwdData.new_password} onChange={e => setPwdData({...pwdData, new_password: e.target.value})} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" required />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Confirm New Password</label>
            <input type="password" value={pwdData.confirm_password} onChange={e => setPwdData({...pwdData, confirm_password: e.target.value})} className="w-full border border-slate-300 p-2.5 text-sm rounded-lg outline-none focus:border-red-500" required />
          </div>
          <button type="submit" disabled={pwdLoading} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition">
            {pwdLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

    </div>
  );
}
