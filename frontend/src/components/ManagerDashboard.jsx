import AdminOverview from './AdminOverview';
import AttendanceTimeInput from './AttendanceTimeInput';
import React, { useState, useEffect } from 'react';
import { formatAttendanceTime, toTimeParts, toApiTime } from '../utils/attendanceTime';
import { getAttendance, managerCreateUser, getLeaveRequests, getUsers, updateAttendance } from '../services/api';

export default function ManagerDashboard({ setActiveTab, createMode = false, onCreateMode, navigate }) {
  const [allRecords, setAllRecords] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [usersList, setUsersList] = useState([]);
  
  const [dataBusy, setDataBusy] = useState(true);
  const [dataError, setDataError] = useState('');
  // Create Employee State
  const [employeeId, setEmployeeId] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('intern'); 
  const [designation, setDesignation] = useState('');
  const [tags, setTags] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [today] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [joiningDate, setJoiningDate] = useState('');
  
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (createMode) document.getElementById('create-employee-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
  }, [createMode]);

  // Edit Modal State
  const [editingRecord, setEditingRecord] = useState(null);
  const [editData, setEditData] = useState({ check_in: toTimeParts(''), check_out: toTimeParts(''), status: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setDataBusy(true); setDataError('');
    try {
      const [attRes, leaveRes, usersRes] = await Promise.all([
        getAttendance(),
        getLeaveRequests(),
        getUsers()
      ]);
      setAllRecords(attRes.data);
      setLeaves(leaveRes.data);
      setUsersList(usersRes.data);
    } catch {
      setDataError('Unable to load dashboard data.');
    } finally { setDataBusy(false); }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await managerCreateUser({ 
        employee_id: employeeId,
        designation,
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean), 
        username, 
        email, 
        role, 
        joining_date: joiningDate,
        date_of_birth: birthDate || null 
      });
      setSuccess(res.data.message);
      setEmployeeId('');
      setDesignation('');
      setTags(''); 
      setUsername(''); 
      setEmail(''); 
      setRole('intern'); 
      setJoiningDate('');
      setBirthDate('');
      window.dispatchEvent(new Event('birthdaysUpdated'));
      fetchAllData(); 
    } catch (err) {
      setError(err.response?.data?.error || (err.response?.data ? JSON.stringify(err.response.data) : 'Failed to create account.'));
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
    } catch {
      alert('Failed to update record.');
    } finally {
      setIsUpdating(false);
    }
  };

  const historicalLogs = allRecords.filter(r => r.status !== 'Pending');
  const pendingLeaves = leaves.filter(l => l.status === 'Pending');

  const getUserDetails = (userId) => {
    return usersList.find(u => u.id === userId) || { username: 'Unknown', role: 'N/A' };
  };

  return (
    <div className="w-full max-w-7xl flex flex-col gap-4 relative">
      
      <AdminOverview records={allRecords} users={usersList} pendingLeaves={pendingLeaves.length} busy={dataBusy} error={dataError} retry={fetchAllData} navigate={navigate || setActiveTab} addEmployee={()=>onCreateMode(true)} />
      {createMode && <>
      {/* Account Creation Block */}
      <div id="create-employee-panel" style={{scrollMarginTop:80}} className="bg-white p-4 sm:px-6 sm:py-4 rounded-xl shadow-none border border-slate-200 shrink-0">
        <div className="mb-3">
          <div className="flex justify-between gap-3"><h3 className="text-xs font-bold normal-case tracking-normal text-zinc-900">Create Employee Account</h3><button type="button" className="admin-link" onClick={()=>onCreateMode(false)}>Close</button></div>
          <p className="text-xs text-slate-500">A temporary password will be auto-generated and emailed.</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded text-xs font-bold mb-3">{error}</div>}
        {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-2 rounded text-xs font-bold mb-3">{success}</div>}

        <form onSubmit={handleCreateAccount} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label htmlFor="managerdashboard-field-1" className="block text-xs font-bold normal-case text-slate-600 mb-1">Emp ID</label>
            <input id="managerdashboard-field-1" type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-red-500" required placeholder="e.g. EMP01" />
          </div>
          <div>
            <label htmlFor="managerdashboard-field-2" className="block text-xs font-bold normal-case text-slate-600 mb-1">Username</label>
            <input id="managerdashboard-field-2" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-red-500" required />
          </div>
          <div>
            <label htmlFor="managerdashboard-field-3" className="block text-xs font-bold normal-case text-slate-600 mb-1">Employee Email</label>
            <input id="managerdashboard-field-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-red-500" required />
          </div>
          <div>
            <label htmlFor="managerdashboard-field-4" className="block text-xs font-bold normal-case text-slate-600 mb-1">Joining Date</label>
            <input id="managerdashboard-field-4" type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-red-500" required />
          </div>
          <div>
            <label htmlFor="managerdashboard-field-5" className="block text-xs font-bold normal-case text-slate-600 mb-1">Role</label>
            <select id="managerdashboard-field-5" value={role} onChange={(e) => setRole(e.target.value)} className="w-full border border-slate-300 rounded p-2 bg-white text-xs outline-none focus:border-red-500">
              <option value="intern">Intern</option>
              <option value="employee">Employee</option>
            </select>
          </div>
          <div>
            <label htmlFor="new-employee-birthday" className="block text-xs font-bold normal-case text-slate-600 mb-1">Date of Birth (optional)</label>
            <input id="new-employee-birthday" type="date" value={birthDate} max={today} onChange={e => setBirthDate(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-red-500" />
          </div>
              <div>
                <label htmlFor="new-employee-designation" className="block text-xs font-bold text-slate-600 mb-1">Designation</label>
                <input id="new-employee-designation" type="text" maxLength={120} value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Software Engineer" className="w-full border border-slate-300 rounded p-2 text-sm" />
              </div>
              <div>
                <label htmlFor="new-employee-tags" className="block text-xs font-bold text-slate-600 mb-1">Tags</label>
                <input id="new-employee-tags" type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. Engineering, Remote" className="w-full border border-slate-300 rounded p-2 text-sm" />
              </div>
          <button type="submit" disabled={loading} className="admin-button primary w-full">
            {loading ? 'Processing...' : 'Create'}
          </button>
        </form>
      </div>

      </>}
      <details className="admin-panel admin-history">
      <summary>Attendance history · {historicalLogs.length} resolved records</summary>
      {/* Resolved Attendance Logs */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-none flex-grow flex flex-col min-h-[300px]">
        <h3 className="text-xs font-bold normal-case tracking-normal text-zinc-900 mb-3 shrink-0">Resolved Attendance Logs</h3>
        <div className="overflow-auto no-scrollbar flex-grow border border-slate-100 rounded">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10 shadow-none">
              <tr className="border-b border-slate-200 text-slate-500 normal-case">
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
                      <div className="text-xs font-bold text-slate-400 normal-case tracking-normal mt-0.5">{emp.role}</div>
                    </td>
                    <td className="p-2.5 text-slate-600 font-medium">{item.date}</td>
                    <td className="p-2.5 text-slate-600">{formatAttendanceTime(item.check_in)}</td>
                    <td className="p-2.5 text-slate-600">{formatAttendanceTime(item.check_out)}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold normal-case tracking-normal ${
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
                      }} className="admin-button  ">
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

      </details>
      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm border border-slate-200">
            <h3 className="text-base font-bold text-zinc-900 mb-1">Edit Record</h3>
            <p className="text-xs normal-case tracking-normal font-bold text-slate-500 mb-4">
              @{getUserDetails(editingRecord.user).username} • {editingRecord.date}
            </p>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <AttendanceTimeInput label="Check-In Time" value={editData.check_in} onChange={value => setEditData({ ...editData, check_in: value })} />
              <AttendanceTimeInput label="Check-Out Time" value={editData.check_out} onChange={value => setEditData({ ...editData, check_out: value })} />
              <div>
                <label htmlFor="managerdashboard-field-6" className="block text-xs font-bold normal-case tracking-normal text-slate-600 mb-1">Status</label>
                <select id="managerdashboard-field-6" value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded bg-white">
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Absent">Absent</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setEditingRecord(null)} className="admin-button  ">Cancel</button>
                <button type="submit" disabled={isUpdating} className="admin-button primary ">
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
