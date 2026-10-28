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
      <div className="bg-white p-3 sm:p-6 rounded-2xl border border-slate-200 shadow-none flex-grow flex flex-col overflow-hidden">
        
        {/* Calendar Header */}
        <div className="flex flex-wrap gap-3 justify-between items-center mb-5 pb-5 border-b border-slate-100 shrink-0">
          <h3 className="text-xl sm:text-2xl font-semibold text-zinc-900 tracking-tight">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex gap-2">
            <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))} className="admin-button  ">Previous</button>
            <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))} className="admin-button  ">Next</button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-600" aria-label="Calendar legend">
          <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Working day</span>
          <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-blue-500" />Holiday</span>
          <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" />Half-day</span>
          <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-red-500" />Custom schedule</span>
        </div>
        {/* Days of Week Row */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center mb-2 shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500 py-2">{d}</div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div className="admin-calendar-grid grid grid-cols-7 gap-1.5 sm:gap-2 flex-grow auto-rows-[minmax(76px,_1fr)] sm:auto-rows-[minmax(118px,_1fr)]">
          {blanks.map(b => <div key={`blank-${b}`} className="p-2 bg-transparent"></div>)}
          
          {daysArray.map(day => {
            const dateObj = new Date(currentYear, currentMonth, day);
            const config = getDayConfiguration(dateObj);
            
            const isHoliday = config.day_type === 'Holiday';
            const isHalfDay = config.day_type === 'Half-Day';
            const isToday = dateObj.toDateString() === new Date().toDateString();
            const hasOverride = schedules.some(item => item.date === dateObj.toLocaleDateString('en-CA'));
            const colors = isHoliday
              ? 'border-blue-200 bg-blue-50/60 hover:border-blue-400'
              : isHalfDay
                ? 'border-amber-200 bg-amber-50/60 hover:border-amber-400'
                : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50/60';
            const pill = isHoliday
              ? 'bg-blue-100 text-blue-700'
              : isHalfDay
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-50 text-emerald-700';
            return (
              <button key={day} type="button" onClick={() => openEditModal(dateObj)}
                aria-label={dateObj.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) + ', ' + config.day_type}
                className={`admin-calendar-day group relative flex min-w-0 flex-col items-start rounded-xl border p-2 sm:p-3 text-left shadow-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-500 ${colors}`}>
                <div className="flex w-full items-start justify-between gap-1">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold sm:h-8 sm:w-8 sm:text-base ${isToday ? 'bg-[#c7192d] text-white' : 'text-slate-900'}`}>{day}</span>
                  {hasOverride && <span title="Customized by manager" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />}
                </div>
                <span className={`mt-2 max-w-full truncate rounded-md px-1.5 py-0.5 text-[9px] font-semibold sm:text-[10px] ${pill}`}>
                  <span className="hidden sm:inline">{config.day_type === 'Working' ? 'Working day' : config.day_type}</span>
                  <span className="sm:hidden">{isHoliday ? 'Off' : isHalfDay ? 'Half' : 'Work'}</span>
                </span>
                {config.day_type !== 'Holiday' && config.start_time && config.end_time && (
                  <span className="mt-2 hidden w-full truncate text-[10px] font-medium text-slate-600 sm:block">
                    {formatAttendanceTime(config.start_time)} – {formatAttendanceTime(config.end_time)}
                  </span>
                )}
                {config.description && config.description !== 'Standard Shift' && config.description !== 'Sunday (Default)' && (
                  <span className="mt-1 hidden w-full truncate text-[10px] text-slate-500 sm:block" title={config.description}>{config.description}</span>
                )}
                {config.description === 'Sunday (Default)' && <span className="mt-1 hidden text-[10px] text-slate-400 sm:block">Weekly off</span>}
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
