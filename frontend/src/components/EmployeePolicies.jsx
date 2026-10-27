import React, { useState } from 'react';
import { procedureGuides } from './procedureGuides';

const policy = {
  title: 'Information Security Policy',
  summary: 'The governing company-wide policy for protecting confidentiality, integrity and availability of information assets.',
  type: 'Policy',
  version: '1.1',
  steps: [
    'Access control, employee responsibilities and acceptable use',
    'HR security, asset management and change management',
    'Data classification, confidentiality, privacy and retention',
    'Encryption, passwords, anti-malware and incident response',
    'Backup, disaster recovery, business continuity and risk management',
    'BYOD, network and environmental security, internal audit and information-security management'
  ]
};
const documents = [policy, ...procedureGuides];

export default function EmployeePolicies() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [expanded, setExpanded] = useState({});
  const visible = documents.filter(d =>
    (filter === 'All' || d.type === filter) &&
    [d.title, d.summary, ...d.steps].join(' ').toLowerCase().includes(search.trim().toLowerCase())
  );
  return <div className="w-full max-w-5xl space-y-5">
    <header className="admin-page-heading"><div><h1>My Policies</h1><p>One Smarter, Inc. · Internal policies and procedures · Version 1.1</p></div></header>
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div>
        <p className="text-xs font-semibold uppercase tracking-wider text-red-700">Internal company guidance</p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-900">Policies &amp; Procedures</h2>
        <p className="mt-2 text-sm text-slate-600">1 information security policy and 21 supporting procedures from the supplied company folder.</p>
      </div><span className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">22 documents</span></div>
      <p className="mt-4 text-sm leading-6 text-slate-700">Explore the purpose and main procedural steps of each document. These are structured reading guides, not verbatim copies of the approved documents. Follow the complete signed policy and any applicable client requirements where additional detail is needed.</p>
      <p className="mt-2 text-xs text-slate-500">The source documents are classified Internal. Please do not redistribute without permission.</p>
    </section>
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap gap-3">
      <input type="search" aria-label="Search policies and procedures" placeholder="Search policies and procedures..." value={search} onChange={e=>setSearch(e.target.value)} className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
      <select aria-label="Filter documents" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option>All</option><option>Policy</option><option>Procedure</option></select>
    </div>
    <p className="text-sm text-slate-500">{visible.length} documents</p>
    <div className="space-y-3">{visible.map((doc) => {
      const open = Boolean(expanded[doc.title]);
      return <section key={doc.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <button type="button" aria-expanded={open} onClick={()=>setExpanded(prev=>({...prev,[doc.title]:!prev[doc.title]}))} className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-slate-50">
          <span><strong className="block text-sm font-semibold text-zinc-900">{doc.title}</strong><small className="mt-1 block text-xs text-slate-500">{doc.type} · Version {doc.version}</small></span>
          <span className="text-lg text-red-700" aria-hidden="true">{open ? '−':'+'}</span>
        </button>
        {open && <div className="border-t border-slate-100 px-5 py-4 space-y-3">
          <p className="text-sm leading-6 text-slate-700">{doc.summary}</p>
          <h3 className="text-sm font-semibold text-zinc-900">Key requirements and steps</h3>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">{doc.steps.map(step=><li key={step}>{step}</li>)}</ol>
        </div>}
      </section>;
    })}</div>
    {!visible.length && <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">No matching documents.</p>}
    <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
      <strong className="text-zinc-900">Need to report a security concern?</strong>
      <p className="mt-1">Notify your manager or security team, or email <a className="text-red-700 underline" href="mailto:Incidents@Onesmarter.com">Incidents@Onesmarter.com</a>.</p>
    </div>
  </div>;
}
