import React, { useState, useEffect } from 'react';
import { getAttendance } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function EmployeeHistory({ user }) {
  const [history, setHistory] = useState([]);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await getAttendance();
      const userRecords = res.data.filter(item => item.user === user.user_id);
      
      // Calculate totals for the chart
      const counts = { Present: 0, Absent: 0, Late: 0, Pending: 0 };
      userRecords.forEach(record => {
        if (counts[record.status] !== undefined) {
          counts[record.status] += 1;
        }
      });

      setChartData([
        { name: 'Present', count: counts.Present, color: '#10b981' }, // Emerald
        { name: 'Absent', count: counts.Absent, color: '#ef4444' },  // Red
        { name: 'Late', count: counts.Late, color: '#f59e0b' },      // Amber
        { name: 'Pending', count: counts.Pending, color: '#3b82f6' } // Blue
      ]);

      setHistory(userRecords);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full max-w-5xl space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Analytics</span>
          <h2 className="text-xl font-bold text-zinc-900 mt-0.5">Attendance History Chart</h2>
          <p className="text-xs text-slate-500">Visual overview of your complete attendance record.</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 mb-6">Status Distribution</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }} 
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Log Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 mb-4">Detailed Records</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase">
                <th className="p-3 font-bold">Date</th>
                <th className="p-3 font-bold">Check-In Time</th>
                <th className="p-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length > 0 ? history.map(item => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="p-3 font-medium text-zinc-900">{item.date}</td>
                  <td className="p-3 text-slate-600">{item.check_in || '-'}</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      item.status === 'Present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      item.status === 'Late' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                      item.status === 'Pending' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="3" className="p-8 text-center text-slate-400 text-sm">No attendance records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}