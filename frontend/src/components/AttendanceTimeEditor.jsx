import React, { useEffect, useRef, useState } from 'react';
import AttendanceTimeInput from './AttendanceTimeInput';
import { toTimeParts, toApiTime } from '../utils/attendanceTime';
import { editAttendanceTimes } from '../services/attendanceClock';

export default function AttendanceTimeEditor({ record, name, onSaved, disabled = false }) {
  const [editing, setEditing] = useState(null);
  return <><button type="button" className="admin-button" disabled={disabled} onClick={() => setEditing({ ...record })}>Edit times</button>{editing && <TimeDialog record={editing} name={name} onSaved={onSaved} close={() => setEditing(null)}/>}</>;
}

function TimeDialog({ record, name, onSaved, close }) {
  const dialog = useRef(null);
  const [checkIn, setCheckIn] = useState(() => toTimeParts(record.check_in));
  const [checkOut, setCheckOut] = useState(() => toTimeParts(record.check_out));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => { const node = dialog.current; node.showModal(); return () => node.close(); }, []);
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const start = toApiTime(checkIn), end = toApiTime(checkOut);
    if (!start) { setError('Select a check-in time.'); return; }
    if (end && end < start) { setError('Check-out cannot be earlier than check-in.'); return; }
    lock.current = true; setSaving(true); setError('');
    try {
      const response = await editAttendanceTimes(record.id, { check_in: start, check_out: end, expected_check_in: record.check_in, expected_check_out: record.check_out });
      onSaved(response.data); close();
    } catch (err) { setError(err.response?.data?.error || 'Unable to save times. Please check your session and try again.'); }
    finally { lock.current = false; setSaving(false); }
  }
  return <dialog ref={dialog} aria-labelledby={`attendance-edit-${record.id}`} onCancel={event => { event.preventDefault(); if (!saving) close(); }} onClick={event => { if (event.target === dialog.current && !saving) close(); }} className="whitespace-normal text-left m-auto w-[calc(100%-32px)] max-w-lg rounded-xl border border-slate-200 p-0 shadow-xl backdrop:bg-slate-950/40">
    <form onSubmit={submit} className="p-6 space-y-5" onClick={event => event.stopPropagation()}>
      <header><h2 id={`attendance-edit-${record.id}`} className="text-xl font-semibold text-slate-900">Edit attendance times</h2><p className="mt-2 text-sm text-slate-500">{name || 'Team member'} · {record.date} · IST</p></header>
      {error && <p role="alert" className="admin-error">{error}</p>}
      <fieldset disabled={saving} className="space-y-4"><AttendanceTimeInput label="Check-in" value={checkIn} onChange={setCheckIn}/><AttendanceTimeInput label="Check-out" value={checkOut} onChange={setCheckOut}/><button type="button" className="admin-link" onClick={() => setCheckOut(toTimeParts(null))}>Clear check-out</button></fieldset>
      <p className="text-xs leading-5 text-slate-500">Times are in Indian Standard Time. Adding or removing a check-out sends the record back for review.</p>
      <footer className="flex justify-end gap-3"><button type="button" className="admin-button" disabled={saving} onClick={close}>Cancel</button><button type="submit" className="admin-button primary" disabled={saving}>{saving ? 'Saving…' : 'Save times'}</button></footer>
    </form>
  </dialog>;
}
