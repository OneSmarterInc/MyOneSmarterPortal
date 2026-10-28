import React, { useState } from 'react';
import { procedureGuides } from './procedureGuides';

// Bundled frontend reference cards. No server endpoint or private-policy installation required.
const documents = [{
  title: 'Information Security Policy',
  type: 'Policy',
  version: '1.1',
  summary: 'The governing One Smarter information security policy describes the framework for protecting confidentiality, integrity and availability.',
  steps: [
    'Purpose, scope, security objectives and user responsibilities',
    'Access control, HR security, assets, change management and acceptable use',
    'Data classification, communication, code of conduct, encryption and confidentiality',
    'Backups, incident response, logging, physical security, passwords and risk management',
    'Software development, vendors, malware, patching, configuration and cloud security',
    'Data protection, continuity, auditing, ISMS, BYOD, network and environmental controls'
  ]
}, ...procedureGuides];

export default function EmployeePolicies() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const visible = documents.filter(doc => [doc.title, doc.summary, ...doc.steps].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="w-full min-w-0 max-w-6xl space-y-5">
    <header className="admin-page-heading"><div><h1>My Policies</h1><p>One Smarter, Inc. · Internal Policies &amp; Procedures · Version 1.1</p></div></header>
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Company policies &amp; procedures</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Browse all {documents.length} policies and procedures directly in your employee workspace.</p>
      <p className="mt-2 text-xs text-amber-800">These are reference guides, not the complete original documents. They are internal materials and should not be redistributed.</p>
    </section>
    <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-200 bg-white p-3 xl:self-start">
        <input type="search" aria-label="Search policies" placeholder="Search policies..." value={query} onChange={e=>setQuery(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <nav aria-label="Available policies" className="max-h-[35vh] xl:max-h-[70vh] space-y-1 overflow-auto">
          {visible.map(doc=><button type="button" key={doc.title} aria-current={selected?.title===doc.title?'page':undefined} onClick={()=>setSelected(doc)} className={`w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-red-50 ${selected?.title===doc.title?'bg-red-50 text-red-800':'text-zinc-700'}`}>
            <strong className="block font-medium">{doc.title}</strong><small className="text-slate-500">{doc.type}</small>
          </button>)}
          {!visible.length && <p className="p-3 text-sm text-slate-500">No matching policies.</p>}
        </nav>
      </aside>
      <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
        {!selected?<div className="py-14 text-center text-sm text-slate-500">Select a policy to read its guidance.</div>:<>
          <p className="text-xs font-semibold uppercase tracking-widest text-red-700">Internal · {selected.type}</p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-900">{selected.title}</h2>
          <p className="mt-4 text-sm leading-7 text-slate-700">{selected.summary}</p>
          <h3 className="mt-6 text-sm font-semibold text-zinc-900">Key sections and requirements</h3>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-7 text-zinc-700">{selected.steps.map((step,i)=><li key={i}>{step}</li>)}</ol>
        </>}
      </article>
    </div>
  </div>;
}
