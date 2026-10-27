import React, { useState, useEffect } from 'react';
import { getLeaveRequests, createLeaveRequest, getLeaveAllocations } from '../services/api';

export default function EmployeeLeave({ user }) {
  const [history, setHistory] = useState([]);
  const [allocations, setAllocations] = useState([]);
  
  const [formData, setFormData] = useState({
    request_type: '',
    start_date: '',
    end_date: '',
    reason: '',
    other_type: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [reqRes, allocRes] = await Promise.all([
        getLeaveRequests(),
        getLeaveAllocations()
      ]);
      setHistory(reqRes.data.filter(item => item.user_id === user.user_id));
      setAllocations(allocRes.data.filter(item => item.user_id === user.user_id));
    } catch (err) {
      console.error(err);
    }
  };

  // --- CALCULATE DYNAMIC LEAVE BALANCES ---
  const balanceMap = {};
  
  // 1. Sum up total assigned days from manager
  allocations.forEach(a => {
    if (!balanceMap[a.leave_type]) {
      balanceMap[a.leave_type] = { total: 0, taken: 0 };
    }
    balanceMap[a.leave_type].total += parseFloat(a.total_days);
  });

  // 2. Subtract taken days (Approved and Pending requests)
  history.forEach(h => {
    if (h.status !== 'Rejected' && balanceMap[h.request_type]) {
      const isHalfDay = h.request_type.toLowerCase().includes('half-day');
      let requestedDays = 0;
      
      if (isHalfDay) {
        requestedDays = 0.5;
      } else {
        const d1 = new Date(h.start_date);
        const d2 = new Date(h.end_date);
        requestedDays = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
      }
      
      balanceMap[h.request_type].taken += requestedDays;
    }
  });

  const availableQuotas = Object.keys(balanceMap).map(key => ({
    name: key,
    total: balanceMap[key].total,
    taken: balanceMap[key].taken,
    remaining: Math.max(0, balanceMap[key].total - balanceMap[key].taken)
  }));

  // --- FORM HANDLING ---
  const isOther = formData.request_type === 'Other';
  const isHalfDaySelected = !isOther && formData.request_type.toLowerCase().includes('half-day');
  const selectedQuota = availableQuotas.find(q => q.name === formData.request_type);
  const requestedDays = isHalfDaySelected ? 0.5 : (formData.start_date && formData.end_date && formData.end_date >= formData.start_date ? Math.round((Date.parse(formData.end_date + 'T00:00:00Z') - Date.parse(formData.start_date + 'T00:00:00Z')) / 86400000) + 1 : 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });

    if (!formData.start_date || (!isHalfDaySelected && !formData.end_date)) {
      setMsg({ text: 'Please select the requested date or range.', type: 'error' }); return;
    }
    if (!isHalfDaySelected && formData.end_date < formData.start_date) {
      setMsg({ text: 'End date cannot be earlier than start date.', type: 'error' }); return;
    }
    if (isOther && !formData.other_type.trim()) {
      setMsg({ text: 'Please describe the other leave type.', type: 'error' }); return;
    }
    if (!isOther && !selectedQuota) {
      setMsg({ text: 'Select a leave type assigned by your manager or choose Other leave.', type: 'error' }); return;
    }
    if (selectedQuota && requestedDays > selectedQuota.remaining) {
      setMsg({ text: `Insufficient leave quota: you have ${selectedQuota.remaining} day(s) available and requested ${requestedDays}.`, type: 'error' }); return;
    }

    setLoading(true);
    try {
      await createLeaveRequest({
        user_id: user.user_id,
        request_type: isOther ? 'Other: ' + formData.other_type.trim() : formData.request_type,
        start_date: formData.start_date,
        end_date: isHalfDaySelected ? formData.start_date : formData.end_date,
        reason: formData.reason
      });
      
      setMsg({ text: 'Leave request submitted successfully.', type: 'success' });
      setFormData({ request_type: '', start_date: '', end_date: '', reason: '', other_type: '' });
      fetchData(); // Refresh dynamic balances instantly
    } catch (err) {
      setMsg({ text: 'Failed to submit request.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl flex flex-col gap-4 relative h-full">
      
      {/* Welcome Panel */}
      <div className="bg-white p-4 sm:px-6 sm:py-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-400"></div>
        <div className="relative z-10">
          <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest">Time Off Console</span>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 mt-0.5 tracking-tight">Leave & Absences</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Monitor your dynamic leave balances and submit absence requests.</p>
        </div>
      </div>

      {/* Dynamic Quotas Widget */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-900 mb-4">My Leave Balances</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {availableQuotas.length > 0 ? availableQuotas.map((quota, idx) => {
            const usagePercent = Math.min((quota.taken / quota.total) * 100, 100);
            return (
              <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase text-slate-700 truncate block mb-2" title={quota.name}>{quota.name}</span>
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-2xl font-black text-zinc-900 tracking-tight leading-none">{quota.remaining} <span className="text-xs font-bold text-slate-400">left</span></span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">/ {quota.total} Total</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full rounded-full ${usagePercent > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${usagePercent}%` }}></div>
                </div>
              </div>
            );
          }) : (
            <div className="col-span-full p-4 border border-slate-200 border-dashed rounded-lg bg-slate-50 text-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Quotas Assigned Yet</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-grow min-h-0">
        
        {/* Leave Application Form */}
        <div className="lg:col-span-1 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-900 mb-4">Submit Application</h3>
          
          {msg.text && (
            <div className={`p-2.5 mb-4 rounded text-[10px] font-bold uppercase tracking-wide ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Leave Type</label>
              <select 
                required
                value={formData.request_type} 
                onChange={e => setFormData({...formData, request_type: e.target.value})} 
                className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-red-500 rounded bg-white font-medium"
              >
                <option value="" disabled>-- Select Leave Type --</option>
                <option value="Other">Other leave / special reason (manager approval)</option>
                {availableQuotas.map((q, idx) => (
                  <option key={idx} value={q.name} disabled={q.remaining <= 0}>
                    {q.name} ({q.remaining} Days Left)
                  </option>
                ))}
              </select>
              {selectedQuota && <p className="mt-2 text-xs text-slate-600">Assigned: {selectedQuota.total} days · Reserved/used: {selectedQuota.taken} · Available: <strong>{selectedQuota.remaining} days</strong></p>}
              {isOther && <p className="mt-2 text-xs text-slate-600">Other leave is reviewed by your manager and does not automatically deduct an assigned quota.</p>}
            </div>
            {isOther && <div><label htmlFor="other-leave-type" className="block text-xs font-semibold text-slate-600 mb-1">Other leave type</label><input id="other-leave-type" required maxLength={80} value={formData.other_type} onChange={e=>setFormData({...formData,other_type:e.target.value})} placeholder="e.g. Family emergency, personal work" className="w-full border border-slate-300 p-2.5 text-sm rounded-lg"/></div>}

            {isHalfDaySelected ? (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Date (Half-Day)</label>
                <input type="date" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-red-500 rounded" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Start Date</label>
                  <input type="date" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">End Date</label>
                  <input type="date" required value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded" min={formData.start_date} />
                </div>
              </div>
            )}

            {requestedDays > 0 && <p className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-600">Requested duration: <strong>{requestedDays} day(s)</strong> · Subject to manager approval</p>}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Reason / Description</label>
              <textarea required placeholder="Brief reason for your request..." rows="3" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-red-500 rounded resize-none" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-zinc-900 hover:bg-black disabled:bg-slate-400 text-white px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm">
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>

        {/* Application History Table */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[500px]">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-900 mb-4 shrink-0">Application History</h3>
          <div className="overflow-y-auto no-scrollbar flex-grow border border-slate-100 rounded">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-widest text-[9px]">
                  <th className="p-3 font-bold">Type</th>
                  <th className="p-3 font-bold">Dates</th>
                  <th className="p-3 font-bold">Reason</th>
                  <th className="p-3 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? history.map(item => {
                  const isHalf = item.request_type.toLowerCase().includes('half-day');
                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                      <td className="p-3 font-bold text-zinc-900">
                        {item.request_type}
                        {isHalf && <span className="block mt-0.5 text-[8px] font-black uppercase text-amber-600 tracking-wider">0.5 Days</span>}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-700">{item.start_date}</div>
                        {!isHalf && item.start_date !== item.end_date && <div className="text-[10px] text-slate-500 mt-0.5">to {item.end_date}</div>}
                      </td>
                      <td className="p-3 text-slate-600 truncate max-w-[150px]">{item.reason}</td>
                      <td className="p-3 text-right">
                        <span className={`inline-block px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${
                          item.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          item.status === 'Rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr><td colSpan="4" className="p-6 text-center text-slate-400 text-xs">No leave applications found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
