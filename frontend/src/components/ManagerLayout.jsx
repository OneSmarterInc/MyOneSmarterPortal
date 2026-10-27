import './AdminUI.css';
import './AdminNavigation.css';
import { Icon } from './AdminUI';
import React, { useState, useEffect, useRef } from 'react';
import ManagerDashboard from './ManagerDashboard';
import ManageEmployees from './ManageEmployees';
import EmailSettings from './EmailSettings';
import ManagerSchedule from './ManagerSchedule';
import ManagerReport from './ManagerReport';
import ManageLeaves from './ManageLeaves'; 
import PendingAttendance from './PendingAttendance';
import PendingLeaves from './PendingLeaves';
import ManageWFH from './ManageWFH'; // <-- Import the new component

export default function ManagerLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [createMode,setCreateMode] = useState(false);
  const [approvalFilter,setApprovalFilter] = useState('all');
  const navigate = (tab,filter = 'all') => {setApprovalFilter(filter);setActiveTab(tab);setIsSidebarOpen(false);setCreateMode(false);};
  const addEmployee = () => {setActiveTab('dashboard');setCreateMode(true);};
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const menuRef = useRef(null);
  useEffect(() => {
    const menu = menuRef.current;
    window.dispatchEvent(new CustomEvent('adminMenuState', { detail: isSidebarOpen }));
    if (!isSidebarOpen) { if (menu.open) menu.close(); return; }
    menu.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; if (menu.open) menu.close(); };
  }, [isSidebarOpen]);

  useEffect(() => {
    const toggleMenu = () => setIsSidebarOpen(prev => !prev);
    window.addEventListener('toggleMobileMenu', toggleMenu);
    return () => window.removeEventListener('toggleMobileMenu', toggleMenu);
  }, []);

  const handleTabClick = (tab) => {
    navigate(tab);
    setIsSidebarOpen(false); 
  };

  return (
    <div className="admin-workspace flex w-full min-h-[calc(100vh-64px)] sm:min-h-[calc(100vh-80px)]">
      
      <dialog ref={menuRef} id="admin-navigation" className="admin-sidebar admin-navigation print:hidden"
        aria-label="Administration navigation"
        onCancel={() => setIsSidebarOpen(false)}
        onClick={event => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setIsSidebarOpen(false);
        }}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <span className="font-bold text-zinc-900 uppercase tracking-widest text-xs">Administration</span>
          <button type="button" autoFocus aria-label="Close navigation menu" onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-500 hover:text-red-600">
            <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-4 py-4 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'pending-attendance', label: 'Attendance approvals' },
            { id: 'pending-leaves', label: 'Leave requests' },
            { id: 'schedule', label: 'Calendar' },
            { id: 'employees', label: 'People directory' },
            { id: 'leaves', label: 'Leave quotas' },
            { id: 'wfh', label: 'Work from home' }, // <-- Added WFH Admin Tab
            { id: 'report', label: 'Reports' },
            { id: 'email', label: 'Email settings' }
          ].map(tab => (
            <button 
              key={tab.id}
              aria-current={activeTab===tab.id ? 'page' : undefined}
              onClick={() => handleTabClick(tab.id)} 
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === tab.id 
                  ? 'bg-red-50 text-red-700 md:border-l-4 md:border-red-600 md:rounded-l-none' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon name={({dashboard:'dashboard','pending-attendance':'clock','pending-leaves':'check',schedule:'calendar',employees:'people',leaves:'calendar',wfh:'home',report:'report',email:'mail'})[tab.id]}/>{tab.label}
            </button>
          ))}
        </nav>
      </dialog>

      {/* Main Content Area */}
      <div className="flex-grow p-4 sm:p-8 bg-[#f7f7f8] print:p-0 print:bg-white flex justify-center w-full min-w-0">
        {activeTab === 'dashboard' && <ManagerDashboard setActiveTab={setActiveTab} navigate={navigate} createMode={createMode} onCreateMode={setCreateMode} />}
        {activeTab === 'pending-attendance' && <PendingAttendance key={approvalFilter} initialFilter={approvalFilter} />}
        {activeTab === 'pending-leaves' && <PendingLeaves />}
        {activeTab === 'schedule' && <ManagerSchedule />}
        {activeTab === 'employees' && <ManageEmployees onAddEmployee={addEmployee} />}
        {activeTab === 'leaves' && <ManageLeaves />}
        {activeTab === 'wfh' && <ManageWFH />} {/* <-- Render new component */}
        {activeTab === 'report' && <ManagerReport />}
        {activeTab === 'email' && <EmailSettings />}
      </div>
    </div>
  );
}