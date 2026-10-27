import React, { useState, useEffect } from 'react';
import { getUsers, getAttendance } from '../services/api';

const PAGE_SIZE = 10;
const formatDate = value => {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const formatTime = value => {
  if (!value) return '—';
  const [hour, minute] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export default function ManagerReport() {
  const [users, setUsers] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [fetchError, setFetchError] = useState('');
  const [fetching, setFetching] = useState(true);
  const [generatedAt, setGeneratedAt] = useState(() => new Date());

  useEffect(() => { fetchData(); }, []);
  async function fetchData() {
    setFetching(true);
    setFetchError('');
    try {
      const [userRes, attRes] = await Promise.all([getUsers(), getAttendance()]);
      if (!Array.isArray(userRes.data) || !Array.isArray(attRes.data)) {
        throw new Error('Unexpected API response. Expected employee and attendance lists.');
      }
      const employees = userRes.data.filter(u => String(u.role || '').toLowerCase() !== 'manager');
      setUsers(employees);
      setAllRecords(attRes.data);
      if (!employees.length && !attRes.data.length) {
        setFetchError('The server returned no employee accounts or attendance records. Check that the frontend is connected to the correct backend database, then retry.');
      } else if (!employees.length) {
        setFetchError('Attendance was found, but the server returned no selectable employee accounts. Check the /api/users/ response and user roles.');
      }
    } catch {
      setFetchError('Unable to load employees or attendance from the backend. Verify the API connection, then try again.');
    } finally {
      setFetching(false);
    }
  }

  const filteredRecords = allRecords.filter(record => {
    if (selectedUser && String(record.user) !== selectedUser) return false;
    if (startDate && record.date < startDate) return false;
    if (endDate && record.date > endDate) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const selectedUserInfo = users.find(u => String(u.id) === selectedUser);
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const printPages = Array.from({ length: totalPages }, (_, index) =>
    filteredRecords.slice(index * PAGE_SIZE, (index + 1) * PAGE_SIZE));
  const firstDate = filteredRecords.length ? filteredRecords[filteredRecords.length - 1].date : '';
  const lastDate = filteredRecords.length ? filteredRecords[0].date : '';
  const period = `${formatDate(startDate || firstDate)} – ${formatDate(endDate || lastDate)}`;

  const handlePrint = () => {
    if (fetching || fetchError || filteredRecords.length === 0) return;
    setGeneratedAt(new Date());
    // Let React commit the timestamp before opening the browser print dialog.
    requestAnimationFrame(() => window.print());
  };
  const resetPage = setter => value => { setter(value); setPage(1); };

  return (
    <div className="attendance-report admin-legacy w-full max-w-6xl space-y-6">
      <style>{`
        .attendance-report .report-print-document { display: none; }
        @page { size: A4 portrait; margin: 12mm; }
        @media print {
          html, body, #root { background: #fff !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          body > #root > div > footer { display: none !important; }
          .admin-workspace .attendance-report { max-width: none !important; padding: 0 !important; margin: 0 !important; }
          .attendance-report .report-screen { display: none !important; }
          .attendance-report .report-print-document { display: block !important; }
          .attendance-report .report-sheet { width: 100%; min-height: 270mm; box-sizing: border-box; display: flex; flex-direction: column; break-after: page; page-break-after: always; font-family: Arial, sans-serif; color: #10141a; }
          .attendance-report .report-sheet:last-child { break-after: auto; page-break-after: auto; }
          .attendance-report .report-letterhead { display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #111; padding: 0 0 9px; font-size: 11px; font-weight: 600; }
          .attendance-report .report-letterhead img { height: 32px; width: 32px; object-fit: contain; }
          .attendance-report .report-title { margin: 38px 0 45px; text-align: center; font-size: 23px; font-weight: 750; }
          .attendance-report .report-title::after { content: ''; display: block; height: 3px; width: 155px; background: #cb0015; margin: 14px auto 0; }
          .attendance-report .report-info { border: 1px solid #444; padding: 9px; margin-bottom: 16px; }
          .attendance-report .report-info table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .attendance-report .report-info td { padding: 11px 12px; border: 1px solid #c2c7cd; }
          .attendance-report .report-info .report-label { width: 19%; background: #f7e2e2 !important; font-weight: 700; }
          .attendance-report .report-info .report-value { width: 33%; }
          .attendance-report .report-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; text-align: center; }
          .attendance-report .report-table th { padding: 13px 7px; background: #c40013 !important; color: white !important; border: 1px solid #aaa; font-weight: 700; }
          .attendance-report .report-table td { border: 1px solid #a2a9b1; padding: 13px 7px; overflow-wrap: anywhere; }
          .attendance-report .report-generated { text-align: right; font-size: 11px; font-weight: 700; margin-top: 28px; }
          .attendance-report .report-signature { margin-top: auto; align-self: flex-end; width: 255px; text-align: center; font-size: 12px; padding-bottom: 24px; }
          .attendance-report .report-signature .line { border-top: 2px solid #111; padding-top: 8px; }
          .attendance-report .report-signature strong { display: block; font-size: 14px; margin-bottom: 3px; }
          .attendance-report .report-footer { display: flex; justify-content: space-between; gap: 10px; border-top: 2px solid #111; padding-top: 15px; font-size: 10px; }
        }
      `}</style>
      <div className="report-screen space-y-6">
        <header className="admin-page-heading"><div><h1>Attendance reports</h1><p>Filter attendance by person and date. Print one employee or all employees as a PDF.</p></div></header>
        {fetchError && <div role="alert" className="admin-error">{fetchError} <button type="button" className="ml-2 underline font-semibold" onClick={fetchData}>Retry loading</button></div>}
        {fetching && <p role="status" className="admin-loading">Loading…</p>}
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div><label htmlFor="report-employee" className="block text-sm mb-1">Select Employee</label>
              <select id="report-employee" disabled={fetching || users.length === 0} value={selectedUser} onChange={e => resetPage(setSelectedUser)(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white">
                <option value="">{fetching ? 'Loading employees…' : users.length ? 'All employees' : 'No employees available'}</option>
                {users.map(u => <option key={u.id} value={u.id}>@{u.username} ({u.email})</option>)}
              </select>
            </div>
            <div><label htmlFor="report-start" className="block text-sm mb-1">Start Date</label><input id="report-start" type="date" value={startDate} onChange={e => resetPage(setStartDate)(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg" /></div>
            <div><label htmlFor="report-end" className="block text-sm mb-1">End Date</label><input id="report-end" type="date" min={startDate || undefined} value={endDate} onChange={e => resetPage(setEndDate)(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg" /></div>
            <button onClick={handlePrint} disabled={fetching || !!fetchError || !filteredRecords.length || (!!startDate && !!endDate && endDate < startDate)} className="admin-button primary w-full">Print / save PDF</button>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="p-4">Employee</th><th className="p-4">Date</th><th className="p-4">Start Time</th><th className="p-4">End Time</th><th className="p-4">Status</th>
              </tr></thead>
              <tbody>{fetching ? <tr><td colSpan="5" className="p-8 text-center text-slate-500">Loading attendance records…</td></tr> : visibleRecords.length ? visibleRecords.map(item => <tr key={item.id} className="border-b border-slate-100">
                <td className="p-4">{users.find(u => String(u.id) === String(item.user))?.username || 'Unknown'}</td>
                <td className="p-4 font-semibold">{item.date}</td>
                <td className="p-4">{formatTime(item.check_in)}</td>
                <td className="p-4">{formatTime(item.check_out)}</td>
                <td className="p-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold border ${item.status === 'Present' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : item.status === 'Late' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>{item.status}</span></td>
              </tr>) : <tr><td colSpan="5" className="p-8 text-center text-slate-500">No attendance records found for the selected criteria.</td></tr>}</tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-slate-200 text-sm">
            <span className="text-slate-600">Showing {filteredRecords.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filteredRecords.length)} of {filteredRecords.length} records</span>
            <nav aria-label="Attendance report pages" className="flex items-center gap-3">
              <button type="button" className="admin-button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
              <span aria-live="polite">Page {currentPage} of {totalPages}</span>
              <button type="button" className="admin-button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Next</button>
            </nav>
          </div>
        </div>
      </div>
      {filteredRecords.length > 0 && <div className="report-print-document" aria-hidden="true">
        {printPages.map((records, index) => <section className="report-sheet" key={index}>
          <div className="report-letterhead"><img src="/images/logo.png" alt="" />One Smarter Inc., USA</div>
          <h1 className="report-title">ATTENDANCE RECORD</h1>
          <div className="report-info"><table><tbody>
            <tr><td className="report-label">{selectedUserInfo ? 'Employee Name:' : 'Report Scope:'}</td><td className="report-value">{selectedUserInfo ? selectedUserInfo.username : 'All employees'}</td><td className="report-label">{selectedUserInfo ? 'Employee ID:' : 'Employees:'}</td><td>{selectedUserInfo ? (selectedUserInfo.employee_id || selectedUserInfo.id) : new Set(filteredRecords.map(record => String(record.user))).size}</td></tr>
            <tr><td className="report-label">Period:</td><td colSpan="3">{period}</td></tr>
          </tbody></table></div>
          <table className="report-table"><thead><tr><th style={{width:'12%'}}>Sr. No.</th>{!selectedUserInfo && <th>Employee</th>}<th>Date</th><th>Start Time</th><th>End Time</th><th>Status</th></tr></thead>
            <tbody>{records.map((record, row) => <tr key={record.id}>
              <td>{index * PAGE_SIZE + row + 1}</td>{!selectedUserInfo && <td>{users.find(u => String(u.id) === String(record.user))?.username || 'Unknown'}</td>}<td>{formatDate(record.date)}</td><td>{formatTime(record.check_in)}</td><td>{formatTime(record.check_out)}</td><td>{record.status}</td>
            </tr>)}</tbody>
          </table>
          <p className="report-generated">Generated on: {generatedAt.toLocaleString('en-US')}</p>
          <div className="report-signature"><div className="line"><strong>Akshay Agrawal</strong>Global Service and Delivery Manager</div></div>
          <div className="report-footer"><span>© 2026 One Smarter Inc., USA. All rights reserved. Secure Compliance &amp; Systems.</span><span>{index + 1} / {totalPages}</span></div>
        </section>)}
      </div>}
    </div>
  );
}
