import React, { useState, useEffect, useRef } from 'react';
import { managerCreateUser } from '../services/api';

export default function AddEmployeeDialog({ onClose, onCreated }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  // Create Employee State
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('intern'); 
  const [designation, setDesignation] = useState('');
  const [tags, setTags] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [today] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [joiningDate, setJoiningDate] = useState('');
  
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [deliveryWarning, setDeliveryWarning] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setDeliveryWarning(null);

    try {
      const res = await managerCreateUser({ 
        designation,
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean), 
        username, 
        first_name: firstName,
        last_name: lastName,
        email, 
        role, 
        joining_date: joiningDate,
        date_of_birth: birthDate || null 
      });
      if (res.data.email_sent === false) setDeliveryWarning(res.data);
      else setSuccess(`${res.data.message}${res.data.employee_id ? ` ID: ${res.data.employee_id}` : ''}`);
      setDesignation('');
      setTags(''); 
      setUsername(''); 
      setFirstName('');
      setLastName('');
      setEmail(''); 
      setRole('intern'); 
      setJoiningDate('');
      setBirthDate('');
      onCreated(); 
    } catch (err) {
      setError(err.response?.data?.error || (err.response?.data ? JSON.stringify(err.response.data) : 'Failed to create account.'));
    } finally {
      setLoading(false);
    }
  };

  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!loading) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !loading) onClose(); }} aria-label="Add employee" className="m-auto w-[min(720px,95vw)] max-h-[85vh] overflow-y-auto rounded-xl p-0 backdrop:bg-black/40">
      <div id="create-employee-panel"  className="bg-white p-4 sm:px-6 sm:py-4 rounded-xl shadow-none border border-slate-200 shrink-0">
        <div className="mb-3">
          <div className="flex justify-between gap-3"><h3 className="text-xs font-bold normal-case tracking-normal text-zinc-900">Create Employee Account</h3><button type="button" disabled={loading} className="admin-link" onClick={()=>onClose()}>Close</button></div>
          <p className="text-xs text-slate-500">A temporary password will be auto-generated and emailed.</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded text-xs font-bold mb-3">{error}</div>}
        {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-2 rounded text-xs font-bold mb-3">{success}</div>}

        {deliveryWarning && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p>{deliveryWarning.message}</p><p className="mt-2">Employee ID: {deliveryWarning.employee_id || 'Pending'}</p><details className="mt-2"><summary className="cursor-pointer font-semibold">Show temporary password for secure handover</summary><code className="mt-2 block select-all">{deliveryWarning.temporary_password}</code><p>The person must change this password on first login.</p></details></div>}
        <form onSubmit={handleCreateAccount} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <label htmlFor="managerdashboard-field-1" className="block text-xs font-bold normal-case text-slate-600 mb-1">Emp ID</label>
            <input id="managerdashboard-field-1" type="text" value="Assigned automatically" readOnly className="w-full border border-slate-200 bg-slate-50 rounded p-2 text-xs text-slate-500" />
          </div>
          <div>
            <label htmlFor="managerdashboard-field-2" className="block text-xs font-bold normal-case text-slate-600 mb-1">Username</label>
            <input id="managerdashboard-field-2" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-red-500" required />
          </div>
          <div>
            <label htmlFor="new-employee-first-name" className="block text-xs font-bold text-slate-600 mb-1">First name</label>
            <input id="new-employee-first-name" value={firstName} onChange={e => setFirstName(e.target.value)} maxLength={150} required className="w-full border border-slate-300 rounded p-2 text-xs" />
          </div>
          <div>
            <label htmlFor="new-employee-last-name" className="block text-xs font-bold text-slate-600 mb-1">Last name</label>
            <input id="new-employee-last-name" value={lastName} onChange={e => setLastName(e.target.value)} maxLength={150} required className="w-full border border-slate-300 rounded p-2 text-xs" />
          </div>
          <div>
            <label htmlFor="managerdashboard-field-3" className="block text-xs font-bold normal-case text-slate-600 mb-1">Employee Email</label>
            <input id="managerdashboard-field-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-red-500" required />
          </div>
          <div>
            <label htmlFor="managerdashboard-field-4" className="block text-xs font-bold normal-case text-slate-600 mb-1">Joining Date</label>
            <input id="managerdashboard-field-4" type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-red-500" required />
          </div>
          <div>
            <label htmlFor="managerdashboard-field-5" className="block text-xs font-bold normal-case text-slate-600 mb-1">Role</label>
            <select id="managerdashboard-field-5" value={role} onChange={(e) => setRole(e.target.value)} className="w-full border border-slate-300 rounded p-2 bg-white text-xs outline-none focus:border-red-500">
              <option value="intern">Intern</option>
              <option value="employee">Employee</option>
            </select>
          </div>
          <div>
            <label htmlFor="new-employee-birthday" className="block text-xs font-bold normal-case text-slate-600 mb-1">Date of Birth (optional)</label>
            <input id="new-employee-birthday" type="date" value={birthDate} max={today} onChange={e => setBirthDate(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-red-500" />
          </div>
              <div>
                <label htmlFor="new-employee-designation" className="block text-xs font-bold text-slate-600 mb-1">Designation</label>
                <input id="new-employee-designation" type="text" maxLength={120} value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Software Engineer" className="w-full border border-slate-300 rounded p-2 text-sm" />
              </div>
              <div>
                <label htmlFor="new-employee-tags" className="block text-xs font-bold text-slate-600 mb-1">Tags</label>
                <input id="new-employee-tags" type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. Engineering, Remote" className="w-full border border-slate-300 rounded p-2 text-sm" />
              </div>
          <button type="submit" disabled={loading} className="admin-button primary w-full">
            {loading ? 'Processing...' : 'Create'}
          </button>
        </form>
      </div>

  </dialog>;
}
