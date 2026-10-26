import React, { useState, useEffect } from 'react';
import { getLeaveRequests, updateLeaveRequest, getUsers } from '../services/api';

export default function PendingLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [leaveRes, usersRes] = await Promise.all([getLeaveRequests(), getUsers()]);
      setLeaves(leaveRes.data.filter(l => l.status === 'Pending'));
      setUsersList(usersRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveApproval = async (id, status) => {
    try {
      await updateLeaveRequest(id, { status });
      fetchData();
    } catch (err) {
      alert('Failed to update leave status.');
    }
  };

  const getUserDetails = (username) => {
    return usersList.find(u => u.username === username) || { role: 'N/A' };
  };

  return (
    <div className="w-full max-w-7xl flex flex-col gap-4 relative h-full">
      <div className="bg-white p-4 sm:px-6 sm:py-4 rounded-xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden shrink-0 border-t-4 border-t-purple-500">
        <span className="text-[9px] font-bold text-purple-600 uppercase tracking-widest">Approvals</span>
        <h2 className="text-xl sm:text-2xl font-black text-zinc-900 mt-0.5 tracking-tight">Pending Leaves & WFH ({leaves.length})</h2>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">Review and resolve employee time-off and remote work requests.</p>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col flex-grow min-h-[400px]">
        <div className="overflow-y-auto no-scrollbar flex-grow border border-slate-100 rounded">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
              <tr className="border-b border-slate-200 text-slate-500 uppercase">
                <th className="p-3 font-bold">Employee</th>
                <th className="p-3 font-bold">Details</th>
                <th className="p-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaves.length > 0 ? leaves.map(l => {
                const empInfo = getUserDetails(l.username);
                return (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="p-3">
                      <div className="font-bold text-zinc-900 text-sm">@{l.username}</div>
                      <div className="flex gap-2 items-center mt-1">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{empInfo.role}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold ${l.request_type === 'WFH' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                          {l.request_type || 'Leave'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-[11px] font-semibold text-slate-700">{l.start_date} to {l.end_date}</div>
                      <div className="text-[10px] text-slate-500 mt-1 max-w-[200px] truncate">{l.reason}</div>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button onClick={() => handleLeaveApproval(l.id, 'Approved')} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] uppercase tracking-wider font-bold px-3 py-1.5 rounded transition">Approve</button>
                      <button onClick={() => handleLeaveApproval(l.id, 'Rejected')} className="bg-red-500 hover:bg-red-600 text-white text-[9px] uppercase tracking-wider font-bold px-3 py-1.5 rounded transition">Reject</button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="3" className="p-8 text-center text-slate-400 text-xs">No pending leave requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}