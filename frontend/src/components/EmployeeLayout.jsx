import React, { useState, useEffect } from 'react';
import EmployeeDashboard from './EmployeeDashboard';
import EmployeeProfile from './EmployeeProfile';
import EmployeeHistory from './EmployeeHistory';
import EmployeeLeave from './EmployeeLeave'; 

export default function EmployeeLayout({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Listen for the hamburger click from Navbar
  useEffect(() => {
    const toggleMenu = () => setIsSidebarOpen(prev => !prev);
    window.addEventListener('toggleMobileMenu', toggleMenu);
    return () => window.removeEventListener('toggleMobileMenu', toggleMenu);
  }, []);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false); // Auto-close sidebar on mobile after clicking
  };

  return (
    <div className="flex w-full min-h-[calc(100vh-72px)]">
      
      {/* Mobile Dark Overlay Backdrop */}
      <div 
        onClick={() => setIsSidebarOpen(false)}
        className={`fixed inset-0 bg-zinc-950/65 backdrop-blur-[2px] z-[60] md:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      ></div>

      {/* Slide-out Sidebar */}
      <aside className={`fixed md:relative top-0 left-0 h-full md:h-auto z-[70] md:z-0 w-[272px] portal-sidebar shadow-2xl md:shadow-none border-r border-zinc-800 shrink-0 print:hidden flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="md:hidden flex items-center justify-between p-5 border-b border-zinc-800">
          <span className="font-bold text-white uppercase tracking-widest text-xs">Workspace</span>
          <button onClick={() => setIsSidebarOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="hidden md:block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 px-6 pt-6">
          Employee Menu
        </div>
        
        <nav className="flex flex-col gap-1.5 px-3 py-4 md:py-0 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Attendance Calendar' },
            { id: 'history', label: 'Attendance History' },
            { id: 'leave', label: 'Apply for Leave' },
            { id: 'profile', label: 'My Profile' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => handleTabClick(tab.id)} 
              aria-current={activeTab === tab.id ? "page" : undefined} className="portal-nav-item"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="portal-content flex-grow p-4 sm:p-7 lg:p-9 flex justify-center w-full min-w-0">
        {activeTab === 'dashboard' && <EmployeeDashboard user={user} />}
        {activeTab === 'history' && <EmployeeHistory user={user} />}
        {activeTab === 'leave' && <EmployeeLeave user={user} />}
        {activeTab === 'profile' && <EmployeeProfile user={user} />}
      </div>
    </div>
  );
}