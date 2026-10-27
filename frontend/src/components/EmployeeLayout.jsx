import React, { useState } from 'react';
import { useWorkspacePage } from '../utils/useWorkspacePage';
import WorkspaceNavigation from './WorkspaceNavigation';
import './AdminUI.css';
import { Icon } from './AdminUI';
import EmployeeDashboard from './EmployeeDashboard';
import EmployeeProfile from './EmployeeProfile';
import EmployeeLeave from './EmployeeLeave';
import EmployeeWFH from './EmployeeWFH';

export default function EmployeeLayout({ user }) {
  const [activeTab, navigatePage] = useWorkspacePage('employee', ['dashboard', 'leave', 'wfh', 'profile']);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = tab => {
    navigatePage(tab);
    setIsSidebarOpen(false);
  };

  const navigation = [
    { id: 'dashboard', label: 'My overview', icon: 'dashboard' },
    { id: 'leave', label: 'Leave & time off', icon: 'calendar' },
    { id: 'wfh', label: 'Work from home', icon: 'home' },
    { id: 'profile', label: 'My profile', icon: 'people' }
  ];

  return (
    <div className="admin-workspace flex w-full min-h-[calc(100vh-64px)] sm:min-h-[calc(100vh-80px)]">
      <WorkspaceNavigation isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} title="My workspace">
        <nav aria-label="Employee navigation" className="flex min-h-0 flex-col gap-1 overflow-y-auto px-4 py-3">
          {navigation.map(item => <button type="button" key={item.id}
            aria-current={activeTab === item.id ? 'page' : undefined}
            onClick={() => navigate(item.id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Icon name={item.icon}/><span>{item.label}</span>
          </button>)}
        </nav>
      </WorkspaceNavigation>
      <div className="flex-grow p-4 sm:p-8 bg-[#f7f7f8] print:p-0 print:bg-white flex justify-center w-full min-w-0">
        {activeTab === 'dashboard' && <EmployeeDashboard user={user} onNavigate={navigate} />}
        {activeTab === 'profile' && <EmployeeProfile user={user} />}
        {activeTab === 'leave' && <EmployeeLeave user={user} />}
        {activeTab === 'wfh' && <EmployeeWFH user={user} />}
      </div>
    </div>
  );
}
