import React, { useState, useEffect } from 'react';
import { getUsers, getAttendance } from '../services/api';

export default function ManagerReport() {
  const [users, setUsers] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  
  const [selectedUser, setSelectedUser] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [userRes, attRes] = await Promise.all([
        getUsers(),
        getAttendance()
      ]);
      // Filter out managers so only employees/students can be selected for reports
      setUsers(userRes.data.filter(u => u.role !== 'manager'));
      setAllRecords(attRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = () => {
    if (!selectedUser) {
      alert('Please select an employee before printing.');
      return;
    }
    window.print();
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(h, 10), parseInt(m, 10));
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Filter Records
  const filteredRecords = allRecords.filter(record => {
    if (selectedUser && record.user.toString() !== selectedUser) return false;
    if (startDate && record.date < startDate) return false;
    if (endDate && record.date > endDate) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const selectedUserInfo = users.find(u => u.id.toString() === selectedUser);

  return (
    <div className="w-full max-w-6xl space-y-6 print:m-0 print:w-full print:max-w-none print:space-y-4">
      
      {/* Header - Hidden during printing */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center print:hidden">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Analytics</span>
          <h2 className="text-xl font-bold text-zinc-900 mt-0.5">Attendance Report Generator</h2>
          <p className="text-xs text-slate-500">Select an employee and date range to generate a printable PDF report.</p>
        </div>
      </div>

      {/* Controls - Hidden during printing */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Select Employee</label>
            <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="w-full border border-slate-300 p-2.5 text-sm outline-none focus:border-red-500 rounded-lg bg-white">
              <option value="">-- All Employees --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>@{u.username} ({u.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-slate-300 p-2.5 text-sm outline-none focus:border-red-500 rounded-lg" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-slate-300 p-2.5 text-sm outline-none focus:border-red-500 rounded-lg" />
          </div>
          <div>
            <button onClick={handlePrint} disabled={!selectedUser} className="w-full bg-zinc-900 hover:bg-black disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition">
              Print PDF
            </button>
          </div>
        </div>
      </div>

      {/* Print-Only Header - Visible only on PDF */}
      <div className="hidden print:block text-center mb-8 border-b-2 border-slate-800 pb-4">
        <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">Attendance Record</h1>
        {selectedUserInfo && (
          <div className="mt-2 text-sm font-semibold text-slate-600">
            Employee: <span className="text-black uppercase">@{selectedUserInfo.username}</span> | ID: #{selectedUserInfo.id} <br/>
            Period: {startDate || 'Beginning'} to {endDate || 'Present'}
          </div>
        )}
      </div>

      {/* Table Section - Shared between UI and Print */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
        <table className="w-full text-left border-collapse text-sm print:text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase print:bg-white print:border-b-2 print:border-slate-800 print:text-black">
              <th className="p-4 font-bold">Date</th>
              <th className="p-4 font-bold">Start Time</th>
              <th className="p-4 font-bold">End Time</th>
              <th className="p-4 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length > 0 ? filteredRecords.map(item => (
              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 print:border-slate-300 print:break-inside-avoid">
                <td className="p-4 font-semibold text-slate-700 print:text-black">{item.date}</td>
                <td className="p-4 text-slate-600 print:text-black">{formatTime(item.check_in)}</td>
                <td className="p-4 text-slate-600 print:text-black">{formatTime(item.check_out)}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider print:p-0 print:bg-transparent print:border-none ${
                    item.status === 'Present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 print:text-black' :
                    item.status === 'Late' ? 'bg-amber-50 text-amber-700 border border-amber-200 print:text-black' : 
                    item.status === 'Pending' ? 'bg-blue-50 text-blue-700 border border-blue-200 print:text-black' : 'bg-red-50 text-red-700 border border-red-200 print:text-black'
                  }`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="4" className="p-8 text-center text-slate-400 text-sm">No attendance records found for the selected criteria.</td></tr>
            )}
          </tbody>
        </table>
        
        {/* Print-Only Footer */}
        <div className="hidden print:block mt-8 pt-4 border-t border-slate-300 text-right text-xs font-semibold text-slate-500">
          Generated on: {new Date().toLocaleString()}
        </div>
      </div>
      
    </div>
  );
}
