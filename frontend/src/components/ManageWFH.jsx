import RecordTable from './RecordTable';
import { istCalendarDate } from '../services/attendanceClock';
import { personName } from '../utils/personName';
import React, { useState, useEffect } from 'react';
import { getUsers, getLeaveRequests, updateLeaveRequest, getWFHAllowances, addWFHAllowance } from '../services/api';

export default function ManageWFH() {
  const [users, setUsers] = useState([]);
  const [allowances, setAllowances] = useState([]);
  const [allocation, setAllocation] = useState({ days: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [allocating, setAllocating] = useState(false);
  const [allocationMessage, setAllocationMessage] = useState('');
  const [wfhRecords, setWfhRecords] = useState([]);

  // Table Filter & Pagination State
  const [filterDate, setFilterDate] = useState('');

  const [fetchError,setFetchError] = useState('');
  const [fetching,setFetching] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);


  async function fetchData() {
    setFetching(true);setFetchError('');
    try {
      const [userRes, reqRes, allowanceRes] = await Promise.all([getUsers(), getLeaveRequests(), getWFHAllowances()]);
      setAllowances(allowanceRes.data);
      setUsers(userRes.data.filter(u => ['employee', 'intern'].includes(u.role)));
      setWfhRecords(reqRes.data.filter(item => ['Work From Home','WFH'].includes(item.request_type)));
    } catch (err) {
      setFetchError('Unable to load this page. Please try again.');
    } finally {setFetching(false);}
  };

  async function allocateDays(e) {
    e.preventDefault();
    if (allocating || !selectedIds.length) return;
    setAllocating(true); setAllocationMessage('');
    try {
      await addWFHAllowance({ user_ids: selectedIds, days: Number(allocation.days) });
      setAllocationMessage(`${allocation.days} WFH days allocated to each of ${selectedIds.length} selected people.`);
      setAllocation({ days: '' });
      setSelectedIds([]);
      await fetchData();
    } catch (err) { setAllocationMessage(err.response?.data?.error || 'Could not allocate days. Please try again.'); }
    finally { setAllocating(false); }
  }

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
    const d = istCalendarDate(new Date());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayStr = getTodayString();

  // --- Filtering & Pagination Logic ---
  const filteredRecords = wfhRecords.filter(item => {
    const matchesDate = filterDate 
      ? (item.start_date <= filterDate && item.end_date >= filterDate) 
      : true;

    return matchesDate;
  });


  return (
    <div className="admin-legacy w-full max-w-7xl flex flex-col gap-6 relative">

      <header className="admin-page-heading"><div><h1>Work from home</h1><p>Review remote work requests and the team’s schedule.</p></div></header>
      {fetchError && <div className="admin-error" role="alert">{fetchError} <button onClick={fetchData}>Try again</button></div>}
      {fetching && <p role="status" className="admin-loading">Loading…</p>}
      <div className="flex flex-col gap-6">

        <section className="admin-panel p-5" aria-labelledby="wfh-allocation-heading">
          <h2 id="wfh-allocation-heading" className="text-base font-semibold">Allocate work from home days</h2>
          <p className="text-sm text-slate-500 mt-2">Add an allowance for an employee or intern. They can request dates within their remaining allowance. Each calendar day in a request uses one day; pending requests reserve days.</p>
          {allocationMessage && <p role="status" className="admin-notice mt-3">{allocationMessage}</p>}
          <form onSubmit={allocateDays} className="flex flex-wrap items-end gap-3 mt-4">
            <div className="flex flex-wrap items-center gap-3"><button type="button" className="admin-button" disabled={fetching || allocating || !users.length} onClick={() => setSelectedIds(users.map(u => u.id))}>Select all ({users.length})</button><button type="button" className="admin-link" disabled={allocating || !selectedIds.length} onClick={() => setSelectedIds([])}>Clear selection</button><span role="status" className="text-sm">{selectedIds.length} selected across all pages</span></div>
            <label className="text-sm">Days to add<input required aria-label="WFH days to add" type="number" min="1" max="366" step="1" className="block border border-slate-300 rounded-lg p-2 mt-1 w-32" value={allocation.days} onChange={e => setAllocation({ ...allocation, days: e.target.value })} /></label>
            <button className="admin-button primary" disabled={allocating || fetching || !selectedIds.length}>{allocating ? 'Allocating…' : `Allocate days to ${selectedIds.length} people`}</button>
          </form>
          <div className="admin-table-scroll mt-5"><RecordTable label="WFH allowances"><table className="admin-table"><thead><tr><th data-nosort>Select</th><th>Team member</th><th>Allocated days</th><th>Used / reserved</th><th>Remaining</th></tr></thead><tbody>{users.map(u => { const a = allowances.find(item => item.user_id === u.id); return <tr key={u.id}><td><input type="checkbox" aria-label={`Select ${personName(u)} for WFH allocation`} checked={selectedIds.includes(u.id)} disabled={allocating} onChange={() => setSelectedIds(ids => ids.includes(u.id) ? ids.filter(id => id !== u.id) : [...ids, u.id])} /></td><td>{personName(u)} <small className="block text-slate-500">{u.role}</small></td><td>{a?.allocated ?? '—'}</td><td>{a?.reserved ?? '—'}</td><td>{a?.remaining ?? '—'}</td></tr>; })}</tbody></table></RecordTable></div>
        </section>
        {/* BOTTOM ROW: WFH RECORDS TABLE */}
        <div className="bg-white rounded-lg border border-slate-200 flex flex-col min-h-[260px] shadow-none z-10">
          <div className="p-4 border-b border-slate-100 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-xs font-semibold normal-case tracking-normal text-zinc-900 shrink-0">Remote work records</h3>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
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
                <RecordTable label="Remote work records"><table className="w-full text-left text-xs border-collapse bg-white">
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
                    {filteredRecords.length > 0 ? filteredRecords.map(item => {
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
                            <div className="font-bold text-zinc-900 text-sm">{personName(item)}</div>
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
                </table></RecordTable>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
