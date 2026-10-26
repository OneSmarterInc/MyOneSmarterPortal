import React from 'react';

export default function AttendanceTimeInput({ label, value, onChange }) {
  const fieldClass = 'min-w-0 border border-slate-300 p-2 text-xs outline-none focus:border-red-500 rounded bg-white';
  const options = (count, start = 0) => Array.from({ length: count }, (_, i) => {
    const number = String(i + start).padStart(2, '0');
    return <option key={number} value={number}>{number}</option>;
  });

  return (
    <fieldset>
      <legend className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">{label}</legend>
      <div className="grid grid-cols-4 gap-1">
        <select aria-label={`${label} hour`} value={value.hour} onChange={e => onChange({ ...value, hour: e.target.value })} className={fieldClass}>
          <option value="">--</option>
          {options(12, 1)}
        </select>
        <select aria-label={`${label} minute`} value={value.minute} onChange={e => onChange({ ...value, minute: e.target.value })} className={fieldClass}>{options(60)}</select>
        <select aria-label={`${label} second`} value={value.second} onChange={e => onChange({ ...value, second: e.target.value })} className={fieldClass}>{options(60)}</select>
        <select aria-label={`${label} AM or PM`} value={value.period} onChange={e => onChange({ ...value, period: e.target.value })} className={fieldClass}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </fieldset>
  );
}
