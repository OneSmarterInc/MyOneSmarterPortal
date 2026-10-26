export const toTimeParts = (value) => {
  if (!value) return { hour: '', minute: '00', second: '00', period: 'PM' };
  const [hour, minute, second = '00'] = value.split(':');
  return { hour: String(Number(hour) % 12 || 12).padStart(2, '0'), minute, second, period: Number(hour) >= 12 ? 'PM' : 'AM' };
};

export const toApiTime = ({ hour, minute, second, period }) => {
  if (!hour) return null;
  const hours = Number(hour) % 12 + (period === 'PM' ? 12 : 0);
  return `${String(hours).padStart(2, '0')}:${minute}:${second}`;
};

export const formatAttendanceTime = (value, fallback = '-') => {
  if (!value) return fallback;
  const { hour, minute, period } = toTimeParts(value);
  return `${hour}:${minute} ${period}`;
};
