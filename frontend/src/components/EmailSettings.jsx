import React, { useState, useEffect } from 'react';
import { getSMTPSettings, saveSMTPSettings } from '../services/api';

export default function EmailSettings() {
  const [formData, setFormData] = useState({
    sender_name: '',
    sender_email: '',
    reply_to_email: '',
    security_protocol: 'TLS',
    smtp_host: '',
    smtp_port: '',
    smtp_username: '',
    smtp_password: '',
  });

  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await getSMTPSettings();
      setFormData({ ...res.data, smtp_password: '' }); // keep password empty visually
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ text: '', type: '' });
    
    try {
      const res = await saveSMTPSettings(formData);
      setStatusMsg({ text: res.data.message, type: 'success' });
      setFormData({ ...formData, smtp_password: '' }); // Clear password field after save
    } catch (err) {
      setStatusMsg({ text: 'Failed to save configuration.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl bg-white p-8 rounded shadow-sm border border-slate-200">
      <h2 className="text-xl font-bold text-zinc-900 mb-6">Email Settings</h2>
      
      {statusMsg.text && (
        <div className={`p-3 mb-6 rounded text-sm font-medium ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {statusMsg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-2">Sender Name</label>
            <input 
              type="text" name="sender_name" value={formData.sender_name} onChange={handleChange}
              className="w-full border border-slate-300 p-2.5 text-sm text-slate-800 outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-2">Sender Email</label>
            <input 
              type="email" name="sender_email" value={formData.sender_email} onChange={handleChange}
              className="w-full border border-slate-300 p-2.5 text-sm text-slate-800 outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-2">Reply-To Email (Optional)</label>
            <input 
              type="email" name="reply_to_email" value={formData.reply_to_email || ''} onChange={handleChange}
              className="w-full border border-slate-300 p-2.5 text-sm text-slate-800 outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-2">Security Protocol</label>
            <select 
              name="security_protocol" value={formData.security_protocol} onChange={handleChange}
              className="w-full border border-slate-300 p-2.5 bg-white text-sm text-slate-800 outline-none focus:border-slate-500"
            >
              <option value="TLS">TLS</option>
              <option value="SSL">SSL</option>
              <option value="None">None</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-2">SMTP Host</label>
            <input 
              type="text" name="smtp_host" value={formData.smtp_host} onChange={handleChange}
              className="w-full border border-slate-300 p-2.5 text-sm text-slate-800 outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-2">SMTP Port</label>
            <input 
              type="number" name="smtp_port" value={formData.smtp_port} onChange={handleChange}
              className="w-full border border-slate-300 p-2.5 text-sm text-slate-800 outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-2">SMTP Username</label>
            <input 
              type="text" name="smtp_username" value={formData.smtp_username || ''} onChange={handleChange}
              className="w-full border border-slate-300 p-2.5 text-sm text-slate-800 outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-2">SMTP Password</label>
            <input 
              type="password" name="smtp_password" value={formData.smtp_password} onChange={handleChange}
              placeholder="Leave blank to keep existing"
              className="w-full border border-slate-300 p-2.5 text-sm text-slate-500 outline-none focus:border-slate-500"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 mt-8 pt-6 flex justify-end">
          <button 
            type="submit" 
            disabled={loading}
            className="bg-zinc-900 hover:bg-black text-white font-bold px-6 py-3 uppercase text-sm tracking-wider transition"
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}