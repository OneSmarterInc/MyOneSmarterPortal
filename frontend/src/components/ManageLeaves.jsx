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

  const [fetchError,setFetchError] = useState('');
  const [fetching,setFetching] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setFetching(true);setFetchError('');
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
      setFetchError('Unable to load this page. Please try again.');
    } finally {setFetching(false);}
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
      
      setMsg({ text: `Assigned to ${selectedUsers.length} employee(s).`, type: 'success' });
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
    <div className="admin-legacy w-full max-w-7xl flex flex-col gap-6 relative">
      
      <header className="admin-page-heading"><div><h1>Leave quotas</h1><p>Assign leave allowances and review each person’s balance.</p></div></header>
      {fetchError && <div className="admin-error" role="alert">{fetchError} <button onClick={fetchData}>Try again</button></div>}
      {fetching && <p role="status" className="admin-loading">Loading…</p>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: LEAVE POLICIES */}
        <div className="bg-slate-50 rounded-lg border border-slate-200 flex flex-col max-h-[720px]">
          <div className="p-5 flex justify-between items-center shrink-0">
            <h3 className="text-xs font-semibold normal-case tracking-normal text-zinc-900">Leave templates</h3>
            {!isCreatingPolicy && (
              <button onClick={() => setIsCreatingPolicy(true)} className="admin-button primary ">
                New template
              </button>
            )}
          </div>

          <div className="px-5 pb-5 flex-grow overflow-auto space-y-4">
            
            {isCreatingPolicy && (
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-none mb-2 animate-fade-in">
                <h4 className="text-xs font-semibold normal-case text-slate-800 mb-4 border-b border-slate-100 pb-2">Create template</h4>
                <form onSubmit={handleCreatePolicy} className="space-y-4">
                  <div>
                    <label htmlFor="manageleaves-field-1" className="block text-xs font-bold normal-case text-slate-500 mb-1.5">Policy Name</label>
                    <input id="manageleaves-field-1" type="text" required placeholder="e.g. Summer Break, Maternity" value={policyForm.name} onChange={e => setPolicyForm({...policyForm, name: e.target.value})} className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-red-500 rounded-lg" />
                  </div>
                  
                  <div>
                    <label htmlFor="manageleaves-field-2" className="block text-xs font-bold normal-case text-slate-500 mb-1.5">Policy Type</label>
                    <select id="manageleaves-field-2" value={policyForm.type} onChange={e => setPolicyForm({...policyForm, type: e.target.value})} className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-red-500 rounded-lg bg-white">
                      <option value="Fixed Quota">Fixed Annual/Monthly Quota</option>
                      <option value="Single Date">Single Specific Date</option>
                      <option value="Date Range">Date Range (Multiple Days)</option>
                      <option value="Half-Day">Half-Day Leave</option>
                    </select>
                  </div>

                  {policyForm.type === 'Fixed Quota' && (
                    <div>
                      <label htmlFor="manageleaves-field-3" className="block text-xs font-bold normal-case text-slate-500 mb-1.5">Total Days</label>
                      <input id="manageleaves-field-3" type="number" required min="0.5" step="0.5" value={policyForm.days} onChange={e => setPolicyForm({...policyForm, days: e.target.value})} className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-red-500 rounded-lg" />
                    </div>
                  )}

                  {(policyForm.type === 'Single Date' || policyForm.type === 'Half-Day') && (
                    <div>
                      <label className="block text-xs font-bold normal-case text-slate-500 mb-1.5">Select Date {policyForm.type === 'Half-Day' && '(Optional)'}</label>
                      <input type="date" required={policyForm.type === 'Single Date'} value={policyForm.singleDate} onChange={e => setPolicyForm({...policyForm, singleDate: e.target.value})} className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-red-500 rounded-lg" />
                    </div>
                  )}

                  {policyForm.type === 'Date Range' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="manageleaves-field-4" className="block text-xs font-bold normal-case text-slate-500 mb-1.5">Start Date</label>
                        <input id="manageleaves-field-4" type="date" required value={policyForm.startDate} onChange={e => setPolicyForm({...policyForm, startDate: e.target.value})} className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-red-500 rounded-lg" />
                      </div>
                      <div>
                        <label htmlFor="manageleaves-field-5" className="block text-xs font-bold normal-case text-slate-500 mb-1.5">End Date</label>
                        <input id="manageleaves-field-5" type="date" required value={policyForm.endDate} onChange={e => setPolicyForm({...policyForm, endDate: e.target.value})} className="w-full border border-slate-300 p-2.5 text-xs outline-none focus:border-red-500 rounded-lg" />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
                    <button type="button" onClick={() => setIsCreatingPolicy(false)} className="admin-button  ">Cancel</button>
                    <button type="submit" className="admin-button primary ">Save template</button>
                  </div>
                </form>
              </div>
            )}

            {/* List of Policies */}
            {policies.map(p => (
              <div key={p.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-none flex flex-col gap-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-900">{p.name}</h4>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold normal-case tracking-normal">{p.type}</span>
                      <span className="text-xs font-semibold text-slate-500">{p.details}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">{p.days} Day{p.days !== 1 ? 's' : ''}</span>
                </div>
                
                <div className="flex justify-end items-center gap-5">
                  <button onClick={() => handleDeletePolicy(p.id)} className="admin-button danger ">
                    Delete
                  </button>
                  <button onClick={() => openAssignModal(p)} className="admin-button  ">
                    Assign
                  </button>
                </div>
              </div>
            ))}
            
            {policies.length === 0 && !isCreatingPolicy && (
              <div className="text-center p-8 text-slate-400 text-xs font-medium bg-white rounded-xl border border-slate-200 border-dashed">No policies created yet. Create one to assign it.</div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: EMPLOYEE DIRECTORY & RECORDS */}
        <div className="lg:col-span-2 bg-slate-50 rounded-lg border border-slate-200 flex flex-col max-h-[720px]">
          
          <div className="p-5 shrink-0 flex justify-between items-center">
            <div className="flex items-center gap-3">
              {viewingEmployee && (
                <button onClick={() => setViewingEmployee(null)} className="admin-button  ">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                </button>
              )}
              <h3 className="text-xs font-semibold normal-case tracking-normal text-zinc-900">
                {viewingEmployee ? "Employee Leave Record" : "Employee balances"}
              </h3>
            </div>
            
            {viewingEmployee && (
              <span className="bg-white border border-slate-200 px-3 py-1 rounded-md text-xs font-semibold text-slate-500 normal-case tracking-normal shadow-none">
                @{viewingEmployee.username} • {viewingEmployee.role}
              </span>
            )}
          </div>
          
          <div className="px-5 pb-5 overflow-auto flex-grow">
            
            {/* VIEW 1: EMPLOYEE LIST */}
            {!viewingEmployee ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {users.length > 0 ? users.map(u => {
                  const userPoliciesCount = allocations.filter(a => a.user_id === u.id).length;
                  return (
                    <div key={u.id} className="bg-white border border-slate-200 p-5 rounded-xl flex justify-between items-center shadow-none hover:border-slate-300 transition">
                      <div>
                        <div className="font-semibold text-zinc-900 text-[15px]">@{u.username}</div>
                        <div className="text-xs font-bold text-slate-400 normal-case tracking-normal mt-1.5">{u.role}</div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        {userPoliciesCount > 0 ? (
                          <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-xs font-semibold normal-case tracking-normal border border-emerald-200">
                            {userPoliciesCount} Active Policies
                          </span>
                        ) : (
                          <span className="h-4"></span>
                        )}
                        <button onClick={() => setViewingEmployee(u)} className="admin-button">
                          View balance
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                   <div className="col-span-full text-center p-8 text-slate-400 text-xs bg-white border border-dashed border-slate-200 rounded-xl">No employees found.</div>
                )}
              </div>
            ) : (

            /* VIEW 2: SPECIFIC EMPLOYEE RECORD */
              <div className="space-y-6 animate-fade-in bg-white p-5 rounded-xl border border-slate-200 shadow-none min-h-full">
                
                {/* Section A: Quotas & Remaining Balances */}
                <div>
                  <h4 className="text-xs font-semibold normal-case tracking-normal text-slate-400 mb-4 border-b border-slate-100 pb-2">Assigned Quotas</h4>
                  {userAllocations.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {userAllocations.map(a => {
                        const takenDays = getTakenDays(a.user_id, a.leave_type);
                        const totalDays = parseFloat(a.total_days);
                        const remaining = Math.max(0, totalDays - takenDays);
                        const usagePercent = Math.min((takenDays / totalDays) * 100, 100);

                        return (
                          <div key={a.id} className="border border-slate-200 p-4 rounded-xl bg-slate-50 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                              <span className="font-semibold text-zinc-900 text-sm truncate pr-2">{a.leave_type}</span>
                              <button onClick={() => handleDeleteAllocation(a.id)} className="admin-button danger shrink-0">Revoke</button>
                            </div>
                            
                            <div className="flex justify-between items-end mb-2">
                              <span className="text-3xl font-semibold text-zinc-900 leading-none tracking-tight">{remaining} <span className="text-xs text-slate-400 font-bold normal-case tracking-normal">Left</span></span>
                              <span className="text-xs font-bold normal-case tracking-normal text-slate-500">{takenDays} taken / {totalDays} total</span>
                            </div>
                            
                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mt-3">
                              <div className={`h-full rounded-full transition-all ${usagePercent > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${usagePercent}%` }}></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-xs font-medium text-slate-400 p-6 bg-slate-50 rounded-xl border border-slate-200 border-dashed text-center">No active leave policies assigned to this employee.</div>
                  )}
                </div>

                {/* Section B: Dates Taken History */}
                <div className="pt-2">
                  <h4 className="text-xs font-semibold normal-case tracking-normal text-slate-400 mb-4 border-b border-slate-100 pb-2">History & Dates Taken</h4>
                  {userHistory.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 normal-case text-xs tracking-normal bg-slate-50">
                            <th className="p-3 font-bold">Type</th>
                            <th className="p-3 font-bold">Dates</th>
                            <th className="p-3 font-bold">Status</th>
                            <th className="p-3 font-bold text-right">Requested On</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userHistory.map(h => (
                            <tr key={h.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                              <td className="p-3 font-bold text-zinc-900">{h.request_type}</td>
                              <td className="p-3">
                                 <span className="font-semibold text-zinc-900">{h.start_date}</span>
                                 {h.start_date !== h.end_date && <span className="text-slate-500"> to <span className="font-semibold text-zinc-900">{h.end_date}</span></span>}
                              </td>
                              <td className="p-3">
                                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold normal-case tracking-normal ${
                                  h.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  h.status === 'Rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                                  'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {h.status}
                                </span>
                              </td>
                              <td className="p-3 text-right text-xs text-slate-500 font-bold">
                                {new Date(h.applied_on).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs font-medium text-slate-400 p-6 bg-slate-50 rounded-xl border border-slate-200 border-dashed text-center">No leave history found for this employee.</div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>

      </div>

      {/* ASSIGNMENT MODAL */}
      {assignModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 flex flex-col max-h-[90vh]">
            
            <div className="mb-5 shrink-0">
              <h3 className="text-base font-semibold text-zinc-900 normal-case tracking-normal">Assign leave</h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-3 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700">{assignModal.policy.name}</span>
                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-semibold normal-case tracking-normal border border-emerald-200">
                  {assignModal.policy.days} Days
                </span>
              </div>
            </div>

            {msg.text && (
              <div className={`p-3 mb-5 rounded-lg text-xs font-bold normal-case tracking-normal shrink-0 ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {msg.text}
              </div>
            )}

            <div className="flex justify-between items-center mb-3 shrink-0">
              <label className="text-xs font-semibold normal-case tracking-normal text-slate-500">Select Employees</label>
              <button type="button" onClick={toggleAllUsers} className="admin-button  ">
                {selectedUsers.length === users.length && users.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 no-scrollbar flex-grow shadow-inner min-h-[150px]">
              {users.length > 0 ? users.map(u => (
                <label key={u.id} className="flex items-center gap-4 p-3 hover:bg-white rounded-lg cursor-pointer transition border border-transparent hover:border-slate-200">
                  <input 
                    type="checkbox" 
                    checked={selectedUsers.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-zinc-900">@{u.username}</span>
                    <span className="text-xs font-bold text-slate-400 normal-case tracking-normal mt-0.5">{u.role}</span>
                  </div>
                </label>
              )) : (
                <div className="text-xs text-slate-400 text-center p-6">No eligible employees.</div>
              )}
            </div>

            <div className="flex justify-between items-center mt-5 pt-5 border-t border-slate-100 shrink-0">
              <span className="text-xs font-semibold text-slate-500 normal-case tracking-normal">
                {selectedUsers.length} Selected
              </span>
              <div className="flex gap-3">
                <button type="button" onClick={() => setAssignModal({isOpen: false, policy: null})} className="admin-button  ">
                  Cancel
                </button>
                <button onClick={submitAssignment} disabled={loading || selectedUsers.length === 0} className="admin-button primary ">
                  {loading ? 'Assigning...' : 'Assign leave'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}