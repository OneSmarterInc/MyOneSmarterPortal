import './AdminUI.css';
import React, { useState, useEffect } from 'react';
import { Icon } from './AdminUI';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [desktopSidebarVisible, setDesktopSidebarVisible] = useState(true);
  const [createMode,setCreateMode] = useState(false);
  const [approvalFilter,setApprovalFilter] = useState('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const navigate = (tab,filter = 'all') => {setIsSidebarOpen(false);setSelectedEmployeeId(null);setApprovalFilter(filter);setActiveTab(tab);setCreateMode(false);};
  const openEmployee = id => {navigate('employees');setSelectedEmployeeId(id);};
  const addEmployee = () => {setActiveTab('dashboard');setCreateMode(true);};

  useEffect(() => {
    const toggle = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) setDesktopSidebarVisible(visible => !visible);
      else setIsSidebarOpen(open => !open);
    };
    window.addEventListener('toggleMobileMenu', toggle);
    return () => window.removeEventListener('toggleMobileMenu', toggle);
  }, []);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('adminMenuState', { detail: isSidebarOpen || desktopSidebarVisible }));
  }, [isSidebarOpen, desktopSidebarVisible]);
  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'pending-attendance', label: 'Attendance approvals', icon: 'clock' },
    { id: 'pending-leaves', label: 'Leave requests', icon: 'check' },
    { id: 'schedule', label: 'Calendar', icon: 'calendar' },
    { id: 'employees', label: 'People directory', icon: 'people' },
    { id: 'leaves', label: 'Leave quotas', icon: 'calendar' },
    { id: 'wfh', label: 'Work from home', icon: 'home' },
    { id: 'report', label: 'Reports', icon: 'report' },
    { id: 'email', label: 'Email settings', icon: 'mail' }
  ];
  return (
    <div className="admin-workspace flex w-full min-h-[calc(100vh-64px)] sm:min-h-[calc(100vh-80px)]">
      
      {isSidebarOpen && <button type="button" aria-label="Close navigation" onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 z-[60] bg-black/40 lg:hidden" />}
      <aside id="workspace-navigation" className={`admin-sidebar fixed inset-y-0 left-0 z-[70] flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 print:hidden lg:relative lg:inset-auto lg:z-auto ${desktopSidebarVisible ? 'lg:flex lg:translate-x-0' : 'lg:hidden'} ${isSidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-slate-100 p-4 lg:hidden">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-700">Administration</span>
          <button type="button" aria-label="Close navigation menu" onClick={() => setIsSidebarOpen(false)} className="rounded-lg p-2 text-zinc-600 hover:bg-red-50">✕</button>
        </div>
        <p className="hidden px-6 pb-3 pt-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 lg:block">Administration</p>
        <nav aria-label="Administration" className="flex min-h-0 flex-col gap-1 overflow-y-auto px-4 py-3 lg:py-0">
          {navigation.map(item => <button type="button" key={item.id}
            aria-current={activeTab === item.id ? 'page' : undefined}
            onClick={() => navigate(item.id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Icon name={item.icon}/><span>{item.label}</span>
          </button>)}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow p-4 sm:p-8 bg-[#f7f7f8] print:p-0 print:bg-white flex justify-center w-full min-w-0">
        {activeTab === 'dashboard' && <ManagerDashboard setActiveTab={setActiveTab} navigate={navigate} createMode={createMode} onCreateMode={setCreateMode} onSelectEmployee={openEmployee} />}
        {activeTab === 'pending-attendance' && <PendingAttendance key={approvalFilter} initialFilter={approvalFilter} />}
        {activeTab === 'pending-leaves' && <PendingLeaves />}
        {activeTab === 'schedule' && <ManagerSchedule />}
        {activeTab === 'employees' && <ManageEmployees onAddEmployee={addEmployee} initialUserId={selectedEmployeeId} />}
        {activeTab === 'leaves' && <ManageLeaves />}
        {activeTab === 'wfh' && <ManageWFH />} {/* <-- Render new component */}
        {activeTab === 'report' && <ManagerReport />}
        {activeTab === 'email' && <EmailSettings />}
      </div>
    </div>
  );
}
