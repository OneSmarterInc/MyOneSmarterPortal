import AttendanceTimeInput from './AttendanceTimeInput';
import React, { useState, useEffect } from 'react';
import { formatAttendanceTime, toTimeParts, toApiTime } from '../utils/attendanceTime';
import { getAttendance, managerCreateUser, getLeaveRequests, getUsers, updateAttendance } from '../services/api';

export default function ManagerDashboard({ setActiveTab }) {
  const [allRecords, setAllRecords] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [usersList, setUsersList] = useState([]);
  
  // Create Employee State
  const [employeeId, setEmployeeId] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('intern'); 
  const [joiningDate, setJoiningDate] = useState('');
  
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Edit Modal State
  const [editingRecord, setEditingRecord] = useState(null);
  const [editData, setEditData] = useState({ check_in: toTimeParts(''), check_out: toTimeParts(''), status: '' });
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await managerCreateUser({ 
        employee_id: employeeId, 
        username, 
        email, 
        role, 
        joining_date: joiningDate 
      });
      setSuccess(res.data.message);
      setEmployeeId(''); 
      setUsername(''); 
      setEmail(''); 
      setRole('intern'); 
      setJoiningDate('');
      fetchAllData(); 
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await updateAttendance(editingRecord.id, {
        check_in: toApiTime(editData.check_in),
        check_out: toApiTime(editData.check_out),
        status: editData.status
      });
      fetchAllData();
      setEditingRecord(null);
    } catch (err) {
      alert('Failed to update record.');
    } finally {
      setIsUpdating(false);
    }
  };

  const pendingRequests = allRecords.filter(r => r.status === 'Pending');
  const historicalLogs = allRecords.filter(r => r.status !== 'Pending');
  const pendingLeaves = leaves.filter(l => l.status === 'Pending');

  const getUserDetails = (userId) => {
    return usersList.find(u => u.id === userId) || { username: 'Unknown', role: 'N/A' };
  };

  return (
    <div className="w-full max-w-7xl flex flex-col gap-4 relative">
      
      {/* Welcome Panel */}
      <div className="bg-white p-4 sm:px-6 sm:py-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-400"></div>
        <div className="relative z-10">
          <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest">Management Console</span>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 mt-0.5 tracking-tight">Manager Dashboard</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Overview of system alerts, employee creation, and historical logs.</p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500 flex justify-between items-center">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Pending Attendance</h3>
            <div className="text-3xl font-black text-zinc-900">{pendingRequests.length}</div>
          </div>
          <button onClick={() => setActiveTab('pending-attendance')} className="bg-zinc-900 hover:bg-black text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition shadow-sm">
            Review
          </button>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-purple-500 flex justify-between items-center">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Pending Leaves & WFH</h3>
            <div className="text-3xl font-black text-zinc-900">{pendingLeaves.length}</div>
          </div>
          <button onClick={() => setActiveTab('pending-leaves')} className="bg-zinc-900 hover:bg-black text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition shadow-sm">
            Review
          </button>
        </div>
      </div>

      {/* Account Creation Block */}
      <div className="bg-white p-4 sm:px-6 sm:py-4 rounded-xl shadow-sm border border-slate-200 shrink-0">
        <div className="mb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-900">Create Employee Account</h3>
          <p className="text-[10px] text-slate-500">A temporary password will be auto-generated and emailed.</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded text-[10px] font-bold mb-3">{error}</div>}
        {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-2 rounded text-[10px] font-bold mb-3">{success}</div>}

        <form onSubmit={handleCreateAccount} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Emp ID</label>
            <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-red-500" required placeholder="e.g. EMP01" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-red-500" required />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Employee Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-red-500" required />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Joining Date</label>
            <input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-red-500" required />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full border border-slate-300 rounded p-2 bg-white text-xs outline-none focus:border-red-500">
              <option value="intern">Intern</option>
              <option value="employee">Employee</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="bg-zinc-900 hover:bg-black disabled:bg-slate-400 text-white py-2 rounded text-[11px] font-bold uppercase tracking-wider transition shadow-sm w-full">
            {loading ? 'Processing...' : 'Create'}
          </button>
        </form>
      </div>

      {/* Resolved Attendance Logs */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex-grow flex flex-col min-h-[300px]">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-900 mb-3 shrink-0">Resolved Attendance Logs</h3>
        <div className="overflow-y-auto no-scrollbar flex-grow border border-slate-100 rounded">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
              <tr className="border-b border-slate-200 text-slate-500 uppercase">
                <th className="p-2.5 font-bold">Employee</th>
                <th className="p-2.5 font-bold">Date</th>
                <th className="p-2.5 font-bold">Check-In</th>
                <th className="p-2.5 font-bold">Check-Out</th>
                <th className="p-2.5 font-bold">Status</th>
                <th className="p-2.5 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {historicalLogs.length > 0 ? historicalLogs.map(item => {
                const emp = getUserDetails(item.user);
                return (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="p-2.5">
                      <div className="font-bold text-zinc-900">@{emp.username}</div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{emp.role}</div>
                    </td>
                    <td className="p-2.5 text-slate-600 font-medium">{item.date}</td>
                    <td className="p-2.5 text-slate-600">{formatAttendanceTime(item.check_in)}</td>
                    <td className="p-2.5 text-slate-600">{formatAttendanceTime(item.check_out)}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        item.status === 'Present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        item.status === 'Late' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <button onClick={() => {
                        setEditingRecord(item);
                        setEditData({ check_in: toTimeParts(item.check_in), check_out: toTimeParts(item.check_out), status: item.status });
                      }} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider">
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="6" className="p-6 text-center text-slate-400 text-xs">No resolved records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm border border-slate-200">
            <h3 className="text-base font-bold text-zinc-900 mb-1">Edit Record</h3>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-4">
              @{getUserDetails(editingRecord.user).username} • {editingRecord.date}
            </p>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <AttendanceTimeInput label="Check-In Time" value={editData.check_in} onChange={value => setEditData({ ...editData, check_in: value })} />
              <AttendanceTimeInput label="Check-Out Time" value={editData.check_out} onChange={value => setEditData({ ...editData, check_out: value })} />
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Status</label>
                <select value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded bg-white">
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Absent">Absent</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setEditingRecord(null)} className="px-3 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-100 rounded transition">Cancel</button>
                <button type="submit" disabled={isUpdating} className="px-4 py-1.5 bg-zinc-900 hover:bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded transition disabled:bg-slate-400">
                  {isUpdating ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
