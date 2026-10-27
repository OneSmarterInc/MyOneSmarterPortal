import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

function DialogCard({ message, title, confirm, destructive, finish }) {
  const yesRef = useRef(null);
  useEffect(() => { yesRef.current?.focus(); }, []);
  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={e => { if (e.target === e.currentTarget) finish(false); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); finish(false); } }}>
      <div className="mb-5 flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${destructive ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-red-600'}`} aria-hidden="true">!</div>
        <div><h2 className="text-lg font-semibold text-zinc-900">{title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{message}</p></div>
      </div>
      <div className="flex justify-end gap-3">
        {confirm && <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-slate-50" onClick={() => finish(false)}>Cancel</button>}
        <button ref={yesRef} type="button" className="rounded-lg bg-[#c7192d] px-5 py-2 text-sm font-semibold text-white hover:bg-[#9f1325]" onClick={() => finish(true)}>{confirm ? (destructive ? 'Delete / confirm' : 'Confirm') : 'OK'}</button>
      </div>
    </div>
  </div>;
}

function showDialog(message, { confirm = false, title = confirm ? 'Please confirm' : 'Notice', destructive = false } = {}) {
  return new Promise(resolve => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const previous = document.activeElement;
    let completed = false;
    const finish = accepted => {
      if (completed) return;
      completed = true;
      root.unmount();
      host.remove();
      previous?.focus?.();
      resolve(accepted);
    };
    root.render(<DialogCard message={String(message)} title={title} confirm={confirm} destructive={destructive} finish={finish} />);
  });
}

export const portalAlert = (message, title = 'Notice') => showDialog(message, { title });
export const portalConfirm = (message, destructive = false) => showDialog(message, { confirm: true, destructive });
