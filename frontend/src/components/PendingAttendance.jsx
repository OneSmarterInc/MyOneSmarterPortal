import React, { useState, useEffect } from 'react';
import { formatAttendanceTime } from '../utils/attendanceTime';
import { getAttendance, updateAttendance, getUsers } from '../services/api';

export default function PendingAttendance() {
  const [records, setRecords] = useState([]);
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [attRes, usersRes] = await Promise.all([getAttendance(), getUsers()]);
      setRecords(attRes.data.filter(r => r.status === 'Pending'));
      setUsersList(usersRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproval = async (id, newStatus) => {
    try {
      await updateAttendance(id, { status: newStatus });
      fetchData(); 
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const getUserDetails = (userId) => {
    return usersList.find(u => u.id === userId) || { username: 'Unknown', role: 'N/A' };
  };

  return (
    <div className="w-full max-w-7xl flex flex-col gap-4 relative h-full">
      <div className="bg-white p-4 sm:px-6 sm:py-4 rounded-xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden shrink-0 border-t-4 border-t-blue-500">
        <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">Approvals</span>
        <h2 className="text-xl sm:text-2xl font-black text-zinc-900 mt-0.5 tracking-tight">Pending Attendance ({records.length})</h2>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">Review and resolve daily employee check-in and check-out requests.</p>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col flex-grow min-h-[400px]">
        <div className="overflow-y-auto no-scrollbar flex-grow border border-slate-100 rounded">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
              <tr className="border-b border-slate-200 text-slate-500 uppercase">
                <th className="p-3 font-bold">Employee</th>
                <th className="p-3 font-bold">Requested Times</th>
                <th className="p-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length > 0 ? records.map(item => {
                const emp = getUserDetails(item.user);
                return (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="p-3">
                      <div className="font-bold text-zinc-900 text-sm">@{emp.username}</div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{emp.role}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-[11px] font-semibold text-slate-700">{item.date}</div>
                      <div className="text-[10px] font-bold text-blue-700 mt-1">{item.check_out ? 'Check-out awaiting approval' : 'Check-in awaiting approval'}</div>
                      <div className="text-[10px] text-slate-500 mt-1">In: <span className="font-bold text-slate-800">{formatAttendanceTime(item.check_in, '--:--')}</span></div>
                      {item.check_out && <div className="text-[10px] text-slate-500">Out: <span className="font-bold text-slate-800">{formatAttendanceTime(item.check_out)}</span></div>}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button onClick={() => handleApproval(item.id, 'Present')} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] uppercase tracking-wider font-bold px-3 py-1.5 rounded transition">{item.check_out ? 'Approve Check-Out' : 'Approve Check-In'}</button>
                      <button onClick={() => handleApproval(item.id, 'Late')} className="bg-amber-500 hover:bg-amber-600 text-white text-[9px] uppercase tracking-wider font-bold px-3 py-1.5 rounded transition">Approve as Late</button>
                      <button onClick={() => handleApproval(item.id, 'Absent')} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] uppercase tracking-wider font-bold px-3 py-1.5 rounded transition">Reject</button>
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
  );
}