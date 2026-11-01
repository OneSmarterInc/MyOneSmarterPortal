import React, { useEffect, useRef } from 'react';
export default function ManagerDialog({ title, onClose, busy = false, children }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; if (!dialog.open) dialog.showModal(); }, []);
  return <dialog ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} className="manager-detail-dialog rounded-xl border border-slate-200 p-0 backdrop:bg-black/40">
    <header className="flex items-center justify-between gap-4 p-5 border-b border-slate-200"><h2 className="text-lg font-semibold">{title}</h2><button type="button" className="admin-button" disabled={busy} onClick={onClose}>Close</button></header>
    <div className="p-5 space-y-5">{children}</div>
  </dialog>;
}
