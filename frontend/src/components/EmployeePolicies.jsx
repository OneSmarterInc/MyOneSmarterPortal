import React, { useEffect, useRef, useState } from 'react';
import API from '../services/api';
import { Icon } from './AdminUI';
import './EmployeePolicies.css';

function authConfig() {
  let token = '';
  try { token = JSON.parse(localStorage.getItem('user') || '{}').letter_token || ''; } catch {}
  return { headers: { Authorization: `Bearer ${token}` } };
}

export default function EmployeePolicies() {
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    API.get('my-policies/', authConfig()).then(({ data }) => {
      if (!active) return;
      setDocuments(data); setSelected(data[0] || null);
    }).catch(() => { if (active) setError('Unable to load the documents. Please refresh, or sign in again if your session has expired.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const visible = documents.filter(doc => (filter === 'All' || doc.type === filter) && doc.title.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="policies-page">
    <header className="policies-heading"><div><h1>Policies &amp; Procedures</h1><p>Your reference for company policies and working procedures.</p></div><span className="policies-internal"><Icon name="mail"/>Internal documents</span></header>
    {error ? <div className="policies-error" role="alert">{error}<button className="admin-button" onClick={() => setRetry(retry + 1)}>Try again</button></div> : <div className="policies-layout">
      <aside className="policies-library"><div className="policies-library-heading"><h2>Document library</h2><span>{documents.length}</span></div>
        <div className="policies-search"><input type="search" aria-label="Search policies and procedures" placeholder="Search documents…" value={query} onChange={event => setQuery(event.target.value)}/></div>
        <div className="policies-filters" aria-label="Document category">{[['All', 'All'], ['Policy', 'Policies'], ['Procedure', 'Procedures']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <nav className="policies-document-list" aria-label="Policies and procedures">{loading ? <p className="policies-empty" role="status">Loading documents…</p> : visible.map(doc => <button className="policies-document" key={doc.id} aria-current={selected?.id === doc.id ? 'page' : undefined} onClick={() => setSelected(doc)}><span className="policies-document-icon"><Icon name="mail"/></span><span><strong>{doc.title}</strong><small>{doc.type} · Word document</small></span></button>)}{!loading && !visible.length && <p className="policies-empty">No documents match your search.</p>}</nav>
      </aside>
      {selected ? <PolicyReader key={selected.id} document={selected}/> : <section className="policies-reader"><p className="policies-empty">{loading ? 'Loading your library…' : 'Select a document to start reading.'}</p></section>}
    </div>}
  </div>;
}

function PolicyReader({ document: doc }) {
  const frame = useRef(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState('fit');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setFile(null);
    async function load() {
      try {
        const response = await API.get('my-policies/', { ...authConfig(), params: { id: doc.id }, responseType: 'blob' });
        if (!active) return;
        setFile(response.data);
        const { renderAsync } = await import('docx-preview');
        if (!active) return;
        const target = frame.current.contentDocument;
        target.head.replaceChildren(); target.body.replaceChildren();
        const style = target.createElement('style');
        style.textContent = 'html,body{margin:0;padding:0} .docx-wrapper{padding:16px!important;background:#f4f5f7!important} .docx-wrapper>section{margin-bottom:16px!important;box-shadow:0 1px 5px #0001!important}';
        await renderAsync(response.data, target.body, target.head, { renderAltChunks: false, useBase64URL: true, ignoreLastRenderedPageBreak: false });
        if (!active) return;
        target.head.append(style);
        target.querySelectorAll('a[href]').forEach(link => {
          if (!link.getAttribute('href').startsWith('#')) link.removeAttribute('href');
        });
        setLoading(false);
      } catch { if (active) { setLoading(false); setError('The preview could not be loaded. Try again or download the original document.'); } }
    }
    load();
    return () => { active = false; };
  }, [doc.id, attempt]);
  useEffect(() => {
    const iframe = frame.current;
    if (!iframe || loading) return;
    const resize = () => {
      const body = iframe.contentDocument?.body;
      if (!body) return;
      const page = body.querySelector('section.docx');
      const width = page?.offsetWidth || 794;
      body.style.zoom = zoom === 'fit' ? Math.min(1, iframe.clientWidth / (width + 32)) : Number(zoom);
    };
    const observer = new ResizeObserver(resize); observer.observe(iframe); resize();
    return () => observer.disconnect();
  }, [loading, zoom]);
  function download() {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = window.document.createElement('a'); link.href = url; link.download = doc.filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="policies-reader" aria-label="Document reader">
    <header className="policies-reader-heading"><div><span className="policies-kind">{doc.type}</span><h2>{doc.title}</h2><p>Original company document</p></div><button className="admin-button primary" disabled={!file} onClick={download}>Download original</button></header>
    <div className="policies-reader-toolbar"><span>Read the document below</span><label>Zoom <select value={zoom} onChange={event => setZoom(event.target.value)}><option value="fit">Fit width</option><option value="1">100%</option><option value="1.25">125%</option></select></label></div>
    {loading && <p className="policies-empty" role="status">Preparing document…</p>}
    {error && <div className="policies-error" role="alert">{error}<button className="admin-button" onClick={() => setAttempt(attempt + 1)}>Retry preview</button></div>}
    <iframe ref={frame} title={`${doc.title} preview`} sandbox="allow-same-origin" className={`policies-preview ${loading || error ? 'policies-preview-hidden' : ''}`}/>
    <p className="policies-reader-note">The original Word file preserves the complete content and formatting. Browser pagination may differ.</p>
  </section>;
}
