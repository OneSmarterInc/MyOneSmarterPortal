import React, { useState, useEffect } from 'react';
import { getSchedules, saveSchedule, deleteSchedule } from '../services/api';

export default function ManagerSchedule() {
  const [schedules, setSchedules] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal State
  const [editingDate, setEditingDate] = useState(null);
  const [formData, setFormData] = useState({ day_type: 'Working', start_time: '', end_time: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const res = await getSchedules();
      setSchedules(res.data);
    } catch (err) {
      console.error(err);
    }
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
      alert('Failed to save schedule.');
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
    <div className="w-full max-w-7xl flex flex-col gap-4 relative">
      
      {/* Compact Welcome Panel */}
      <div className="bg-white p-4 sm:px-6 sm:py-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-400"></div>
        <div className="relative z-10">
          <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest">Company Calendar</span>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 mt-0.5 tracking-tight">Schedule Management</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Configure holidays, half-days, and custom working hours globally.</p>
        </div>
        
        {/* Legend */}
        <div className="mt-4 md:mt-0 flex gap-3 sm:gap-6 border border-slate-200 bg-slate-50 px-4 py-2 rounded-lg">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-white border border-slate-300"></div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Working</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-300"></div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300"></div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Half-Day</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm flex-grow flex flex-col">
        
        {/* Calendar Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 shrink-0">
          <h3 className="text-lg sm:text-xl font-black text-zinc-900 uppercase tracking-wide">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex gap-2">
            <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))} className="px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-[10px] font-bold text-slate-600 uppercase transition shadow-sm">Prev Month</button>
            <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))} className="px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-[10px] font-bold text-slate-600 uppercase transition shadow-sm">Next Month</button>
          </div>
        </div>

        {/* Days of Week Row */}
        <div className="grid grid-cols-7 gap-2 text-center mb-2 shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100">{d}</div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2 flex-grow auto-rows-[minmax(90px,_1fr)] sm:auto-rows-[minmax(100px,_1fr)]">
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
                className={`p-2 sm:p-3 border rounded-xl flex flex-col items-center justify-center transition cursor-pointer shadow-sm relative overflow-hidden group ${bgClass}`}
              >
                <span className={`font-black text-xl sm:text-2xl ${textClass}`}>{day}</span>
                <span className={`text-[8px] sm:text-[9px] uppercase tracking-widest mt-1 font-bold ${typeColor}`}>
                  {config.day_type}
                </span>
                
                {config.day_type !== 'Holiday' && config.start_time && (
                   <span className="text-[8px] font-bold text-slate-500 mt-1">
                     {config.start_time.substring(0,5)} - {config.end_time?.substring(0,5)}
                   </span>
                )}
                
                {config.description && (
                  <span className="text-[8px] font-bold text-slate-400 mt-1 truncate w-full px-1">
                    {config.description}
                  </span>
                )}
                
                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="bg-black text-white text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-md">Edit</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Configuration Modal */}
      {editingDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm border border-slate-200">
            <h3 className="text-base font-bold text-zinc-900 mb-1">Edit Configuration</h3>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-4">
              {editingDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Day Type</label>
                <select value={formData.day_type} onChange={e => setFormData({...formData, day_type: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded bg-white">
                  <option value="Working">Working Day</option>
                  <option value="Half-Day">Half-Day</option>
                  <option value="Holiday">Holiday</option>
                </select>
              </div>

              {formData.day_type !== 'Holiday' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Start Time</label>
                    <input type="time" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">End Time</label>
                    <input type="time" value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Description / Reason</label>
                <input type="text" placeholder="e.g. Christmas, Early Dismissal" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded" />
              </div>
              
              <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-100">
                <button type="button" onClick={handleReset} className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-red-600 transition underline">
                  Reset to Default
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingDate(null)} className="px-3 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-100 rounded transition">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSaving} className="px-4 py-1.5 bg-zinc-900 hover:bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded transition disabled:bg-slate-400">
                    {isSaving ? 'Saving...' : 'Apply'}
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
