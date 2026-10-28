import { updateAttendance } from './api';

// Shared across page mounts so navigating within the portal does not lose
// decisions the administrator has already queued.
let snapshot = {};
const listeners = new Set();
const pending = [];
let running = false;

export const subscribeReviews = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getReviews = () => snapshot;
export function clearSavedReviews() {
  if (running) return;
  snapshot = Object.fromEntries(Object.entries(snapshot).filter(([, job]) => job.state !== 'saved'));
  listeners.forEach(listener => listener());
}
const warnBeforeLeaving = event => { event.preventDefault(); event.returnValue = ''; };

function publish(id, value) {
  snapshot = { ...snapshot, [id]: value };
  listeners.forEach(listener => listener());
}

export function enqueueReview(record, status) {
  const current = snapshot[record.id];
  if (current && ['queued', 'saving'].includes(current.state)) return;
  publish(record.id, { state: 'queued', status, checkOut: record.check_out || null });
  pending.push({ id: record.id, status, checkOut: record.check_out || null });
  drain();
}

async function drain() {
  if (running) return;
  running = true;
  window.addEventListener('beforeunload', warnBeforeLeaving);
  try {
    while (pending.length) {
      const job = pending.shift();
      publish(job.id, { ...job, state: 'saving' });
      try {
        await updateAttendance(job.id, { status: job.status });
        publish(job.id, { ...job, state: 'saved' });
      } catch {
        publish(job.id, { ...job, state: 'failed' });
      }
    }
  } finally {
    running = false;
    window.removeEventListener('beforeunload', warnBeforeLeaving);
  }
}
