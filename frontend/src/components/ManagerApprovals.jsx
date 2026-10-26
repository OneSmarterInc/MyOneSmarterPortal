import React, { useState, useEffect } from 'react';
import { getAttendance, updateAttendance, getLeaveRequests, updateLeaveRequest, getUsers } from '../services/api';

export default function ManagerApprovals() {
  const [allRecords, setAllRecords] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [attRes, leaveRes, usersRes] = await Promise.all([
        getAttendance(),
        getLeaveRequests(),
        getUsers()
      ]);
      setAllRecords(attRes.data);
      setLeaves(leaveRes.data);
      setUsersList(usersRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproval = async (id, newStatus) => {
    try {
      await updateAttendance(id, { status: newStatus });
      fetchAllData(); 
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const handleLeaveApproval = async (id, status) => {
    try {
      await updateLeaveRequest(id, { status });
      fetchAllData();
    } catch (err) {
      alert('Failed to update leave status.');
    }
  };

  const pendingRequests = allRecords.filter(r => r.status === 'Pending');
  const pendingLeaves = leaves.filter(l => l.status === 'Pending');

  const getUserDetails = (userId) => {
    return usersList.find(u => u.id === userId) || { username: 'Unknown', role: 'N/A' };
  };

  return (
    <div className="w-full max-w-7xl flex flex-col gap-4 relative h-full">
      {/* Welcome Panel */}
      <div className="bg-white p-4 sm:px-6 sm:py-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-400"></div>
        <div className="relative z-10">
          <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest">Management Console</span>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 mt-0.5 tracking-tight">Pending Approvals</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Review and resolve employee attendance, WFH, and leave requests.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-grow min-h-0">
        
        {/* Pending Leaves / WFH Table */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-purple-500 flex flex-col h-[550px]">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-900">Pending Leave & WFH</h3>
            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border border-purple-200">{pendingLeaves.length} Requests</span>
          </div>
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
                {pendingLeaves.length > 0 ? pendingLeaves.map(l => {
                  const empInfo = usersList.find(u => u.username === l.username) || { role: 'N/A' };
                  return (
                    <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-3">
                        <div className="font-bold text-zinc-900">@{l.username}</div>
                        <div className="flex gap-1 items-center mt-0.5">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{empInfo.role}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold ${l.request_type === 'WFH' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                            {l.request_type || 'Leave'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-[10px] font-semibold text-slate-700">{l.start_date} to {l.end_date}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{l.reason}</div>
                      </td>
                      <td className="p-3 text-right space-y-1 sm:space-y-0 sm:space-x-1">
                        <button onClick={() => handleLeaveApproval(l.id, 'Approved')} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded transition w-full sm:w-auto">Approve</button>
                        <button onClick={() => handleLeaveApproval(l.id, 'Rejected')} className="bg-red-500 hover:bg-red-600 text-white text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded transition w-full sm:w-auto">Reject</button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan="3" className="p-8 text-center text-slate-400 text-xs">No pending leave requests.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Attendance Table */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-blue-500 flex flex-col h-[550px]">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-900">Pending Check-Ins</h3>
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border border-blue-200">{pendingRequests.length} Requests</span>
          </div>
          <div className="overflow-y-auto no-scrollbar flex-grow border border-slate-100 rounded">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                <tr className="border-b border-slate-200 text-slate-500 uppercase">
                  <th className="p-3 font-bold">Employee</th>
                  <th className="p-3 font-bold">Times Logged</th>
                  <th className="p-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.length > 0 ? pendingRequests.map(item => {
                  const emp = getUserDetails(item.user);
                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-3">
                        <div className="font-bold text-zinc-900">@{emp.username}</div>
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{emp.role}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-[10px] font-semibold text-slate-700">{item.date}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">In: <span className="font-medium text-slate-800">{item.check_in || '--:--'}</span></div>
                        {item.check_out && <div className="text-[10px] text-slate-500">Out: <span className="font-medium text-slate-800">{item.check_out}</span></div>}
                      </td>
                      <td className="p-3 text-right space-y-1 sm:space-y-0 sm:space-x-1">
                        <button onClick={() => handleApproval(item.id, 'Present')} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded transition">Present</button>
                        <button onClick={() => handleApproval(item.id, 'Late')} className="bg-amber-500 hover:bg-amber-600 text-white text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded transition">Late</button>
                        <button onClick={() => handleApproval(item.id, 'Absent')} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded transition">Reject</button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan="3" className="p-8 text-center text-slate-400 text-xs">No pending attendance approvals required.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
      </div>
    </div>
  );
}