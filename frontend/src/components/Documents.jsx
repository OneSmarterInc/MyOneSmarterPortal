import React, { useState } from 'react';
import RecommendationLetters from './RecommendationLetters';

export default function Documents({ admin = false }) {
  const [type, setType] = useState(null);
  if (type) return <div className="w-full min-w-0">
    <RecommendationLetters key={type} admin={admin} documentType={type} onBack={() => setType(null)} />
  </div>;
  return <div className="w-full min-w-0 max-w-6xl mx-auto">
    <header className="admin-page-heading"><div><h1>Documents</h1><p>{admin ? 'Review requests and issue signed letters.' : 'Request an official letter and track its progress.'}</p></div></header>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {[
        ['recommendation', 'Letter of Recommendation', 'A recommendation covering responsibilities, achievements, and professional strengths.'],
        ['attendance', 'Attendance Consideration Letter', 'Confirmation of role, joining date, employment period, and working hours of 1:00 PM–9:00 PM.'],
      ].map(([id, title, description]) => <section className="admin-panel p-6" key={id}>
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-sm text-slate-500 mb-5">{description}</p>
        <button type="button" className="admin-button primary" onClick={() => setType(id)}>Open {title.toLowerCase()}</button>
      </section>)}
    </div>
  </div>;
}
