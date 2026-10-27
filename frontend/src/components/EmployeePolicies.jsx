import React, { useEffect, useState } from 'react';
import API from '../services/api';

const authorization = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.letter_token ? { Authorization: `Bearer ${user.letter_token}` } : {};
  } catch { return {}; }
};

export default function EmployeePolicies() {
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    API.get('my-policies/', { headers: authorization() })
      .then(result => { if (active) setDocuments(result.data); })
      .catch(e => { if (active) setError(e.response?.data?.error || 'Could not load internal policies. Sign in again if your session has expired.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  const openDocument = async id => {
    setLoadingDocument(true);
    setError('');
    try {
      const result = await API.get('my-policies/', { params: { id }, headers: authorization() });
      setSelected(result.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Unable to open this policy.');
    } finally {
      setLoadingDocument(false);
    }
  };

  const visible = documents.filter(item => item.title.toLowerCase().includes(query.toLowerCase()));
  return <div className="w-full max-w-6xl space-y-5">
    <header className="admin-page-heading"><div><h1>My Policies</h1><p>One Smarter, Inc. · Internal Policies &amp; Procedures</p></div></header>
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-zinc-900">Company policies &amp; procedures</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Read the complete internal documents with all available paragraphs, headings, and tables. These materials are intended for authorized employees only.</p>
    </section>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-200 bg-white p-3 lg:self-start">
        <input type="search" aria-label="Search policies" placeholder="Search policies..." value={query} onChange={e => setQuery(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
        {busy ? <p className="p-3 text-sm text-slate-500">Loading policies…</p> : <nav aria-label="Available policy documents" className="max-h-[70vh] space-y-1 overflow-auto">
          {visible.map(item => <button type="button" key={item.id} onClick={() => openDocument(item.id)}
            aria-current={selected?.id === item.id ? 'page' : undefined}
            className={`w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-red-50 ${selected?.id === item.id ? 'bg-red-50 text-red-800' : 'text-zinc-700'}`}>
            <strong className="block font-medium">{item.title}</strong><small className="text-slate-500">{item.type}</small>
          </button>)}
        </nav>}
      </aside>
      <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
        {loadingDocument ? <p className="text-sm text-slate-500">Loading full document…</p> : !selected ? <div className="py-14 text-center text-sm text-slate-500">Select a policy or procedure to read its full content.</div> : <>
          <div className="border-b border-slate-200 pb-5">
            <p className="text-xs font-bold uppercase tracking-wider text-red-700">Internal · {selected.type}</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900">{selected.title}</h2>
          </div>
          <div className="mt-6 space-y-4 text-sm leading-7 text-zinc-800">
            {selected.blocks.map((block, i) => block.type === 'table' ?
              <div className="overflow-x-auto" key={i}><table className="w-full border-collapse text-left text-xs">
                <tbody>{block.rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="border border-slate-200 p-2 align-top whitespace-pre-wrap">{cell}</td>)}</tr>)}</tbody>
              </table></div> :
              <p key={i} className={`whitespace-pre-wrap break-words ${/heading|title/i.test(block.style) ? 'text-base font-bold text-zinc-900' : ''}`}>{block.text}</p>
            )}
          </div>
        </>}
      </article>
    </div>
  </div>;
}
