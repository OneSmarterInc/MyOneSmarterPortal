import React, { useState } from 'react';

const groups = [
  {
    title: 'Account access & passwords', ref: 'Sections 6, 10.1 and 20',
    points: [
      'Use only your assigned account and authorized systems. Do not share passwords or let others use your credentials.',
      'Choose strong, unique passwords and change them if compromise is suspected. Use an IT-approved password manager where needed.',
      'Use multifactor authentication where required, and lock your screen whenever leaving your device unattended.'
    ]
  },
  {
    title: 'Email, communications & confidentiality', ref: 'Sections 10.2, 12 and 16',
    points: [
      'Use company email responsibly for business communications. Treat company messages and attachments as confidential.',
      'Do not respond to suspicious or unsolicited messages. Exercise caution with unfamiliar attachments and links.',
      'Share sensitive or customer information only with authorized people through approved, secure methods. Do not post proprietary material publicly.'
    ]
  },
  {
    title: 'Personal devices & remote work', ref: 'Sections 8.6, 10.3–10.8, 19 and 33–35',
    points: [
      'Keep operating systems, applications and security protection updated on devices used for work.',
      'Protect work devices with passwords or biometrics, automatic screen locking and appropriate physical safeguards.',
      'Store company information on personal devices only when permitted and necessary, with suitable encryption and secure deletion when no longer needed.',
      'Report lost or stolen devices and suspected compromise promptly. Follow client security requirements when connecting to client systems.'
    ]
  },
  {
    title: 'Data protection & privacy', ref: 'Sections 11, 16 and 29',
    points: [
      'Handle information according to its classification, including Confidential, Sensitive, Internal and Public.',
      'Access personal and confidential data only when your job requires it; do not disclose it to unauthorized parties, including friends or family.',
      'Use approved storage, transmission and disposal practices. Employee information is retained according to applicable business, legal and regulatory obligations.'
    ]
  },
  {
    title: 'Security incidents & reporting', ref: 'Sections 13.6, 17 and 34.6',
    points: [
      'Report suspicious activity, data disclosure, unauthorized access, malware alerts and lost devices immediately.',
      'Follow escalation and incident-response instructions from your manager and security team.',
      'The policy identifies Incidents@Onesmarter.com for reporting concerns; client-related network incidents may also require notification to client IT/security.'
    ]
  },
  {
    title: 'Workplace responsibilities & awareness', ref: 'Sections 7, 13, 24.6 and 34.8',
    points: [
      'Follow company conduct, confidentiality, information-security and client-specific requirements throughout employment.',
      'Take part in information-security awareness training at onboarding and annually thereafter.',
      'Handle company assets responsibly and return applicable company property when employment ends.'
    ]
  }
];

export default function EmployeePolicies() {
  const [expanded, setExpanded] = useState(groups.map((_, i) => i === 0));
  return (
    <div className="w-full max-w-5xl space-y-5">
      <header className="admin-page-heading">
        <div>
          <h1>Privacy &amp; Security Policies</h1>
          <p>One Smarter, Inc. · Information Security Policy · Version 1.1</p>
        </div>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wider text-red-700">Internal · Final version</p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-900">Employee security guide</h2>
            <p className="mt-1 text-sm text-slate-600">Issued 22 June 2026 · Document owner: Akshay Kumar</p></div>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Version 1.1</span>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-700">
          This guide highlights employee-facing duties from the company's Information Security Policy.
          It is a reading guide, not a replacement for the complete 93-page internal policy.
          When working with a client, also follow that client's applicable security controls.
        </p>
        <p className="mt-3 text-xs text-slate-500">Internal company information. Do not redistribute without authorization.</p>
      </section>
      <div className="space-y-3">
        {groups.map((group, index) => (
          <section key={group.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button type="button" aria-expanded={expanded[index]} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50" onClick={() => setExpanded(prev => prev.map((value, i) => i === index ? !value : value))}>
              <span><strong className="block text-sm font-semibold text-zinc-900">{group.title}</strong>
              <small className="mt-1 block text-xs text-slate-500">{group.ref}</small></span>
              <span aria-hidden="true" className="text-lg text-red-700">{expanded[index] ? '−' : '+'}</span>
            </button>
            {expanded[index] && <div className="border-t border-slate-100 px-5 py-4">
              <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                {group.points.map(point => <li key={point}>{point}</li>)}
              </ul>
            </div>}
          </section>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <strong className="block text-zinc-900">Questions or suspected incidents?</strong>
        <p className="mt-1">Contact your manager or security team. The policy also lists <a className="font-medium text-red-700 underline" href="mailto:Incidents@Onesmarter.com">Incidents@Onesmarter.com</a> for reporting concerns.</p>
      </div>
    </div>
  );
}
