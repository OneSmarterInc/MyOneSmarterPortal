import { portalAlert, portalConfirm } from './PortalDialog';
import { formatAttendanceTime } from '../utils/attendanceTime';
import React, { useState, useEffect } from 'react';
import { getSchedules, saveSchedule, deleteSchedule } from '../services/api';

export default function ManagerSchedule() {
  const [schedules, setSchedules] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal State
  const [editingDate, setEditingDate] = useState(null);
  const [formData, setFormData] = useState({ day_type: 'Working', start_time: '', end_time: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);

  const [fetchError,setFetchError] = useState('');
  const [fetching,setFetching] = useState(true);

  useEffect(() => {
    fetchSchedules();
  }, []);

  async function fetchSchedules() {
    setFetching(true);setFetchError('');
    try {
      const res = await getSchedules();
      setSchedules(res.data);
    } catch (err) {
      setFetchError('Unable to load this page. Please try again.');
    } finally {setFetching(false);}
  };

  const getDayConfiguration = (date) => {
    const dateStr = date.toLocaleDateString('en-CA');
    const dbOverride = schedules.find(s => s.date === dateStr);
    
    if (dbOverride) return dbOverride;
    
    // Default Rules: Sunday is Holiday, others are Working (1:00 PM to 9:00 PM)
    if (date.getDay() === 0) {
      return { day_type: 'Holiday', description: 'Sunday (Default)' };
    }
    return { day_type: 'Working', start_time: '13:00', end_time: '21:00', description: 'Standard Shift' };
  };

  const openEditModal = (date) => {
    const config = getDayConfiguration(date);
    setEditingDate(date);
    setFormData({
      day_type: config.day_type,
      start_time: config.start_time || '',
      end_time: config.end_time || '',
      description: config.description === 'Sunday (Default)' || config.description === 'Standard Shift' ? '' : (config.description || '')
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveSchedule({
        date: editingDate.toLocaleDateString('en-CA'),
        ...formData
      });
      fetchSchedules();
      setEditingDate(null);
    } catch (err) {
      portalAlert('Failed to save schedule.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await deleteSchedule(editingDate.toLocaleDateString('en-CA'));
      fetchSchedules();
      setEditingDate(null);
    } catch (err) {
      setEditingDate(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Calendar Calculation
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: startDay }, (_, i) => i);

  return (
    <div className="admin-legacy w-full max-w-7xl flex flex-col gap-4 relative">
      
      <header className="admin-page-heading"><div><h1>Company calendar</h1><p>Select a day to change working hours, holidays or half-days.</p></div><button className="admin-button" onClick={()=>setCurrentDate(new Date())}>Today</button></header>
      {fetchError && <div className="admin-error" role="alert">{fetchError} <button onClick={fetchSchedules}>Try again</button></div>}
      {fetching && <p role="status" className="admin-loading">Loading…</p>}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-none flex-grow flex flex-col">
        
        {/* Calendar Header */}
        <div className="flex flex-wrap gap-3 justify-between items-center mb-6 pb-4 border-b border-slate-100 shrink-0">
          <h3 className="text-lg sm:text-xl font-semibold text-zinc-900 normal-case tracking-normal">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex gap-2">
            <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))} className="admin-button  ">Previous</button>
            <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))} className="admin-button  ">Next</button>
          </div>
        </div>

        {/* Days of Week Row */}
        <div className="grid grid-cols-7 gap-2 text-center mb-2 shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-xs font-semibold text-slate-400 normal-case tracking-normal pb-2 border-b border-slate-100">{d}</div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div className="admin-calendar-grid grid grid-cols-7 gap-2 flex-grow auto-rows-[minmax(90px,_1fr)] sm:auto-rows-[minmax(100px,_1fr)]">
          {blanks.map(b => <div key={`blank-${b}`} className="p-2 bg-transparent"></div>)}
          
          {daysArray.map(day => {
            const dateObj = new Date(currentYear, currentMonth, day);
            const config = getDayConfiguration(dateObj);
            
            let bgClass = "bg-white border-slate-200 hover:border-slate-400"; 
            let textClass = "text-zinc-900";
            let typeColor = "text-slate-400";
            
            if (config.day_type === 'Holiday') {
              bgClass = "bg-blue-50/50 border-blue-200 hover:border-blue-400";
              textClass = "text-blue-900";
              typeColor = "text-blue-600";
            }
            if (config.day_type === 'Half-Day') {
              bgClass = "bg-amber-50/50 border-amber-200 hover:border-amber-400";
              textClass = "text-amber-900";
              typeColor = "text-amber-600";
            }

            return (
              <button 
                key={day} 
                onClick={() => openEditModal(dateObj)}
                aria-label={dateObj.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) + ', ' + config.day_type}
                className={`admin-calendar-day p-2 sm:p-3 border rounded-lg flex flex-col items-center justify-center transition cursor-pointer shadow-none relative overflow-hidden group ${bgClass}`}
              >
                <span className={`font-semibold text-xl sm:text-2xl ${textClass}`}>{day}</span>
                <span className={`text-xs sm:text-xs normal-case tracking-normal mt-1 font-bold ${typeColor}`}>
                  <span className="hidden sm:inline">{config.day_type}</span><span className="sm:hidden">{config.day_type === 'Working' ? 'Work' : config.day_type === 'Holiday' ? 'Off' : 'Half'}</span>
                </span>
                
                {config.day_type !== 'Holiday' && config.start_time && (
                   <span className="text-xs font-bold text-slate-500 mt-1">
                     {formatAttendanceTime(config.start_time)} - {formatAttendanceTime(config.end_time)}
                   </span>
                )}
                
                {config.description && (
                  <span className="text-xs font-bold text-slate-400 mt-1 truncate w-full px-1">
                    {config.description}
                  </span>
                )}
                
              </button>
            );
          })}
        </div>
      </div>

      {/* Configuration Modal */}
      {editingDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm border border-slate-200">
            <h3 className="text-base font-bold text-zinc-900 mb-1">Edit day</h3>
            <p className="text-xs normal-case tracking-normal font-bold text-slate-500 mb-4">
              {editingDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label htmlFor="managerschedule-field-1" className="block text-xs font-bold normal-case tracking-normal text-slate-600 mb-1">Day Type</label>
                <select id="managerschedule-field-1" value={formData.day_type} onChange={e => setFormData({...formData, day_type: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded bg-white">
                  <option value="Working">Working Day</option>
                  <option value="Half-Day">Half-Day</option>
                  <option value="Holiday">Holiday</option>
                </select>
              </div>

              {formData.day_type !== 'Holiday' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="managerschedule-field-2" className="block text-xs font-bold normal-case tracking-normal text-slate-600 mb-1">Start Time</label>
                    <input id="managerschedule-field-2" type="time" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded" />
                  </div>
                  <div>
                    <label htmlFor="managerschedule-field-3" className="block text-xs font-bold normal-case tracking-normal text-slate-600 mb-1">End Time</label>
                    <input id="managerschedule-field-3" type="time" value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded" />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="managerschedule-field-4" className="block text-xs font-bold normal-case tracking-normal text-slate-600 mb-1">Description / Reason</label>
                <input id="managerschedule-field-4" type="text" placeholder="e.g. Christmas, Early Dismissal" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded" />
              </div>
              
              <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-100">
                <button type="button" disabled={isSaving} onClick={handleReset} className="admin-button danger ">
                  Reset to Default
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingDate(null)} className="admin-button  ">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSaving} className="admin-button primary ">
                    {isSaving ? 'Saving...' : 'Save day'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
