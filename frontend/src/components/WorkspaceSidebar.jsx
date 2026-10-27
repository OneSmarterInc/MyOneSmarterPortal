import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './AdminUI';

export default function WorkspaceSidebar({ items, activeTab, onNavigate, title }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    const toggle = () => { trigger.current = document.activeElement; setOpen(value => !value); };
    window.addEventListener('toggleMobileMenu', toggle);
    return () => window.removeEventListener('toggleMobileMenu', toggle);
  }, []);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('adminMenuState', { detail: open }));
    const element = dialog.current;
    if (open && !element.open) element.showModal();
    if (!open && element.open) { element.close(); trigger.current?.focus(); }
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const media = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (media.matches) setOpen(false); };
    media.addEventListener('change', closeOnDesktop);
    return () => { document.body.style.overflow = previous; media.removeEventListener('change', closeOnDesktop); };
  }, [open]);
  const content = <>
    <div className="workspace-side-title"><span className="workspace-monogram">1S</span><div><strong>OneSmarter</strong><small>People. Connected.</small></div></div>
    <p className="workspace-nav-label">{title}</p>
    <nav aria-label={title}>{items.map((item) => <React.Fragment key={item.id}>
      {item.section && <p className="workspace-nav-section">{item.section}</p>}
      <button type="button" aria-current={activeTab === item.id ? 'page' : undefined} onClick={() => { onNavigate(item.id); setOpen(false); }}><Icon name={item.icon}/><span>{item.label}</span>{activeTab === item.id && <span className="workspace-active-dot"/>}</button>
    </React.Fragment>)}</nav>
    <div className="workspace-sidebar-footer"><Icon name="check"/><div><strong>Your daily work, together.</strong><p>One workspace for your people and operations.</p></div></div>
  </>;
  return <><aside className="workspace-sidebar workspace-desktop print:hidden">{content}</aside>
    <dialog id="workspace-navigation" ref={dialog} className="workspace-sidebar workspace-mobile" aria-label={title} onCancel={event => { event.preventDefault(); setOpen(false); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX > rect.right || event.clientX < rect.left) setOpen(false); } }}>
      <button className="workspace-close" onClick={() => setOpen(false)} aria-label="Close navigation">×</button>{content}
    </dialog></>;
}
