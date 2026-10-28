import API from './api';
export const getAttendanceClock = () => API.get('attendance-clock/');
export function attendanceAuth() {
  let token = '';
  try { token = JSON.parse(localStorage.getItem('user') || '{}').letter_token || ''; } catch {}
  return { headers: { Authorization: `Bearer ${token}` } };
}
export const punchAttendance = action => API.post('attendance/punch/', { action }, attendanceAuth());
// A calendar-only Date whose local fields represent IST, regardless of the
// browser timezone. Never use it as an absolute timestamp for network calls.
export function istCalendarDate(instant) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(instant).map(part => [part.type, part.value]));
  return new Date(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
}

export const editAttendanceTimes = (id, values) => API.post(`attendance/${id}/times/`, values, attendanceAuth());
