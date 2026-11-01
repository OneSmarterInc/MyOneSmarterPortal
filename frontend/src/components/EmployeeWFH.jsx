import RecordTable from './RecordTable';
import { istCalendarDate } from '../services/attendanceClock';
import { portalAlert, portalConfirm } from './PortalDialog';
import React, { useState, useEffect } from 'react';
import { getLeaveRequests, createLeaveRequest, deleteLeaveRequest, getWFHAllowances } from '../services/api';

export default function EmployeeWFH({ user }) {
  const [history, setHistory] = useState([]);
  const [allowance, setAllowance] = useState(null);
  const [fetchError, setFetchError] = useState('');

  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    reason: ''
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Table Filter & Pagination State
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    fetchData();
  }, []);


  const fetchData = async () => {
    try {
      setFetchError('');
      const [reqRes, allowanceRes] = await Promise.all([getLeaveRequests(), getWFHAllowances()]);
      setAllowance(allowanceRes.data.find(a => a.user_id === user.user_id) || null);
      // Filter strictly for WFH requests belonging to this user
      setHistory(reqRes.data.filter(item => item.user_id === user.user_id && ['Work From Home', 'WFH'].includes(item.request_type)));
    } catch (err) {
      setFetchError('Could not load work from home days. Refresh to try again.');
      setAllowance(null);
    }
  };

  const getTodayString = () => {
    const d = istCalendarDate(new Date());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayStr = getTodayString();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });

    // Prevent submitting overlapping/duplicate dates
    const newStart = formData.start_date;
    const newEnd = formData.end_date;
    if (!newStart || !newEnd || newEnd < newStart) {
      setMsg({ text: 'Select a start date, then an end date on or after it.', type: 'error' });
      return;
    }

    const hasDuplicate = history.some(record => 
      record.status !== 'Rejected' && 
      (newStart <= record.end_date && newEnd >= record.start_date)
    );

    if (hasDuplicate) {
      setMsg({ text: 'Duplicate found: You already have a WFH request on these dates.', type: 'error' });
      return;
    }

    const days = Math.round((new Date(newEnd) - new Date(newStart)) / 86400000) + 1;
    if (!allowance || days > allowance.remaining) {
      setMsg({ text: 'Not enough allocated work from home days. Contact your manager.', type: 'error' });
      return;
    }
    setLoading(true);

    try {
      await createLeaveRequest({
        user_id: user.user_id,
        request_type: 'Work From Home',
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason,
        status: 'Pending' // Explicitly starts as Pending for employees
      });

      setMsg({ text: 'WFH REQUEST SUBMITTED SUCCESSFULLY.', type: 'success' });
      setFormData({ start_date: '', end_date: '', reason: '' });
      fetchData(); 
    } catch (err) {
      setMsg({ text: err.response?.data?.error || 'Failed to submit WFH request.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Withdraw/Delete Pending Request
  const handleDeleteRequest = async (id) => {
    if (!await portalConfirm('Are you sure you want to withdraw this pending WFH request?', true)) return;
    try {
      await deleteLeaveRequest(id);
      fetchData();
    } catch (err) {
      portalAlert('Failed to delete request.');
    }
  };

  // --- Filtering & Pagination Logic ---
  const filteredRecords = history.filter(item => {
    const matchesDate = filterDate 
      ? (item.start_date <= filterDate && item.end_date >= filterDate) 
      : true;

    return matchesDate;
  });


  const summary = {
    pending: history.filter(item => item.status === 'Pending').length,
    approved: history.filter(item => item.status === 'Approved' && item.end_date >= todayStr).length,
    completed: history.filter(item => item.status === 'Approved' && item.end_date < todayStr).length,
  };
  return (
    <div className="w-full min-w-0 max-w-7xl flex flex-col gap-5 relative">

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-red-700">Employee workspace / Flexible work</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900">Work from home</h1>
          <p className="mt-2 text-sm text-slate-600">Request remote work, review approvals, and manage upcoming plans.</p>
        </div>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex justify-between items-center gap-3"><h2 className="font-semibold">My work from home allowance</h2><button className="admin-button" onClick={fetchData}>Refresh</button></div>{fetchError && <p role="alert" className="admin-error">{fetchError}</p>}<p className="mt-3 text-sm">Allocated: <strong>{allowance?.allocated ?? '—'}</strong> · Used / reserved: <strong>{allowance?.reserved ?? '—'}</strong> · Remaining: <strong>{allowance?.remaining ?? '—'}</strong> days</p><p className="mt-2 text-xs text-slate-500">Your manager allocates days. Each calendar day requested uses one day. Pending requests reserve days; rejected or withdrawn requests release them.</p></section>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {label:'Awaiting approval',value:summary.pending,accent:'text-amber-700',background:'bg-amber-50'},
          {label:'Upcoming approved',value:summary.approved,accent:'text-emerald-700',background:'bg-emerald-50'},
          {label:'Completed',value:summary.completed,accent:'text-slate-700',background:'bg-slate-100'}
        ].map(item => <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
          <div><p className="text-xs font-medium text-slate-500">{item.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{item.value}</p></div>
          <span className={`h-10 w-10 flex items-center justify-center rounded-xl ${item.background} ${item.accent}`} aria-hidden="true">●</span>
        </div>)}
      </div>
      <div className="flex flex-col gap-6 flex-grow min-h-0">

        {/* TOP ROW: Application Form */}
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col shrink-0">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-zinc-900">Request work from home</h3>
          </div>

          <div className="p-5">
            {msg.text && (
              <div className={`p-3 mb-5 rounded-lg text-[10px] font-bold uppercase tracking-wide ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-5 items-end">

              {/* Dates Block */}
              <div className="min-w-0 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Start Date</label>
                  <input aria-label="Start date" type="date" required min={todayStr} value={formData.start_date} onChange={e => { const start = e.target.value; setFormData(previous => ({ ...previous, start_date: start, end_date: !start || previous.end_date < start ? '' : previous.end_date })); }} className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-red-500 rounded-lg bg-slate-50" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">End Date</label>
                  <input aria-label="End date" type="date" required disabled={!formData.start_date} min={formData.start_date || todayStr} value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-red-500 rounded-lg bg-slate-50" />
                </div>
              </div>

              {/* Reason & Submit Button Block */}
              <div className="min-w-0 w-full flex flex-col xl:flex-row gap-3 items-end">
                <div className="flex-grow w-full">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Reason / Deliverables</label>
                  <input type="text" required placeholder="Brief reason or tasks planned..." value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-red-500 rounded-lg bg-slate-50" />
                </div>
                <button type="submit" disabled={loading || !allowance || allowance.remaining < 1} className="admin-button primary w-full xl:w-auto h-[42px] shrink-0">
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>

            </form>
          </div>
        </div>

        {/* BOTTOM ROW: WFH History */}
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col flex-grow min-h-[360px]">
          <div className="p-5 border-b border-slate-100 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-base font-semibold text-zinc-900 shrink-0">Request history</h3>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Date</span>
                <input 
                  type="date" 
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="border border-slate-300 p-2 rounded-lg text-xs outline-none focus:border-red-500 bg-slate-50"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-grow p-4 sm:p-5">
            <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              <div className="overflow-x-auto flex-grow">
                <RecordTable label="My WFH requests"><table className="w-full min-w-[650px] text-left text-sm border-collapse bg-white">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-slate-600 text-xs">
                      <th className="p-4 font-semibold">Start Date</th>
                      <th className="p-4 font-bold">End Date</th>
                      <th className="p-4 font-bold">Reason</th>
                      <th className="p-4 font-bold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length > 0 ? filteredRecords.map(item => {
                      const isPast = item.end_date < todayStr;

                      let displayStatus = item.status;
                      if (item.status === 'Approved' && isPast) {
                        displayStatus = 'Completed';
                      }

                      return (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <td className="p-4 font-medium text-zinc-800">{item.start_date}</td>
                          <td className="p-4 font-medium text-zinc-800">{item.end_date}</td>
                          <td className="p-4 text-slate-600 truncate max-w-[300px] md:max-w-md lg:max-w-xl">{item.reason}</td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              {displayStatus === 'Pending' && (
                                <>
                                  <span className="inline-block px-3 py-1.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
                                    Pending
                                  </span>
                                  <button onClick={() => handleDeleteRequest(item.id)} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded transition shadow-sm" title="Delete Pending Request">
                                    Delete
                                  </button>
                                </>
                              )}
                              {displayStatus === 'Approved' && (
                                <span className="inline-block px-3 py-1.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                                  Approved
                                </span>
                              )}
                              {displayStatus === 'Completed' && (
                                <span className="inline-block px-3 py-1.5 rounded text-[8px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
                                  Completed
                                </span>
                              )}
                              {displayStatus === 'Rejected' && (
                                <span className="inline-block px-3 py-1.5 rounded text-[8px] font-black uppercase tracking-widest bg-red-50 text-red-700 border border-red-200 shadow-sm">
                                  Rejected
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan="4" className="p-10 text-center text-slate-400 text-xs border-dashed">No WFH applications found matching your filters.</td></tr>
                    )}
                  </tbody>
                </table></RecordTable>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
