import React, { useEffect, useRef } from 'react';
import './AdminNavigation.css';

export default function WorkspaceNavigation({ isSidebarOpen, setIsSidebarOpen, title, children }) {
  const menuRef = useRef(null);
  const scrollLock = useRef(null);
  const unlockPage = () => {
    if (!scrollLock.current) return;
    document.body.style.overflow = scrollLock.current.overflow;
    document.body.style.paddingRight = scrollLock.current.paddingRight;
    scrollLock.current = null;
  };
  useEffect(() => {
    const menu = menuRef.current;
    window.dispatchEvent(new CustomEvent('adminMenuState', { detail: isSidebarOpen }));
    if (!menu.open && !isSidebarOpen) return;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260;
    if (isSidebarOpen) {
      if (!scrollLock.current) {
        const scrollbar = window.innerWidth - document.documentElement.clientWidth;
        scrollLock.current = { overflow: document.body.style.overflow, paddingRight: document.body.style.paddingRight };
        const padding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
        document.body.style.paddingRight = `${padding + scrollbar}px`;
        document.body.style.overflow = 'hidden';
      }
      if (!menu.open) menu.showModal();
    }
    menu.dataset.motion = isSidebarOpen ? 'opening' : 'closing';
    const animation = menu.animate(
      isSidebarOpen ? [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }]
        : [{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }],
      { duration, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards' }
    );
    let cancelled = false;
    animation.finished.then(() => {
      if (cancelled || isSidebarOpen) return;
      menu.close();
      unlockPage();
    }).catch(() => {});
    return () => { cancelled = true; animation.cancel(); };
  }, [isSidebarOpen]);

  useEffect(() => () => { unlockPage(); }, []);

  useEffect(() => {
    const toggleMenu = () => setIsSidebarOpen(prev => !prev);
    window.addEventListener('toggleMobileMenu', toggleMenu);
    return () => window.removeEventListener('toggleMobileMenu', toggleMenu);
  }, []);


  return <dialog ref={menuRef} id="workspace-navigation" className="admin-sidebar admin-navigation print:hidden"
    aria-label={title}
    onCancel={event => { event.preventDefault(); setIsSidebarOpen(false); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setIsSidebarOpen(false);
    }}>
    <div className="p-5 border-b border-slate-100 shrink-0"><span className="text-xs font-bold uppercase tracking-widest text-zinc-700">{title}</span></div>
    {children}
  </dialog>;
}
