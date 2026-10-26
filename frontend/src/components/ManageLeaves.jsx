import React, { useState, useEffect } from 'react';
import { getUsers, getLeaveAllocations, createLeaveAllocation, deleteLeaveAllocation, getLeaveRequests } from '../services/api';

export default function ManageLeaves() {
  const [users, setUsers] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [history, setHistory] = useState([]); 
  
  // -- POLICY MANAGEMENT STATE --
  const [policies, setPolicies] = useState([
    { id: '1', name: 'Permanent Annual Leave', type: 'Fixed Quota', days: 12, details: '12 Days / Year' },
    { id: '2', name: 'Casual Half-Day', type: 'Half-Day', days: 0.5, details: 'Flexible Half-Day' }
  ]);
  
  const [isCreatingPolicy, setIsCreatingPolicy] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    name: '',
    type: 'Fixed Quota',
    days: '',
    singleDate: '',
    startDate: '',
    endDate: ''
  });

  // -- ASSIGNMENT MODAL STATE --
  const [assignModal, setAssignModal] = useState({ isOpen: false, policy: null });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // -- EMPLOYEE DIRECTORY STATE --
  const [viewingEmployee, setViewingEmployee] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [userRes, allocRes, reqRes] = await Promise.all([
        getUsers(),
        getLeaveAllocations(),
        getLeaveRequests() 
      ]);
      setUsers(userRes.data.filter(u => u.role !== 'manager'));
      setAllocations(allocRes.data);
      setHistory(reqRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  // --- CALCULATE TAKEN DAYS ---
  const getTakenDays = (userId, leaveType) => {
    const userReqs = history.filter(h => h.user_id === userId && h.request_type === leaveType && h.status !== 'Rejected');
    let taken = 0;
    userReqs.forEach(req => {
      const isHalfDayReq = req.request_type.toLowerCase().includes('half-day');
      if (isHalfDayReq) {
        taken += 0.5;
      } else {
        const d1 = new Date(req.start_date);
        const d2 = new Date(req.end_date);
        taken += Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
      }
    });
    return taken;
  };

  // --- 1. POLICY CREATION LOGIC ---
  const calculateDateRangeDays = (start, end) => {
    if (!start || !end) return 0;
    const d1 = new Date(start);
    const d2 = new Date(end);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
  };

  const handleCreatePolicy = (e) => {
    e.preventDefault();
    let finalDays = 0;
    let details = '';
    let finalName = policyForm.name;

    if (policyForm.type === 'Fixed Quota') {
      finalDays = parseFloat(policyForm.days);
      details = `${finalDays} Days Quota`;
    } else if (policyForm.type === 'Single Date') {
      finalDays = 1;
      details = `Date: ${policyForm.singleDate}`;
      finalName = `${finalName} (${policyForm.singleDate})`;
    } else if (policyForm.type === 'Half-Day') {
      finalDays = 0.5;
      details = policyForm.singleDate ? `Date: ${policyForm.singleDate}` : 'Flexible';
      finalName = `${finalName} [Half-Day]`;
    } else if (policyForm.type === 'Date Range') {
      finalDays = calculateDateRangeDays(policyForm.startDate, policyForm.endDate);
      details = `${policyForm.startDate} to ${policyForm.endDate}`;
      finalName = `${finalName} (${finalDays} Days)`;
    }

    if (finalDays <= 0) {
      alert("Invalid days calculated. Please check your dates.");
      return;
    }

    const newPolicy = {
      id: Date.now().toString(),
      name: finalName,
      type: policyForm.type,
      days: finalDays,
      details: details
    };

    setPolicies([newPolicy, ...policies]);
    setIsCreatingPolicy(false);
    setPolicyForm({ name: '', type: 'Fixed Quota', days: '', singleDate: '', startDate: '', endDate: '' });
  };

  const handleDeletePolicy = (id) => {
    if (window.confirm('Delete this policy template?')) {
      setPolicies(policies.filter(p => p.id !== id));
    }
  };

  // --- 2. ASSIGNMENT LOGIC ---
  const openAssignModal = (policy) => {
    setAssignModal({ isOpen: true, policy });
    setSelectedUsers([]);
    setMsg({ text: '', type: '' });
  };

  const toggleUser = (id) => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(userId => userId !== id) : [...prev, id]);
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === users.length) setSelectedUsers([]);
    else setSelectedUsers(users.map(u => u.id));
  };

  const submitAssignment = async () => {
    if (selectedUsers.length === 0) {
      setMsg({ text: 'Please select at least one employee.', type: 'error' });
      return;
    }
    
    setLoading(true);
    try {
      await Promise.all(selectedUsers.map(userId => 
        createLeaveAllocation({
          user_id: userId,
          leave_type: assignModal.policy.name,
          total_days: assignModal.policy.days
        })
      ));
      
      setMsg({ text: `Assigned perfectly to ${selectedUsers.length} employee(s).`, type: 'success' });
      setTimeout(() => setAssignModal({ isOpen: false, policy: null }), 1500);
      fetchData();
    } catch (err) {
      setMsg({ text: 'Failed to assign leaves.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllocation = async (id) => {
    if (!window.confirm('Remove this leave assignment from the employee?')) return;
    try {
      await deleteLeaveAllocation(id);
      fetchData();
    } catch (err) {
      alert('Failed to remove assignment.');
    }
  };

  // --- VIEWING DATA FILTERS ---
  const userAllocations = viewingEmployee ? allocations.filter(a => a.user_id === viewingEmployee.id) : [];
  const userHistory = viewingEmployee ? history.filter(h => h.user_id === viewingEmployee.id) : [];

  return (
    <div className="w-full max-w-7xl flex flex-col gap-4 relative h-full">
      
      {/* Welcome Panel */}
      <div className="bg-white p-4 sm:px-6 sm:py-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-400"></div>
        <div className="relative z-10">
          <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest">Leave Administration</span>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 mt-0.5 tracking-tight">Policies & Employee Records</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Create reusable leave policies and monitor specific employee leave records.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-grow min-h-0">
        
        {/* LEFT COLUMN: LEAVE POLICIES */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[550px]">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-900">1. Leave Policies</h3>
            {!isCreatingPolicy && (
              <button onClick={() => setIsCreatingPolicy(true)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition shadow-sm">
                + Create Policy
              </button>
            )}
          </div>

          <div className="p-4 flex-grow overflow-y-auto no-scrollbar bg-slate-50/50">
            {isCreatingPolicy ? (
              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm mb-4 animate-fade-in">
                <h4 className="text-[10px] font-black uppercase text-slate-800 mb-3 border-b border-slate-100 pb-2">New Policy Setup</h4>
                <form onSubmit={handleCreatePolicy} className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-slate-500 mb-1">Policy Name</label>
                    <input type="text" required placeholder="e.g. Summer Break, Maternity" value={policyForm.name} onChange={e => setPolicyForm({...policyForm, name: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded" />
                  </div>
                  
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-slate-500 mb-1">Policy Type</label>
                    <select value={policyForm.type} onChange={e => setPolicyForm({...policyForm, type: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded bg-white">
                      <option value="Fixed Quota">Fixed Annual/Monthly Quota</option>
                      <option value="Single Date">Single Specific Date</option>
                      <option value="Date Range">Date Range (Multiple Days)</option>
                      <option value="Half-Day">Half-Day Leave</option>
                    </select>
                  </div>

                  {policyForm.type === 'Fixed Quota' && (
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-slate-500 mb-1">Total Days</label>
                      <input type="number" required min="0.5" step="0.5" value={policyForm.days} onChange={e => setPolicyForm({...policyForm, days: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded" />
                    </div>
                  )}

                  {(policyForm.type === 'Single Date' || policyForm.type === 'Half-Day') && (
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-slate-500 mb-1">Select Date {policyForm.type === 'Half-Day' && '(Optional)'}</label>
                      <input type="date" required={policyForm.type === 'Single Date'} value={policyForm.singleDate} onChange={e => setPolicyForm({...policyForm, singleDate: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded" />
                    </div>
                  )}

                  {policyForm.type === 'Date Range' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-500 mb-1">Start Date</label>
                        <input type="date" required value={policyForm.startDate} onChange={e => setPolicyForm({...policyForm, startDate: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-500 mb-1">End Date</label>
                        <input type="date" required value={policyForm.endDate} onChange={e => setPolicyForm({...policyForm, endDate: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded" />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
                    <button type="button" onClick={() => setIsCreatingPolicy(false)} className="px-3 py-1.5 text-[9px] font-bold uppercase text-slate-500 hover:bg-slate-100 rounded transition">Cancel</button>
                    <button type="submit" className="bg-zinc-900 hover:bg-black text-white px-4 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider shadow-sm transition">Save Policy</button>
                  </div>
                </form>
              </div>
            ) : null}

            {/* List of Policies */}
            <div className="space-y-3">
              {policies.map(p => (
                <div key={p.id} className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-sm flex justify-between items-center hover:border-slate-300 transition">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900">{p.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">{p.type}</span>
                      <span className="text-[9px] font-semibold text-slate-500">{p.details}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span className="text-sm font-black text-emerald-600">{p.days} Day{p.days !== 1 ? 's' : ''}</span>
                    <div className="flex gap-2 items-center">
                       <button onClick={() => handleDeletePolicy(p.id)} className="text-[8px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-widest transition">Delete</button>
                       <button onClick={() => openAssignModal(p)} className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-3 py-1 rounded text-[9px] font-bold uppercase tracking-widest transition shadow-sm">
                         Assign
                       </button>
                    </div>
                  </div>
                </div>
              ))}
              {policies.length === 0 && !isCreatingPolicy && (
                <div className="text-center p-6 text-slate-400 text-xs font-medium">No policies created yet. Create one to assign it.</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: EMPLOYEE DIRECTORY & RECORDS */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[550px]">
          
          <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0 flex items-center gap-3">
            {viewingEmployee && (
              <button onClick={() => setViewingEmployee(null)} className="text-slate-400 hover:text-slate-700 bg-white border border-slate-200 p-1.5 rounded transition shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              </button>
            )}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-900">
                {viewingEmployee ? "Employee Leave Record" : "2. Employee Directory"}
              </h3>
              {viewingEmployee && (
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  @{viewingEmployee.username} • {viewingEmployee.role}
                </span>
              )}
            </div>
          </div>
          
          <div className="overflow-y-auto no-scrollbar flex-grow p-4">
            
            {/* VIEW 1: EMPLOYEE LIST */}
            {!viewingEmployee ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {users.length > 0 ? users.map(u => {
                  const userPoliciesCount = allocations.filter(a => a.user_id === u.id).length;
                  return (
                    <div key={u.id} className="border border-slate-200 p-3 rounded-lg flex justify-between items-center hover:border-slate-300 transition hover:bg-slate-50">
                      <div>
                        <div className="font-bold text-zinc-900 text-sm">@{u.username}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{u.role}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {userPoliciesCount > 0 && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-emerald-200">{userPoliciesCount} Active Policies</span>}
                        <button onClick={() => setViewingEmployee(u)} className="text-[9px] font-bold uppercase tracking-widest bg-zinc-900 hover:bg-black text-white px-3 py-1.5 rounded shadow-sm transition">
                          View Record
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                   <div className="col-span-full text-center p-8 text-slate-400 text-xs">No employees found.</div>
                )}
              </div>
            ) : (

            /* VIEW 2: SPECIFIC EMPLOYEE RECORD */
              <div className="space-y-6 animate-fade-in">
                
                {/* Section A: Quotas & Remaining Balances */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-100 pb-2">Assigned Quotas</h4>
                  {userAllocations.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {userAllocations.map(a => {
                        const takenDays = getTakenDays(a.user_id, a.leave_type);
                        const totalDays = parseFloat(a.total_days);
                        const remaining = Math.max(0, totalDays - takenDays);
                        const usagePercent = Math.min((takenDays / totalDays) * 100, 100);

                        return (
                          <div key={a.id} className="border border-slate-200 p-3.5 rounded-lg bg-white relative overflow-hidden">
                            <div className="flex justify-between items-start mb-3">
                              <span className="font-bold text-zinc-900 text-xs">{a.leave_type}</span>
                              <button onClick={() => handleDeleteAllocation(a.id)} className="text-[8px] font-bold uppercase tracking-widest text-red-400 hover:text-red-700 transition">Revoke</button>
                            </div>
                            
                            <div className="flex justify-between items-end mb-1">
                              <span className="text-2xl font-black text-zinc-900 leading-none tracking-tight">{remaining} <span className="text-[10px] text-slate-400">Left</span></span>
                              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{takenDays} taken / {totalDays} total</span>
                            </div>
                            
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-2">
                              <div className={`h-full rounded-full ${usagePercent > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${usagePercent}%` }}></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 p-4 bg-slate-50 rounded-lg border border-slate-200 border-dashed text-center">No active leave policies assigned to this employee.</div>
                  )}
                </div>

                {/* Section B: Dates Taken History */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-100 pb-2">History & Dates Taken</h4>
                  {userHistory.length > 0 ? (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 uppercase text-[8px] tracking-widest bg-slate-50">
                          <th className="p-2.5 font-bold rounded-tl-lg">Type</th>
                          <th className="p-2.5 font-bold">Dates</th>
                          <th className="p-2.5 font-bold">Status</th>
                          <th className="p-2.5 font-bold rounded-tr-lg text-right">Requested On</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userHistory.map(h => (
                          <tr key={h.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="p-2.5 font-bold text-slate-700">{h.request_type}</td>
                            <td className="p-2.5">
                               <span className="font-semibold text-zinc-900">{h.start_date}</span>
                               {h.start_date !== h.end_date && <span className="text-slate-500"> to <span className="font-semibold text-zinc-900">{h.end_date}</span></span>}
                            </td>
                            <td className="p-2.5">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                h.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                h.status === 'Rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                                'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {h.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-right text-[10px] text-slate-400 font-medium">
                              {new Date(h.applied_on).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-xs text-slate-400 p-4 bg-slate-50 rounded-lg border border-slate-200 border-dashed text-center">No leave history found for this employee.</div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>

      </div>

      {/* ASSIGNMENT MODAL (Same as before) */}
      {assignModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 flex flex-col max-h-[90vh]">
            
            <div className="mb-4 shrink-0">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide">Assign Policy</h3>
              <div className="bg-slate-50 border border-slate-200 rounded p-2 mt-2 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">{assignModal.policy.name}</span>
                <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-emerald-200">
                  {assignModal.policy.days} Days
                </span>
              </div>
            </div>

            {msg.text && (
              <div className={`p-2.5 mb-4 rounded text-[10px] font-bold uppercase tracking-wide shrink-0 ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {msg.text}
              </div>
            )}

            <div className="flex justify-between items-center mb-2 shrink-0">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Select Employees</label>
              <button type="button" onClick={toggleAllUsers} className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                {selectedUsers.length === users.length && users.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1 no-scrollbar flex-grow shadow-inner min-h-[150px]">
              {users.length > 0 ? users.map(u => (
                <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-md cursor-pointer transition border border-transparent hover:border-slate-200">
                  <input 
                    type="checkbox" 
                    checked={selectedUsers.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-900">@{u.username}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{u.role}</span>
                  </div>
                </label>
              )) : (
                <div className="text-xs text-slate-400 text-center p-4">No eligible employees.</div>
              )}
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100 shrink-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {selectedUsers.length} Selected
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAssignModal({isOpen: false, policy: null})} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-100 rounded transition">
                  Cancel
                </button>
                <button onClick={submitAssignment} disabled={loading || selectedUsers.length === 0} className="bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-5 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition shadow-sm">
                  {loading ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}