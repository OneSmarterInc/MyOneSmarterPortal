import { portalAlert, portalConfirm } from './PortalDialog';
import React, { useState, useEffect } from 'react';
import { getLeaveRequests, createLeaveRequest, deleteLeaveRequest } from '../services/api';

export default function EmployeeWFH({ user }) {
  const [history, setHistory] = useState([]);
  
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    reason: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Table Filter & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, []);

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterDate]);

  const fetchData = async () => {
    try {
      const reqRes = await getLeaveRequests();
      // Filter strictly for WFH requests belonging to this user
      setHistory(reqRes.data.filter(item => item.user_id === user.user_id && item.request_type === 'Work From Home'));
    } catch (err) {
      console.error(err);
    }
  };

  const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayStr = getTodayString();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });

    // Prevent submitting overlapping/duplicate dates
    const newStart = formData.start_date;
    const newEnd = formData.end_date;
    
    const hasDuplicate = history.some(record => 
      record.status !== 'Rejected' && 
      (newStart <= record.end_date && newEnd >= record.start_date)
    );

    if (hasDuplicate) {
      setMsg({ text: 'Duplicate found: You already have a WFH request on these dates.', type: 'error' });
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
      setMsg({ text: 'Failed to submit WFH request.', type: 'error' });
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
    const searchLower = searchQuery.toLowerCase();
    
    // 1. Text match (Reason or Status)
    const matchesText = 
      item.reason.toLowerCase().includes(searchLower) ||
      item.status.toLowerCase().includes(searchLower);

    // 2. Single Date Filter (checks if chosen date falls between start and end)
    const matchesDate = filterDate 
      ? (item.start_date <= filterDate && item.end_date >= filterDate) 
      : true;

    return matchesText && matchesDate;
  });

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const indexOfLastRecord = currentPage * itemsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - itemsPerPage;
  const currentRecords = filteredRecords.slice(indexOfFirstRecord, indexOfLastRecord);

  const handlePageChange = (direction) => {
    if (direction === 'next' && currentPage < totalPages) setCurrentPage(prev => prev + 1);
    if (direction === 'prev' && currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  return (
    <div className="w-full max-w-7xl flex flex-col gap-6 relative h-full">
      
      {/* Header Panel */}
      <div className="bg-white p-6 sm:px-8 sm:py-7 rounded-[14px] shadow-sm border border-slate-200 border-t-[4px] border-t-indigo-600 flex flex-col relative shrink-0">
        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1.5">Remote Work Console</span>
        <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Work From Home (WFH)</h2>
        <p className="text-sm text-slate-500 mt-1 font-medium">Submit remote work applications and track your WFH history.</p>
      </div>

      <div className="flex flex-col gap-6 flex-grow min-h-0">
        
        {/* TOP ROW: Application Form */}
        <div className="bg-white rounded-[14px] border border-slate-200 shadow-sm flex flex-col shrink-0 z-20">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-900">1. Apply for WFH</h3>
          </div>
          
          <div className="p-5">
            {msg.text && (
              <div className={`p-3 mb-5 rounded-lg text-[10px] font-bold uppercase tracking-wide ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-5">
              
              {/* Dates Block */}
              <div className="w-full md:w-1/3 grid grid-cols-2 gap-4 shrink-0">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Start Date</label>
                  <input type="date" required min={todayStr} value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-indigo-500 rounded-lg bg-slate-50" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">End Date</label>
                  <input type="date" required min={formData.start_date || todayStr} value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-indigo-500 rounded-lg bg-slate-50" />
                </div>
              </div>

              {/* Reason & Submit Button Block */}
              <div className="w-full md:w-2/3 flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-grow w-full">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Reason / Deliverables</label>
                  <input type="text" required placeholder="Brief reason or tasks planned..." value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-indigo-500 rounded-lg bg-slate-50" />
                </div>
                <button type="submit" disabled={loading} className="w-full sm:w-auto bg-zinc-900 hover:bg-black disabled:bg-slate-400 text-white px-8 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition shadow-sm h-[42px] shrink-0">
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>

            </form>
          </div>
        </div>

        {/* BOTTOM ROW: WFH History */}
        <div className="bg-white rounded-[14px] border border-slate-200 shadow-sm flex flex-col flex-grow min-h-[400px] z-10">
          <div className="p-4 border-b border-slate-100 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-900 shrink-0">2. WFH History</h3>
            
            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <input 
                type="text" 
                placeholder="Search reason..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="border border-slate-300 p-2 rounded-lg text-xs w-full md:w-48 outline-none focus:border-indigo-500 bg-slate-50"
              />
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Date</span>
                <input 
                  type="date" 
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="border border-slate-300 p-2 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50"
                />
              </div>
            </div>
          </div>
          
          <div className="overflow-y-auto no-scrollbar flex-grow p-5">
            <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col h-full">
              <div className="overflow-y-auto no-scrollbar flex-grow">
                <table className="w-full text-left text-xs border-collapse bg-white">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[9px] tracking-widest">
                      <th className="p-4 font-bold">Start Date</th>
                      <th className="p-4 font-bold">End Date</th>
                      <th className="p-4 font-bold">Reason</th>
                      <th className="p-4 font-bold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRecords.length > 0 ? currentRecords.map(item => {
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
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredRecords.length > 0 && (
                <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredRecords.length)} of {filteredRecords.length}
                  </span>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => handlePageChange('prev')} 
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-slate-100 transition shadow-sm"
                    >
                      Prev
                    </button>
                    <button 
                      type="button"
                      onClick={() => handlePageChange('next')} 
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-slate-100 transition shadow-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
