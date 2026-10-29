import React, { useState } from 'react';
import { changePassword } from '../services/api';

export default function ChangePassword({ user, onComplete }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      return setError('New passwords do not match.');
    }
    if (newPassword.length < 8) {
      return setError('Password must be at least 8 characters long.');
    }

    setLoading(true);
    try {
      const response = await changePassword({
        username: user.username,
        old_password: oldPassword,
        new_password: newPassword
      });
      onComplete(response.data.letter_token);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm w-full max-w-md">
      <div className="mb-6">
        <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Security Setup</span>
        <h2 className="text-2xl font-bold text-zinc-900 mt-1">Update Password</h2>
        <p className="text-sm text-slate-500">For security, you must change your temporary password before accessing the portal.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-xs font-medium">{error}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Temporary Password</label>
          <input 
            type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} 
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-600 outline-none" required 
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">New Password</label>
          <input 
            type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} 
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-600 outline-none" required 
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Confirm New Password</label>
          <input 
            type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} 
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-600 outline-none" required 
          />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-2.5 rounded-lg text-sm font-semibold transition shadow-sm mt-2">
          {loading ? 'Updating...' : 'Save & Continue'}
        </button>
      </form>
    </div>
  );
}
