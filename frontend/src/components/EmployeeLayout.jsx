import WorkspaceSidebar from './WorkspaceSidebar';
import React, { useState } from 'react';
import './AdminUI.css';
import EmployeeDashboard from './EmployeeDashboard';
import EmployeeProfile from './EmployeeProfile';
import EmployeeLeave from './EmployeeLeave';
import EmployeeWFH from './EmployeeWFH'; // <-- Import the new component

export default function EmployeeLayout({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="admin-workspace flex w-full min-h-[calc(100vh-64px)] sm:min-h-[calc(100vh-80px)]">
      
      <WorkspaceSidebar title="My workspace" activeTab={activeTab} onNavigate={setActiveTab} items={[
        { id: 'dashboard', label: 'My overview', icon: 'dashboard' },
        { id: 'leave', label: 'Leave & time off', icon: 'calendar', section: 'My workday' },
        { id: 'wfh', label: 'Work from home', icon: 'home' },
        { id: 'profile', label: 'My profile', icon: 'people', section: 'Personal' }
      ]}/>

      {/* Main Content Area */}
      <div className="flex-grow p-4 sm:p-8 bg-[#f7f7f8] print:p-0 print:bg-white flex justify-center w-full min-w-0">
        {activeTab === 'dashboard' && <EmployeeDashboard user={user} onNavigate={setActiveTab} />}
        {activeTab === 'profile' && <EmployeeProfile user={user} />}
        {activeTab === 'leave' && <EmployeeLeave user={user} />}
        {activeTab === 'wfh' && <EmployeeWFH user={user} />} {/* <-- Render new component */}
      </div>
    </div>
  );
}