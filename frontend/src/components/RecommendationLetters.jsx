import React, { useEffect, useState } from 'react';
import { getRecommendations, requestRecommendation, saveRecommendation, getRecommendationPDF, sendRecommendation, rejectRecommendation } from '../services/api';
import './RecommendationLetters.css';

const fields = [
  ['designation', 'Designation / internship role', 120], ['department', 'Team / department', 120],
  ['responsibilities', 'Projects and responsibilities', 700], ['achievement', 'Specific achievement and verified outcome', 700],
  ['capability', 'Capability demonstrated', 300], ['strengths', 'Observed strengths', 300],
  ['example', 'Example of teamwork, initiative, or reliability', 700], ['recommendation_purpose', 'Recommended opportunity / purpose', 500],
  ['endorsement', 'Closing recommendation', 700],
];
const errorMessage = error => {
  const data = error.response?.data;
  if (error.response?.status === 401) return 'Please sign out and sign in again to access recommendation letters.';
  if (data && typeof data === 'object' && !(data instanceof Blob)) {
    if (typeof data.error === 'string') return data.error;
    if (typeof data.detail === 'string') return data.detail;
    const messages = Object.entries(data).filter(([, value]) => typeof value === 'string' || Array.isArray(value))
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
    if (messages.length) return messages.join(' · ');
  }
  if (error.response?.status >= 500) return 'The server could not complete this request. Your entered details are still here. Please try again, or contact your administrator if the problem continues.';
  return 'Unable to complete the request. Please check your connection and try again.';
};

export default function RecommendationLetters({ admin = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState('');
  const [reason, setReason] = useState('');
  const [filter, setFilter] = useState('open');

  useEffect(() => { load(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function load() {
    setLoading(true); setError('');
    try { const { data } = await getRecommendations(); setItems(data); }
    catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }
  function replace(item) { setItems(list => list.map(old => old.id === item.id ? item : old)); setSelected(item); }
  function open(item) {
    setSelected(item); setError(''); setNotice(''); setPreview(''); setDirty(false); setReason('');
    setForm({ ...Object.fromEntries(fields.map(([key]) => [key, ''])), designation: item.designation || '', recommendation_purpose: item.purpose, ...item.draft, end_date: item.draft?.end_date || '' });
  }
  async function pdf(item) { const { data } = await getRecommendationPDF(item.id); setPreview(URL.createObjectURL(data)); }
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const { data } = await requestRecommendation({ purpose, notes }); setItems(list => [data, ...list]); setPurpose(''); setNotes(''); setNotice('Your request has been submitted for administrator review.'); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError(''); setPreview('');
    try { const { data } = await saveRecommendation(selected.id, { ...Object.fromEntries(fields.map(([key]) => [key, form[key]])), end_date: form.end_date || null, revision: selected.revision }); replace(data); setDirty(false); await pdf(data); setNotice('Draft saved. Review the PDF before approving and sending.'); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function approve() {
    setBusy(true); setError('');
    try { const { data } = await sendRecommendation(selected.id, selected.revision); replace(data); setNotice(`Letter sent to ${data.sent_to}.`); }
    catch (e) { setPreview(''); setError(errorMessage(e)); try { const { data } = await getRecommendations(); setItems(data); setSelected(data.find(item => item.id === selected.id)); } catch {} }
    finally { setBusy(false); }
  }
  async function reject() {
    setBusy(true); setError('');
    try { const { data } = await rejectRecommendation(selected.id, reason); replace(data); setPreview(''); setNotice('Request rejected. The reason is visible to the requester.'); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  const editable = selected && ['Pending', 'Draft', 'Send failed'].includes(selected.status);
  const openItems = items.filter(item => !['Sent', 'Rejected'].includes(item.status));
  const visible = admin && filter === 'open' ? openItems : items;
  return <div className="lor-page w-full max-w-6xl">
    <header className="admin-page-heading"><div><h1>Recommendation letters</h1><p>{admin ? 'Review requests, prepare a letter, and approve it for email delivery.' : 'Request a letter of recommendation and follow its progress.'}</p></div><button className="admin-button" disabled={busy || loading} onClick={load}>Refresh</button></header>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {notice && <div className="admin-notice" role="status">{notice}</div>}
    {!admin && <form className="admin-panel lor-form" onSubmit={submit}><h2>Request a recommendation</h2><label>What will you use the letter for?<input required maxLength={500} value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Graduate program or job application" /></label><label>Additional details (optional)<textarea maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Mention relevant projects or the application deadline." /></label><p>Your name and joining date will be taken from your account. The approved letter will be emailed to your account email address.</p><button className="admin-button primary" disabled={busy || loading || !!error || openItems.length > 0}>{busy ? 'Submitting…' : 'Submit request'}</button>{openItems.length > 0 && <p>You already have a request under review.</p>}</form>}
    <section className="admin-panel">
      {admin && <div className="admin-tabs"><button aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>Open requests ({openItems.length})</button><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All requests</button></div>}
      <div className="admin-table-scroll"><table className="admin-table"><thead><tr>{admin && <th>Team member</th>}<th>Purpose</th><th>Requested</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map(item => <tr key={item.id}>{admin && <td>{item.name}</td>}<td className="lor-purpose">{item.purpose}{item.rejection_reason && <p>Reason: {item.rejection_reason}</p>}</td><td>{new Date(item.created_at).toLocaleDateString()}</td><td>{item.status}</td><td>{admin ? <button className="admin-button" disabled={busy} onClick={() => open(item)}>Open request</button> : item.can_download ? <button className="admin-button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { open(item); await pdf(item); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }}>View letter</button> : 'Under review'}</td></tr>)}</tbody></table></div>{loading ? <p className="admin-empty">Loading requests…</p> : !visible.length && <p className="admin-empty">No requests to show.</p>}
    </section>
    {selected && <section className="admin-panel lor-form"><div className="lor-section-heading"><h2>{admin ? `Letter for ${selected.name}` : 'Your recommendation letter'}</h2><button className="admin-button" disabled={busy} onClick={() => { setSelected(null); setPreview(''); }}>Close</button></div>
      {admin && <><p><strong>Account name:</strong> {selected.name}<br/><strong>Joining date:</strong> {selected.joining_date || 'Missing - update the account first'}<br/><strong>Recipient:</strong> {selected.email || 'Missing email'}</p>{selected.notes && <p><strong>Requester’s notes:</strong> {selected.notes}</p>}
      {editable ? <form onSubmit={save}><fieldset disabled={busy} className="lor-fields">{fields.map(([key, label, max]) => <label key={key}>{label}{max <= 120 ? <input aria-label={label} required maxLength={max} value={form[key] || ''} onChange={e => { setForm({ ...form, [key]: e.target.value }); setDirty(true); setPreview(''); }} /> : <textarea aria-label={label} required maxLength={max} value={form[key] || ''} onChange={e => { setForm({ ...form, [key]: e.target.value }); setDirty(true); setPreview(''); }} />}</label>)}<label>End date (leave blank if still working)<input type="date" min={selected.joining_date || undefined} value={form.end_date || ''} onChange={e => { setForm({ ...form, end_date: e.target.value }); setDirty(true); setPreview(''); }} /></label></fieldset><p>Ongoing employment is described as continuing as of the letter’s issue date.</p><p><strong>Signatory:</strong> Akshay Agrawal · Global Delivery Manager<br/><strong>Official contact:</strong> akshay.kumar@onesmarter.com</p><button className="admin-button primary" disabled={busy || !selected.joining_date}>{busy ? 'Working…' : 'Save & preview'}</button></form> : <p>Status: {selected.status}{selected.sent_to ? ` · Sent to ${selected.sent_to}` : ''}</p>}
      {selected.revision > 0 && !dirty && !preview && <button className="admin-button" disabled={busy} onClick={async () => { setBusy(true); try { await pdf(selected); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }}>Preview saved letter</button>}
      </>}
      {preview && <div className="lor-preview"><div className="lor-section-heading"><h2>Letter preview</h2><a className="admin-button" href={preview} target="_blank" rel="noreferrer">Open PDF</a><a className="admin-button" href={preview} download={`OneSmarter_Recommendation_${selected.id}.pdf`}>Download PDF</a></div><iframe title="Recommendation letter preview" src={preview} />
      {admin && editable && !dirty && <><p>Approval emails this exact PDF to <strong>{selected.email}</strong> with a formal message from One Smarter, Inc.</p>{selected.status === 'Send failed' && <p>Check the recipient inbox before retrying; an earlier delivery may have succeeded.</p>}<button className="admin-button primary" disabled={busy} onClick={approve}>{busy ? 'Sending…' : selected.status === 'Send failed' ? 'Retry email delivery' : 'Approve & send'}</button></>}
      </div>}
      {admin && editable && <div className="lor-reject"><label>Reason for rejection<input maxLength={500} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label><button className="admin-button danger" disabled={busy || !reason.trim()} onClick={reject}>Reject request</button></div>}
    </section>}
  </div>;
}
