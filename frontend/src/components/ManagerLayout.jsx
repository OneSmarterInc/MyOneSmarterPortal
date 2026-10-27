import WorkspaceSidebar from './WorkspaceSidebar';
import './AdminUI.css';
import React, { useState } from 'react';
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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const navigate = (tab,filter = 'all') => {setSelectedEmployeeId(null);setApprovalFilter(filter);setActiveTab(tab);setCreateMode(false);};
  const openEmployee = id => {navigate('employees');setSelectedEmployeeId(id);};
  const addEmployee = () => {setActiveTab('dashboard');setCreateMode(true);};

  return (
    <div className="admin-workspace flex w-full min-h-[calc(100vh-64px)] sm:min-h-[calc(100vh-80px)]">
      
      <WorkspaceSidebar title="Company workspace" activeTab={activeTab} onNavigate={navigate} items={[
        { id: 'dashboard', label: 'Overview', icon: 'dashboard' },
        { id: 'pending-attendance', label: 'Attendance approvals', icon: 'clock', section: 'People & operations' },
        { id: 'pending-leaves', label: 'Leave requests', icon: 'check' },
        { id: 'employees', label: 'People directory', icon: 'people' },
        { id: 'schedule', label: 'Company calendar', icon: 'calendar' },
        { id: 'leaves', label: 'Leave allocations', icon: 'calendar' },
        { id: 'wfh', label: 'Work from home', icon: 'home' },
        { id: 'report', label: 'Reports & insights', icon: 'report', section: 'Administration' },
        { id: 'email', label: 'Email settings', icon: 'mail' }
      ]}/>

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
