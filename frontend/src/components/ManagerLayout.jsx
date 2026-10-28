import Documents from './Documents';
import './AdminUI.css';
import React, { useState } from 'react';
import { useWorkspacePage } from '../utils/useWorkspacePage';
import WorkspaceNavigation from './WorkspaceNavigation';
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
  const [activeTab, navigatePage] = useWorkspacePage('manager', ['dashboard', 'pending-attendance', 'pending-leaves', 'schedule', 'employees', 'leaves', 'wfh', 'report', 'email', 'recommendations']);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [createMode,setCreateMode] = useState(false);
  const [approvalFilter,setApprovalFilter] = useState('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const navigate = (tab,filter = 'all') => {setIsSidebarOpen(false);setSelectedEmployeeId(null);setApprovalFilter(filter);navigatePage(tab);setCreateMode(false);};
  const openEmployee = id => {navigate('employees');setSelectedEmployeeId(id);};
  const addEmployee = () => {navigatePage('dashboard');setCreateMode(true);};

  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'pending-attendance', label: 'Attendance approvals', icon: 'clock' },
    { id: 'pending-leaves', label: 'Leave requests', icon: 'check' },
    { id: 'schedule', label: 'Calendar', icon: 'calendar' },
    { id: 'employees', label: 'People directory', icon: 'people' },
    { id: 'leaves', label: 'Leave quotas', icon: 'calendar' },
    { id: 'wfh', label: 'Work from home', icon: 'home' },
    { id: 'report', label: 'Reports', icon: 'report' },
    { id: 'email', label: 'Email settings', icon: 'mail' },
    { id: 'recommendations', label: 'Documents', icon: 'mail' }
  ];
  return (
    <div className="admin-workspace flex w-full min-h-[calc(100vh-64px)] sm:min-h-[calc(100vh-80px)]">
      
      <WorkspaceNavigation isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} title="Administration">
        <nav aria-label="Administration" className="flex min-h-0 flex-col gap-1 overflow-y-auto px-4 py-3">
          {navigation.map(item => <button type="button" key={item.id}
            aria-current={activeTab === item.id ? 'page' : undefined}
            onClick={() => navigate(item.id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Icon name={item.icon}/><span>{item.label}</span>
          </button>)}
        </nav>
      </WorkspaceNavigation>

      {/* Main Content Area */}
      <div className="flex-grow p-4 sm:p-8 bg-[#f7f7f8] print:p-0 print:bg-white flex justify-center w-full min-w-0">
        {activeTab === 'recommendations' && <Documents admin />}
        {activeTab === 'dashboard' && <ManagerDashboard setActiveTab={navigatePage} navigate={navigate} createMode={createMode} onCreateMode={setCreateMode} onSelectEmployee={openEmployee} />}
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

