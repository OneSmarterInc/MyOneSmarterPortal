export const isWFH = type => ['wfh', 'work from home'].includes(String(type || '').trim().toLowerCase());
export function requestDays(request) {
  if (request.request_type.toLowerCase().includes('half-day')) return 0.5;
  const days = Math.round((Date.parse(request.end_date) - Date.parse(request.start_date)) / 86400000) + 1;
  return Number.isFinite(days) ? Math.max(0, days) : 0;
}
export function leaveBalances(userId, allocations, requests, remote = false) {
  const balances = new Map();
  const entry = type => {
    const key = remote ? 'Work From Home' : type;
    if (!balances.has(key)) balances.set(key, { type: key, allocated: 0, approved: 0, pending: 0 });
    return balances.get(key);
  };
  allocations.filter(a => a.user_id === userId && isWFH(a.leave_type) === remote).forEach(a => { entry(a.leave_type).allocated += Number(a.total_days); });
  requests.filter(r => r.user_id === userId && isWFH(r.request_type) === remote).forEach(r => {
    const row = entry(r.request_type);
    if (r.status === 'Approved') row.approved += requestDays(r);
    if (r.status === 'Pending') row.pending += requestDays(r);
  });
  return [...balances.values()].map(row => ({ ...row, available: Math.max(0, row.allocated - row.approved - row.pending) }));
}
