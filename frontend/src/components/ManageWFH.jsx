import React, { useState, useEffect } from 'react';
import { getUsers, getLeaveRequests, createLeaveRequest, updateLeaveRequest } from '../services/api';

export default function ManageWFH() {
  const [users, setUsers] = useState([]);
  const [wfhRecords, setWfhRecords] = useState([]);
  
  // Assignment State
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    reason: 'Assigned by Management'
  });
  
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [showEmployeeList, setShowEmployeeList] = useState(false);

  // Table Filter & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [fetchError,setFetchError] = useState('');
  const [fetching,setFetching] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterDate]);

  async function fetchData() {
    setFetching(true);setFetchError('');
    try {
      const [userRes, reqRes] = await Promise.all([getUsers(), getLeaveRequests()]);
      setUsers(userRes.data.filter(u => u.role !== 'manager'));
      setWfhRecords(reqRes.data.filter(item => ['Work From Home','WFH'].includes(item.request_type)));
    } catch (err) {
      setFetchError('Unable to load this page. Please try again.');
    } finally {setFetching(false);}
  };

  const toggleUser = (id) => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(userId => userId !== id) : [...prev, id]);
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === users.length) setSelectedUsers([]);
    else setSelectedUsers(users.map(u => u.id));
  };

  const handleAssignWFH = async (e) => {
    e.preventDefault();
    if (selectedUsers.length === 0) {
      setMsg({ text: 'Please select at least one employee.', type: 'error' });
      return;
    }

    // Duplicate Check: Prevent assigning if a WFH record already overlaps these dates
    const newStart = formData.start_date;
    const newEnd = formData.end_date;
    
    const hasDuplicate = selectedUsers.some(userId => {
      const user = users.find(u => u.id === userId);
      return wfhRecords.some(record => 
        record.username === user.username && 
        record.status !== 'Rejected' && 
        (newStart <= record.end_date && newEnd >= record.start_date)
      );
    });

    if (hasDuplicate) {
      setMsg({ text: 'Duplicate found: One or more selected employees already have a WFH record on these dates.', type: 'error' });
      return;
    }
    
    setLoading(true);
    try {
      await Promise.all(selectedUsers.map(userId => 
        createLeaveRequest({
          user_id: userId,
          request_type: 'Work From Home',
          start_date: formData.start_date,
          end_date: formData.end_date,
          reason: formData.reason,
          status: 'Approved' 
        })
      ));
      
      setMsg({ text: `Remote days assigned to ${selectedUsers.length} people.`, type: 'success' });
      setSelectedUsers([]);
      setShowEmployeeList(false);
      setFormData({ start_date: '', end_date: '', reason: 'Assigned by Management' });
      fetchData();
    } catch (err) {
      setMsg({ text: 'Failed to assign WFH.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await updateLeaveRequest(id, { status });
      fetchData();
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const getUserDetails = (username) => {
    return users.find(u => u.username === username) || { role: 'N/A', employee_id: '-' };
  };

  const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayStr = getTodayString();

  // --- Filtering & Pagination Logic ---
  const filteredRecords = wfhRecords.filter(item => {
    const emp = getUserDetails(item.username);
    const searchLower = searchQuery.toLowerCase();
    
    // 1. Text match (Name, ID, Reason)
    const matchesText = 
      item.username.toLowerCase().includes(searchLower) ||
      (emp.employee_id && emp.employee_id.toLowerCase().includes(searchLower)) ||
      item.reason.toLowerCase().includes(searchLower);

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
    <div className="admin-legacy w-full max-w-7xl flex flex-col gap-6 relative">
      
      <header className="admin-page-heading"><div><h1>Work from home</h1><p>Assign remote days and review the team’s schedule.</p></div></header>
      {fetchError && <div className="admin-error" role="alert">{fetchError} <button onClick={fetchData}>Try again</button></div>}
      {fetching && <p role="status" className="admin-loading">Loading…</p>}
      <div className="flex flex-col gap-6">
        
        {/* TOP ROW: ASSIGN WFH */}
        <div className="bg-white rounded-lg border border-slate-200 flex flex-col shrink-0 shadow-none z-20">
          <div className="p-5 flex justify-between items-center border-b border-slate-100">
            <h3 className="text-xs font-semibold normal-case tracking-normal text-zinc-900">Assign remote days</h3>
          </div>

          <div className="p-5">
            {msg.text && (
              <div className={`p-3 mb-4 rounded-lg text-xs font-bold normal-case tracking-normal shrink-0 ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handleAssignWFH} className="flex flex-col lg:flex-row gap-6">
              
              {/* Form Inputs */}
              <div className="w-full lg:w-1/3 flex flex-col gap-4 shrink-0">
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="managewfh-field-1" className="block text-xs font-bold normal-case text-slate-500 mb-1.5">Start Date</label>
                      <input id="managewfh-field-1" type="date" min={todayStr} required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-indigo-500 rounded-lg bg-white" />
                    </div>
                    <div>
                      <label htmlFor="managewfh-field-2" className="block text-xs font-bold normal-case text-slate-500 mb-1.5">End Date</label>
                      <input id="managewfh-field-2" type="date" min={formData.start_date || todayStr} required value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-indigo-500 rounded-lg bg-white" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="managewfh-field-3" className="block text-xs font-bold normal-case text-slate-500 mb-1.5">Reason / Note</label>
                    <input id="managewfh-field-3" type="text" required value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-indigo-500 rounded-lg bg-white" />
                  </div>
                </div>
              </div>

              {/* Smart Employee Selection */}
              <div className="w-full lg:w-2/3 flex flex-col">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold normal-case text-slate-500">Select Employees</label>
                </div>

                <div className="relative flex flex-col">
                  <button 
                    type="button" 
                    aria-expanded={showEmployeeList}
                    onClick={() => setShowEmployeeList(!showEmployeeList)}
                    className="w-full border border-slate-300 p-3 text-xs outline-none rounded-lg bg-white flex justify-between items-center hover:border-slate-400 transition"
                  >
                    <span className="font-semibold text-slate-700 truncate">
                      {selectedUsers.length === 0 
                        ? 'Select employees' 
                        : selectedUsers.length === 1
                        ? `@${users.find(u => u.id === selectedUsers[0])?.username || 'Unknown'}`
                        : `@${users.find(u => u.id === selectedUsers[0])?.username || 'Unknown'} and ${selectedUsers.length - 1} others`}
                    </span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showEmployeeList ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </button>
                  
                  {/* Floating Absolute Popup List */}
                  {showEmployeeList && (
                    <div className="mt-2 border border-slate-200 rounded-xl p-4 bg-white shadow-xl flex flex-col gap-3 animate-fade-in z-50">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                        <span className="text-xs font-semibold text-slate-400 normal-case tracking-normal">Team members</span>
                        <button type="button" onClick={toggleAllUsers} className="admin-button  ">
                          {selectedUsers.length === users.length && users.length > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      
                      <div className="overflow-auto max-h-[250px]">
                        {users.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {users.map(u => (
                              <label key={u.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition border border-transparent hover:border-slate-200">
                                <input 
                                  type="checkbox" 
                                  checked={selectedUsers.includes(u.id)}
                                  onChange={() => toggleUser(u.id)}
                                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                />
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-zinc-900">@{u.username}</span>
                                  <span className="text-xs font-bold text-slate-400 normal-case tracking-normal bg-slate-100 px-1.5 py-0.5 rounded">{u.role}</span>
                                </div>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 text-center p-4">No employees available.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex justify-end shrink-0">
                  <button type="submit" disabled={loading || selectedUsers.length === 0} className="admin-button primary w-full sm:w-auto">
                    {loading ? 'Assigning...' : `Assign to ${selectedUsers.length} people`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* BOTTOM ROW: WFH RECORDS TABLE */}
        <div className="bg-white rounded-lg border border-slate-200 flex flex-col min-h-[260px] shadow-none z-10">
          <div className="p-4 border-b border-slate-100 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-xs font-semibold normal-case tracking-normal text-zinc-900 shrink-0">Remote work records</h3>
            
            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <input 
                type="text" 
                placeholder="Name, ID, or reason..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="border border-slate-300 p-2 rounded-lg text-xs w-full md:w-48 outline-none focus:border-indigo-500 bg-slate-50"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 normal-case">Date</span>
                <input 
                  type="date" 
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="border border-slate-300 p-2 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50"
                />
              </div>
            </div>
          </div>
          
          <div className="overflow-auto flex-grow p-5">
            <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col h-full">
              <div className="overflow-auto flex-grow">
                <table className="w-full text-left text-xs border-collapse bg-white">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-200 text-slate-400 normal-case text-xs tracking-normal">
                      <th className="p-4 font-bold">Emp ID</th>
                      <th className="p-4 font-bold">Name</th>
                      <th className="p-4 font-bold">Start Date</th>
                      <th className="p-4 font-bold">End Date</th>
                      <th className="p-4 font-bold">Reason</th>
                      <th className="p-4 font-bold text-center">Status</th>
                      <th className="p-4 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRecords.length > 0 ? currentRecords.map(item => {
                      const emp = getUserDetails(item.username);
                      
                      // Status and Date Logic
                      const isPast = item.end_date < todayStr;
                      
                      // Dynamically render "Completed" if the approved date is in the past
                      let displayStatus = item.status;
                      if (item.status === 'Approved' && isPast) {
                        displayStatus = 'Completed';
                      }
                      
                      return (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <td className="p-4">
                            <span className="font-semibold text-slate-500 normal-case">{emp.employee_id || '-'}</span>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-zinc-900 text-sm">@{item.username}</div>
                            <div className="text-xs font-bold text-slate-400 normal-case tracking-normal mt-0.5">{emp.role}</div>
                          </td>
                          <td className="p-4 font-medium text-zinc-800">{item.start_date}</td>
                          <td className="p-4 font-medium text-zinc-800">{item.end_date}</td>
                          <td className="p-4 text-slate-600 whitespace-normal min-w-[180px] max-w-[300px]">{item.reason}</td>
                          
                          {/* DYNAMIC STATUS BADGE */}
                          <td className="p-4 text-center">
                            {displayStatus === 'Pending' && (
                              <span className="inline-block px-3 py-1.5 rounded text-xs font-semibold normal-case tracking-normal bg-amber-50 text-amber-700 border border-amber-200 shadow-none">
                                Pending
                              </span>
                            )}
                            {displayStatus === 'Approved' && (
                              <span className="inline-block px-3 py-1.5 rounded text-xs font-semibold normal-case tracking-normal bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-none">
                                Approved
                              </span>
                            )}
                            {displayStatus === 'Completed' && (
                              <span className="inline-block px-3 py-1.5 rounded text-xs font-semibold normal-case tracking-normal bg-blue-50 text-blue-700 border border-blue-200 shadow-none">
                                Completed
                              </span>
                            )}
                            {displayStatus === 'Rejected' && (
                              <span className="inline-block px-3 py-1.5 rounded text-xs font-semibold normal-case tracking-normal bg-red-50 text-red-700 border border-red-200 shadow-none">
                                Rejected
                              </span>
                            )}
                          </td>
                          
                          <td className="p-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              
                              {/* Pending Action Buttons */}
                              {displayStatus === 'Pending' && !isPast && (
                                <>
                                  <button onClick={() => handleStatusUpdate(item.id, 'Approved')} className="admin-button primary ">Approve</button>
                                  <button onClick={() => handleStatusUpdate(item.id, 'Rejected')} className="admin-button danger ">Reject</button>
                                </>
                              )}
                              
                              {/* Action: Reject an Approved Request */}
                              {displayStatus === 'Approved' && !isPast && (
                                <button onClick={() => { if(window.confirm('Reject this WFH request?')) handleStatusUpdate(item.id, 'Rejected') }} className="admin-button danger " title="Reject Request">
                                  Reject
                                </button>
                              )}

                              {/* Action: Approve a Rejected Request */}
                              {displayStatus === 'Rejected' && !isPast && (
                                <button onClick={() => { if(window.confirm('Approve this WFH request?')) handleStatusUpdate(item.id, 'Approved') }} className="admin-button  " title="Approve Request">
                                  Approve
                                </button>
                              )}

                              {/* Disabled Button showing final action for Past Dates */}
                              {isPast && (
                                <>
                                  {item.status === 'Approved' && (
                                    <button disabled className="admin-button  ">Approve</button>
                                  )}
                                  {item.status === 'Rejected' && (
                                    <button disabled className="admin-button danger ">Reject</button>
                                  )}
                                  {item.status === 'Pending' && (
                                    <button disabled className="admin-button  ">Expired</button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan="7" className="p-10 text-center text-slate-400 text-xs border-dashed">No WFH records found matching your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {filteredRecords.length > 0 && (
                <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                  <span className="text-xs font-bold text-slate-500 normal-case tracking-normal">
                    Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredRecords.length)} of {filteredRecords.length}
                  </span>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => handlePageChange('prev')} 
                      disabled={currentPage === 1}
                      className="admin-button  "
                    >
                      Prev
                    </button>
                    <button 
                      type="button"
                      onClick={() => handlePageChange('next')} 
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="admin-button  "
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