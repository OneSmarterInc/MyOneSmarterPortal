import React, { useState, useEffect } from 'react';
import { getAttendance, markAttendance, updateAttendance, getSchedules, getProfile, getLeaveRequests } from '../services/api';

export default function EmployeeDashboard({ user, onNavigate }) {
  const [history, setHistory] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  
  // Notification State
  const [newAssignmentAlert, setNewAssignmentAlert] = useState(null);

  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [attRes, schedRes, profRes, leaveRes] = await Promise.all([
        getAttendance(),
        getSchedules(),
        getProfile(user.user_id),
        getLeaveRequests()
      ]);
      setHistory(attRes.data.filter(item => item.user === user.user_id));
      setSchedules(schedRes.data);
      setProfile(profRes.data);
      
      setApprovedLeaves(leaveRes.data.filter(l => l.user_id === user.user_id && l.status === 'Approved' && l.request_type !== 'Work From Home'));

      // Check for Manager-Assigned WFH to show the alert on the dashboard
      const userWfhRecords = leaveRes.data.filter(item => item.user_id === user.user_id && item.request_type === 'Work From Home');
      const managerAssigned = userWfhRecords.filter(item => item.reason.toLowerCase().includes('assigned by management'));
      
      if (managerAssigned.length > 0) {
        // Get the most recently created assignment
        const latestAssignment = managerAssigned.reduce((prev, current) => (prev.id > current.id) ? prev : current);
        
        // Check if the user has explicitly dismissed this specific assignment
        const dismissedId = localStorage.getItem('dismissed_wfh_assignment_id');
        if (dismissedId !== String(latestAssignment.id)) {
          setNewAssignmentAlert(latestAssignment);
        }
      }

    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    let active = true;
    const refreshSchedules = async () => {
      try {
        const result = await getSchedules();
        if (active && Array.isArray(result.data)) setSchedules(result.data);
      } catch { /* Retain the last successful calendar until the next refresh. */ }
    };
    const timer = window.setInterval(refreshSchedules, 60000);
    window.addEventListener('focus', refreshSchedules);
    window.addEventListener('calendarUpdated', refreshSchedules);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshSchedules);
      window.removeEventListener('calendarUpdated', refreshSchedules);
    };
  }, []);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const todayRecord = history.find(h => h.date === todayStr);

  const handleCheckIn = async () => {
    setLoading(true);
    setMsg('');
    const timeNow = new Date().toTimeString().split(' ')[0];
    try {
      await markAttendance({ user: user.user_id, check_in: timeNow, status: 'Pending' });
      await fetchData();
      setMsg('Check-In request sent to manager for approval.');
    } catch (err) {
      setMsg('Failed to check in.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayRecord) return;
    setLoading(true);
    setMsg('');
    const timeNow = new Date().toTimeString().split(' ')[0];
    try {
      await updateAttendance(todayRecord.id, { check_out: timeNow });
      await fetchData();
      setMsg('Check-Out request sent to administrator for approval.');
    } catch (err) {
      setMsg('Failed to check out.');
    } finally {
      setLoading(false);
    }
  };

  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    return new Date(d.setDate(d.getDate() - day));
  };

  const weekStart = getStartOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(h, 10), parseInt(m, 10));
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getHoursNum = (inStr, outStr) => {
    if (!inStr || !outStr) return 0;
    const [h1, m1] = inStr.split(':');
    const [h2, m2] = outStr.split(':');
    const d1 = new Date(); d1.setHours(parseInt(h1, 10), parseInt(m1, 10), 0);
    const d2 = new Date(); d2.setHours(parseInt(h2, 10), parseInt(m2, 10), 0);
    const diff = (d2 - d1) / (1000 * 60 * 60);
    return diff > 0 ? diff : 0;
  };

  const calculateHours = (inStr, outStr) => {
    const totalMinutes = Math.max(0, Math.round(getHoursNum(inStr, outStr) * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  };

  const getDayConfiguration = (date) => {
    const dateStr = date.toLocaleDateString('en-CA');
    const dbOverride = schedules.find(s => s.date === dateStr);
    if (dbOverride) return dbOverride;
    if (date.getDay() === 0) return { day_type: 'Holiday', description: 'Sunday' };
    return { day_type: 'Working' };
  };

  const getApprovedLeaveForDate = (date) => {
    const dateStr = date.toLocaleDateString('en-CA');
    return approvedLeaves.find(l => dateStr >= l.start_date && dateStr <= l.end_date);
  };

  let startDate = profile?.joining_date ? new Date(profile.joining_date) : (history.length > 0 ? new Date([...history].sort((a, b) => new Date(a.date) - new Date(b.date))[0].date) : null);
  
  let totalWorkingDays = 0;
  if (startDate) {
    const end = new Date(); 
    let current = new Date(startDate);
    
    while (current <= end) {
      const config = getDayConfiguration(current);
      const isLeave = getApprovedLeaveForDate(current);
      if (config.day_type !== 'Holiday' && !isLeave) {
        totalWorkingDays++;
      }
      current.setDate(current.getDate() + 1);
    }
  }

  const totalPresent = history.filter(h => h.status === 'Present' || h.status === 'Late').length;
  const netAttendance = totalWorkingDays > 0 ? ((totalPresent / totalWorkingDays) * 100).toFixed(2) : 0.00;
  const totalHoursWorked = history.reduce((acc, curr) => acc + getHoursNum(curr.check_in, curr.check_out), 0).toFixed(2);

  // Handle explicit dismissal of the alert
  const handleDismissAlert = () => {
    if (newAssignmentAlert) {
      localStorage.setItem('dismissed_wfh_assignment_id', String(newAssignmentAlert.id));
      setNewAssignmentAlert(null);
    }
  };

  return (
    <div className="employee-workspace w-full min-w-0 max-w-7xl flex flex-col gap-5">
      
      <div className="workspace-page-intro"><span>YOUR WORKDAY, AT A GLANCE</span><h1>My overview</h1><p>Everything you need to start your day and stay connected.</p></div>
      {/* Compact Welcome Panel */}
      <div className="bg-white p-5 sm:px-6 sm:py-6 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden shrink-0">
        
        <div className="relative z-10 mb-4 md:mb-0">
          <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest">{user.role === 'intern' ? 'Intern workspace' : 'Employee workspace'}</span>
          <h2 className="text-2xl sm:text-[26px] font-semibold text-zinc-900 mt-1 tracking-tight">Welcome, {user.username}</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Start your workday, track your hours, and manage your attendance.</p>
        </div>
        
        <div className="relative z-10 flex items-center w-full md:w-auto">
          {!todayRecord ? (
            <button 
              onClick={handleCheckIn} 
              disabled={loading}
              className="admin-button primary w-full md:w-auto"
            >
              {loading ? 'Processing...' : 'Check In Now'}
            </button>
          ) : !todayRecord.check_out ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <div className="flex flex-col items-center justify-center bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  In: {formatTime(todayRecord.check_in)}
                </span>
                {todayRecord.status === 'Pending' && (
                  <span className="text-[9px] font-bold text-emerald-600 mt-0.5 uppercase tracking-widest">Pending Approval</span>
                )}
              </div>
              <button 
                onClick={handleCheckOut} 
                disabled={loading}
                className="admin-button primary w-full md:w-auto"
              >
                {loading ? 'Processing...' : 'Check Out Now'}
              </button>
            </div>
          ) : (
             <div className="w-full md:w-auto flex flex-col items-center justify-center bg-slate-50 border border-slate-200 px-5 py-2 rounded-lg">
               <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                 {todayRecord.status === 'Pending' ? 'Check-Out Submitted' : todayRecord.status === 'Absent' ? 'Attendance Rejected' : 'Shift Completed'} (Out: {formatTime(todayRecord.check_out)})
               </span>
               {todayRecord.status === 'Pending' && (
                 <span className="text-[9px] font-bold text-amber-600 mt-0.5 uppercase tracking-widest">Check-Out Pending Approval</span>
               )}
             </div>
          )}
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm shrink-0">
          {msg}
        </div>
      )}

      {/* Notification Banner (Dismissable via cross button) */}
      {newAssignmentAlert && (
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl shadow-sm flex justify-between items-start sm:items-center shrink-0">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 block mb-0.5">New Assignment Alert</span>
            <span className="text-sm font-bold text-indigo-900">
              Management has assigned you Work From Home for <span className="underline">{newAssignmentAlert.start_date}</span> 
              {newAssignmentAlert.start_date !== newAssignmentAlert.end_date && <span> to <span className="underline">{newAssignmentAlert.end_date}</span></span>}.
            </span>
          </div>
          <button onClick={handleDismissAlert} className="text-indigo-400 hover:text-indigo-700 transition p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      )}

      <div className="workspace-quick-actions" aria-label="Quick actions">
        <button onClick={() => onNavigate('leave')}><span>01 / TIME OFF</span><strong>Plan your next break <b aria-hidden="true">↗</b></strong><small>View leave balances and send a request</small></button>
        <button onClick={() => onNavigate('wfh')}><span>02 / FLEXIBLE WORK</span><strong>Work from home <b aria-hidden="true">↗</b></strong><small>Manage requests and assigned days</small></button>
        <button onClick={() => onNavigate('profile')}><span>03 / YOUR DETAILS</span><strong>Keep your profile current <b aria-hidden="true">↗</b></strong><small>Review your personal and work information</small></button>
      </div>
      {/* Compact Performance Widget */}
      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden shrink-0">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex justify-between items-center">
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Attendance summary</h3>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">
            As of {new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
        
        <div className="p-5 sm:px-6 sm:py-4">
          <div className="flex flex-col lg:flex-row items-center divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="flex-1 flex justify-around w-full pb-4 lg:pb-0 lg:pr-6">
               <div className="text-center">
                 <div className="text-3xl sm:text-4xl font-black text-red-600 tracking-tighter">{totalPresent}</div>
                 <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Days Present</div>
               </div>
               <div className="text-center">
                 <div className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tighter">{totalWorkingDays}</div>
                 <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Working Days</div>
               </div>
               <div className="text-center hidden sm:block">
                 <div className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tighter">{totalHoursWorked}</div>
                 <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Hours Logged</div>
               </div>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center pt-4 lg:pt-0 lg:pl-6 w-full">
               <span className="text-[9px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Net Attendance Score</span>
               <div className="relative flex items-center justify-center">
                 <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                   <circle cx="40" cy="40" r="34" stroke="#f1f5f9" strokeWidth="8" fill="none" />
                   <circle 
                      cx="40" cy="40" r="34" stroke="#dc2626" strokeWidth="8" fill="none" 
                      strokeDasharray="213.6" 
                      strokeDashoffset={213.6 - (213.6 * netAttendance) / 100} 
                      strokeLinecap="round" 
                   />
                 </svg>
                 <span className="absolute text-lg font-black text-zinc-900">{Math.min(netAttendance, 100)}<span className="text-xs text-red-600">%</span></span>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Weekly View Section */}
      <div className="admin-panel bg-white p-4 sm:p-6 flex-grow flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-slate-100 shrink-0">
          <h3 className="text-sm sm:text-base font-semibold text-zinc-900">
            Week of {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
          <div className="flex w-full sm:w-auto gap-2">
            <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))} className="admin-button flex-1 sm:flex-none">Prev Week</button>
            <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))} className="admin-button flex-1 sm:flex-none">Next Week</button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-3 flex-grow min-h-0">
          {weekDays.map((day, index) => {
            const dateStr = day.toLocaleDateString('en-CA');
            const record = history.find(h => h.date === dateStr);
            const status = record ? record.status : null;
            
            const config = getDayConfiguration(day);
            const isHoliday = config.day_type === 'Holiday';
            const isHalfDay = config.day_type === 'Half-Day';
            const approvedLeave = getApprovedLeaveForDate(day);
            
            let topBorderColor = "border-t-red-500"; 
            let bgClass = "bg-white";
            let valueColor = "text-slate-700";
            
            if (isHoliday) {
              topBorderColor = "border-t-blue-500";
              bgClass = "bg-blue-50/70";
              valueColor = "text-blue-700";
            } else if (isHalfDay) {
              topBorderColor = "border-t-amber-500";
              bgClass = "bg-amber-50/70";
              valueColor = "text-amber-700";
            } else if (approvedLeave) {
              topBorderColor = "border-t-orange-400";
              bgClass = "bg-orange-50/50";
            } else if (status === 'Present') {
              topBorderColor = "border-t-emerald-500";
              valueColor = "text-emerald-700";
            } else if (status === 'Late') {
              topBorderColor = "border-t-amber-500";
              valueColor = "text-amber-700";
            } else if (status === 'Pending') {
              topBorderColor = "border-t-indigo-500";
            }

            const checkInFmt = record?.check_in ? formatTime(record.check_in) : '--:--';
            const checkOutFmt = record?.check_out ? formatTime(record.check_out) : '--:--';
            const timeRange = (record?.check_in || record?.check_out) ? `${checkInFmt} - ${checkOutFmt}` : '--:--';
            const hours = calculateHours(record?.check_in, record?.check_out);

            return (
              <div key={day.toISOString()} className={`flex flex-col items-center justify-between p-3 border border-slate-200 rounded-xl shadow-sm border-t-[6px] ${topBorderColor} ${bgClass} min-h-[130px] min-w-0 transition-transform hover:-translate-y-0.5 ${index === 6 ? 'max-sm:col-span-2 max-sm:w-[calc(50%-0.25rem)] max-sm:justify-self-center' : ''}`}>
                
                <div className="text-center space-y-1 w-full">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="text-sm font-bold text-zinc-900">
                    {day.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                  </div>
                  
                  {(record?.check_in || record?.check_out) && !approvedLeave && (
                    <div className="text-[9px] font-bold text-slate-500 tracking-wider pt-1 whitespace-nowrap">
                      {timeRange}
                    </div>
                  )}
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 w-full text-center">
                  {isHoliday ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Company Holiday</span>
                      {config.description && <span className="text-[10px] text-blue-700 break-words">{config.description}</span>}
                      {record?.check_in && <span className="text-xs font-semibold text-blue-700">{hours} logged</span>}
                    </div>
                  ) : isHalfDay ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Half-Day</span>
                      {config.description && <span className="text-[10px] text-amber-700 break-words">{config.description}</span>}
                      {config.start_time && config.end_time && <span className="text-[10px] text-amber-700">{formatTime(config.start_time)} – {formatTime(config.end_time)}</span>}
                      {record?.check_in && <span className="text-xs font-semibold text-amber-700">{hours} logged</span>}
                    </div>
                  ) : approvedLeave ? (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">On Leave</span>
                    </div>
                  ) : (
                    <div className={`text-xl font-black tracking-tight ${valueColor}`}>
                      {hours}
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
