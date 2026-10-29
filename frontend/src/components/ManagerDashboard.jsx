import { personName } from '../utils/personName';
import { editAttendanceTimes } from '../services/attendanceClock';
import { portalAlert, portalConfirm } from './PortalDialog';
import AdminOverview from './AdminOverview';
import AttendanceTimeInput from './AttendanceTimeInput';
import React, { useState, useEffect } from 'react';
import { formatAttendanceTime, toTimeParts, toApiTime } from '../utils/attendanceTime';
import { getAttendance, managerCreateUser, getLeaveRequests, getUsers, updateAttendance } from '../services/api';

export default function ManagerDashboard({ setActiveTab, createMode = false, onCreateMode, navigate, onSelectEmployee }) {
  const [allRecords, setAllRecords] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [leaves, setLeaves] = useState([]);
  const [usersList, setUsersList] = useState([]);
  
  const [dataBusy, setDataBusy] = useState(true);
  const [dataError, setDataError] = useState('');
  // Edit Modal State
  const [editingRecord, setEditingRecord] = useState(null);
  const [editData, setEditData] = useState({ check_in: toTimeParts(''), check_out: toTimeParts(''), status: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchAllData();
    window.addEventListener('peopleUpdated', fetchAllData);
    return () => window.removeEventListener('peopleUpdated', fetchAllData);
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

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await editAttendanceTimes(editingRecord.id, {
        check_in: toApiTime(editData.check_in),
        check_out: toApiTime(editData.check_out),
        expected_check_in: editingRecord.check_in,
        expected_check_out: editingRecord.check_out
      });
      if (editData.status !== editingRecord.status) await updateAttendance(editingRecord.id, { status: editData.status });
      fetchAllData();
      setEditingRecord(null);
    } catch {
      portalAlert('Failed to update record.');
    } finally {
      setIsUpdating(false);
    }
  };

  const historicalLogs = allRecords.filter(r => r.status !== 'Pending');
  const historyPageSize = 10;
  const historyTotalPages = Math.max(1, Math.ceil(historicalLogs.length / historyPageSize));
  const currentHistoryPage = Math.min(historyPage, historyTotalPages);
  const historyStart = (currentHistoryPage - 1) * historyPageSize;
  const visibleHistory = historicalLogs.slice(historyStart, historyStart + historyPageSize);
  const pendingLeaves = leaves.filter(l => l.status === 'Pending');

  const getUserDetails = (userId) => {
    return usersList.find(u => u.id === userId) || { username: 'Unknown', role: 'N/A' };
  };

  return (
    <div className="w-full max-w-7xl flex flex-col gap-4 relative">
      
      <AdminOverview records={allRecords} users={usersList} pendingLeaves={pendingLeaves.length} leaveRequests={pendingLeaves} busy={dataBusy} error={dataError} retry={fetchAllData} navigate={navigate || setActiveTab} onSelectEmployee={onSelectEmployee} addEmployee={()=>onCreateMode(true)} />

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
              {visibleHistory.length > 0 ? visibleHistory.map(item => {
                const emp = getUserDetails(item.user);
                return (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="p-2.5">
                      <div className="font-bold text-zinc-900">{personName(emp)}</div>
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 mt-4 text-sm">
          <span className="text-slate-600">Showing {historicalLogs.length ? historyStart + 1 : 0}–{Math.min(historyStart + historyPageSize, historicalLogs.length)} of {historicalLogs.length} records</span>
          <nav aria-label="Attendance history pages" className="flex items-center gap-3">
            <button type="button" className="admin-button" disabled={currentHistoryPage === 1} onClick={() => setHistoryPage(currentHistoryPage - 1)}>Previous</button>
            <span aria-live="polite">Page {currentHistoryPage} of {historyTotalPages}</span>
            <button type="button" className="admin-button" disabled={currentHistoryPage === historyTotalPages} onClick={() => setHistoryPage(currentHistoryPage + 1)}>Next</button>
          </nav>
        </div>
      </div>

      </details>
      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm border border-slate-200">
            <h3 className="text-base font-bold text-zinc-900 mb-1">Edit Record</h3>
            <p className="text-xs normal-case tracking-normal font-bold text-slate-500 mb-4">
              {personName(getUserDetails(editingRecord.user))} • {editingRecord.date}
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
