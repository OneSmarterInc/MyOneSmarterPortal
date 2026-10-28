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
  const [search, setSearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 10;
  const [fileCheck, setFileCheck] = useState(null);

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
    setSelected(item); setError(''); setNotice(''); setPreview(''); setDirty(false); setReason(''); setFileCheck(null);
    setForm({ ...Object.fromEntries(fields.map(([key]) => [key, ''])), designation: item.designation || '', recommendation_purpose: item.purpose, ...item.draft, end_date: item.draft?.end_date || '' });
  }
  async function pdf(item) { const { data } = await getRecommendationPDF(item.id); setPreview(URL.createObjectURL(data)); }
  async function downloadLetter(item) {
    setBusy(true); setError('');
    try {
      const { data } = await getRecommendationPDF(item.id);
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OneSmarter_Recommendation_${item.id}_signed.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
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
    setBusy(true); setError(''); setPreview('');
    try {
      const { data } = await sendRecommendation(selected.id, selected.revision);
      replace(data); setNotice(`Signed letter sent to ${data.sent_to}.`);
      try { await pdf(data); } catch { setError('The letter was sent, but its signed preview could not load. Open the saved letter again to download it.'); }
    }
    catch (e) { setPreview(''); setError(errorMessage(e)); try { const { data } = await getRecommendations(); setItems(data); setSelected(data.find(item => item.id === selected.id)); } catch {} }
    finally { setBusy(false); }
  }
  async function checkFile(event) {
    const file = event.target.files?.[0];
    setFileCheck(null);
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setFileCheck({ id: selected.id, message: 'Choose a PDF smaller than 20 MB.' }); return; }
    setBusy(true);
    try {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      const matches = hash === selected.pdf_sha256;
      setFileCheck({ id: selected.id, matches, message: matches
        ? 'Exact match: this file is identical to the signed original stored for this letter.'
        : 'Different file: this does not match the stored signed original. Review the original before confirming the background check.' });
    } catch { setFileCheck({ id: selected.id, message: 'Unable to compare this file. Download the stored original and compare it manually.' }); }
    finally { setBusy(false); }
  }
  async function reject() {
    setBusy(true); setError('');
    try { const { data } = await rejectRecommendation(selected.id, reason); replace(data); setPreview(''); setNotice('Request rejected. The reason is visible to the requester.'); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  const editable = selected && ['Pending', 'Draft', 'Send failed'].includes(selected.status);
  const openItems = items.filter(item => !['Sent', 'Rejected'].includes(item.status));
  const sentItems = items.filter(item => item.status === 'Sent');
  const query = search.trim().toLowerCase();
  const scope = admin ? (filter === 'open' ? openItems : filter === 'sent' ? sentItems : items) : items;
  const visible = scope.filter(item =>
    !admin || !query || [
      item.name, item.issued_name, item.verification_id, item.purpose,
      item.status, item.sent_to, item.email,
      item.created_at ? new Date(item.created_at).toLocaleDateString() : '',
      item.sent_at ? new Date(item.sent_at).toLocaleDateString() : ''
    ].some(value => String(value || '').toLowerCase().includes(query))
  ).sort((a,b) => new Date(b.sent_at || b.created_at || 0) - new Date(a.sent_at || a.created_at || 0));
  const totalHistoryPages = Math.max(1, Math.ceil(visible.length / historyPageSize));
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
  const firstHistoryRecord = (safeHistoryPage - 1) * historyPageSize;
  const pageRecords = visible.slice(firstHistoryRecord, firstHistoryRecord + historyPageSize);
  return <div className="lor-page w-full min-w-0 max-w-6xl">
    <header className="admin-page-heading"><div><h1>Recommendation letters</h1><p>{admin ? 'Review requests, prepare a letter, and approve it for email delivery.' : 'Request a letter of recommendation and follow its progress.'}</p></div><button className="admin-button" disabled={busy || loading} onClick={load}>Refresh</button></header>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {notice && <div className="admin-notice" role="status">{notice}</div>}
    {!admin && <form className="admin-panel lor-form" onSubmit={submit}><h2>Request a recommendation</h2><label>What will you use the letter for?<input required maxLength={500} value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Graduate program or job application" /></label><label>Additional details (optional)<textarea maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Mention relevant projects or the application deadline." /></label><p>Your name and joining date will be taken from your account. The approved letter will be emailed to your account email address.</p><button className="admin-button primary" disabled={busy || loading || !!error || openItems.length > 0}>{busy ? 'Submitting…' : 'Submit request'}</button>{openItems.length > 0 && <p>You already have a request under review.</p>}</form>}
    <section className="admin-panel">
      {admin && <div className="admin-tabs">
        <button aria-pressed={filter === 'open'} onClick={() => { setFilter('open'); setHistoryPage(1); }}>Open requests ({openItems.length})</button>
        <button aria-pressed={filter === 'sent'} onClick={() => { setFilter('sent'); setHistoryPage(1); }}>Sent history ({sentItems.length})</button>
        <button aria-pressed={filter === 'all'} onClick={() => { setFilter('all'); setHistoryPage(1); }}>All requests ({items.length})</button>
      </div>}
      {admin && <div className="lor-search"><label htmlFor="lor-search">Search recommendation letters</label><input id="lor-search" type="search" value={search} onChange={e => { setSearch(e.target.value); setHistoryPage(1); }} placeholder="Search name, purpose, status, date or verification ID" /></div>}
      <div className="admin-table-scroll"><table className="admin-table lor-history-table"><thead><tr>{admin && <th>Team member</th>}<th>Purpose</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead><tbody>{pageRecords.map(item => <tr key={item.id}>{admin && <td>{item.name}</td>}<td className="lor-purpose">{item.purpose}{item.rejection_reason && <p>Reason: {item.rejection_reason}</p>}</td><td>{new Date(item.created_at).toLocaleDateString()}</td><td><span className={`lor-status lor-status-${item.status.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{item.status}</span></td><td>{admin ? <button className="admin-button" disabled={busy} onClick={() => open(item)}>Open request</button> : item.can_download ? <div className="lor-row-actions"><button className="admin-button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { open(item); await pdf(item); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }}>View letter</button><button type="button" className="admin-button" disabled={busy} onClick={() => downloadLetter(item)}>Download letter</button></div> : 'Under review'}</td></tr>)}</tbody></table></div>{loading ? <p className="admin-empty">Loading requests…</p> : !visible.length && <p className="admin-empty">No requests match the selected view or search.</p>}
      <div className="lor-history-pagination">
        <span role="status">Showing {visible.length ? firstHistoryRecord + 1 : 0}–{Math.min(firstHistoryRecord + historyPageSize, visible.length)} of {visible.length} records</span>
        <nav aria-label="Recommendation letters pagination" className="lor-history-pagination-controls">
          <button type="button" className="admin-button" disabled={safeHistoryPage <= 1} onClick={() => setHistoryPage(p => Math.max(1, p - 1))}>Previous</button>
          <span>Page {safeHistoryPage} of {totalHistoryPages}</span>
          <button type="button" className="admin-button" disabled={safeHistoryPage >= totalHistoryPages} onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}>Next</button>
        </nav>
      </div>
    </section>
    {selected && <section className="admin-panel lor-form"><div className="lor-section-heading"><h2>{admin ? `Letter for ${selected.name}` : 'Your recommendation letter'}</h2><button className="admin-button" disabled={busy} onClick={() => { setSelected(null); setPreview(''); }}>Close</button></div>
      {selected.verification_id && <p><strong>Verification ID:</strong> <code>{selected.verification_id}</code></p>}
      {admin && selected.status === 'Sent' && <section className="lor-verification">
        <h2>Background-check verification</h2>
        <p><strong>Issued to:</strong> {selected.issued_name || selected.name}<br/><strong>Sent:</strong> {selected.sent_at ? new Date(selected.sent_at).toLocaleString() : 'Not recorded'}</p>
        {!selected.verification_id && <p>This older letter has no verification ID. Compare against its stored original.</p>}
        {selected.pdf_sha256 && <><p><strong>Original PDF SHA-256:</strong><br/><code>{selected.pdf_sha256}</code></p>
          <label>Compare the PDF supplied for verification<input key={selected.id} type="file" accept="application/pdf,.pdf" disabled={busy} onChange={checkFile} /></label>
          <p>The file is checked in your browser and is not uploaded. An ID match alone does not confirm the PDF is unchanged.</p>
          {fileCheck?.id === selected.id && <p role="status" className={fileCheck.matches ? 'lor-match' : ''}>{fileCheck.message}</p>}
        </>}
      </section>}
      {admin && <><p><strong>Account name:</strong> {selected.name}<br/><strong>Joining date:</strong> {selected.joining_date || 'Missing - update the account first'}<br/><strong>Recipient:</strong> {selected.email || 'Missing email'}</p>{selected.notes && <p><strong>Requester’s notes:</strong> {selected.notes}</p>}
      {editable ? <form onSubmit={save}><fieldset disabled={busy} className="lor-fields">{fields.map(([key, label, max]) => <label key={key}>{label}{max <= 120 ? <input aria-label={label} required maxLength={max} value={form[key] || ''} onChange={e => { setForm({ ...form, [key]: e.target.value }); setDirty(true); setPreview(''); }} /> : <textarea aria-label={label} required maxLength={max} value={form[key] || ''} onChange={e => { setForm({ ...form, [key]: e.target.value }); setDirty(true); setPreview(''); }} />}</label>)}<label>End date (leave blank if still working)<input type="date" min={selected.joining_date || undefined} value={form.end_date || ''} onChange={e => { setForm({ ...form, end_date: e.target.value }); setDirty(true); setPreview(''); }} /></label></fieldset><p>Ongoing employment is described as continuing as of the letter’s issue date.</p><p><strong>Signatory:</strong> Akshay Agrawal · Global Delivery Manager<br/><strong>Official contact:</strong> akshay.kumar@onesmarter.com</p><button className="admin-button primary" disabled={busy || !selected.joining_date}>{busy ? 'Working…' : 'Save & preview'}</button></form> : <p>Status: {selected.status}{selected.sent_to ? ` · Sent to ${selected.sent_to}` : ''}</p>}
      {selected.revision > 0 && !dirty && !preview && <button className="admin-button" disabled={busy} onClick={async () => { setBusy(true); try { await pdf(selected); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }}>Preview saved letter</button>}
      </>}
      {preview && <div className="lor-preview"><div className="lor-section-heading"><h2>{selected.status === 'Sent' ? 'Signed letter' : 'Letter preview'}</h2><a className="admin-button" href={preview} target="_blank" rel="noreferrer">Open PDF</a><a className="admin-button" href={preview} download={`OneSmarter_Recommendation_${selected.id}${selected.status === 'Sent' ? '_signed' : '_preview'}.pdf`}>Download PDF</a></div><iframe title="Recommendation letter preview" src={preview} />
      {admin && editable && !dirty && <><p>Approval adds the digital signature and emails the signed PDF to <strong>{selected.email}</strong>.</p>{selected.status === 'Send failed' && <p>Check the recipient inbox before retrying; an earlier delivery may have succeeded.</p>}<button className="admin-button primary" disabled={busy} onClick={approve}>{busy ? 'Sending…' : selected.status === 'Send failed' ? 'Retry email delivery' : 'Approve & send'}</button></>}
      </div>}
      {admin && editable && <div className="lor-reject"><label>Reason for rejection<input maxLength={500} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label><button className="admin-button danger" disabled={busy || !reason.trim()} onClick={reject}>Reject request</button></div>}
    </section>}
  </div>;
}

