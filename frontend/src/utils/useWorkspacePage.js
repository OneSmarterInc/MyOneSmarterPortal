import { useEffect, useState } from 'react';

// Hash URLs survive refreshes without requiring server-side route rewrites.
export function useWorkspacePage(role, allowedTabs) {
  const prefix = `#/${role}/`;
  const getPage = () => {
    const hash = window.location.hash;
    if (!hash.startsWith(prefix)) return 'dashboard';
    const tab = decodeURIComponent(hash.slice(prefix.length).split('/')[0]);
    return allowedTabs.includes(tab) ? tab : 'dashboard';
  };
  const [activeTab, setActiveTab] = useState(getPage);

  useEffect(() => {
    const sync = () => setActiveTab(getPage());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    sync();
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, [role]);

  const navigatePage = tab => {
    const next = allowedTabs.includes(tab) ? tab : 'dashboard';
    const hash = `${prefix}${next}`;
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
    setActiveTab(next);
  };
  return [activeTab, navigatePage];
}
