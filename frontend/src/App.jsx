import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Login from './components/Login';
import EmployeeLayout from './components/EmployeeLayout';
import ManagerLayout from './components/ManagerLayout';
import ChangePassword from './components/ChangePassword';

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const syncUser = () => {
      const savedUser = localStorage.getItem('user');
      setUser(savedUser ? JSON.parse(savedUser) : null);
    };
    syncUser();
    window.addEventListener('userUpdated', syncUser);
    return () => window.removeEventListener('userUpdated', syncUser);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  const handlePasswordChanged = () => {
    const updatedUser = { ...user, is_first_login: false };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900 flex flex-col justify-between font-sans">
      <Navbar user={user} onLogout={handleLogout} />

      <main className="flex-grow flex w-full">
        {!user ? (
          <div className="flex w-full items-center justify-center p-5 sm:p-10">
            <Login setUser={setUser} />
          </div>
        ) : user.is_first_login ? (
          <div className="flex w-full items-center justify-center p-5 sm:p-10">
            <ChangePassword user={user} onComplete={handlePasswordChanged} />
          </div>
        ) : (
          user.role === 'manager' ? (
            <ManagerLayout />
          ) : (
            <EmployeeLayout user={user} />
          )
        )}
      </main>

      <footer className="bg-white border-t border-zinc-200 text-center py-3 text-xs text-zinc-500">
        &copy; 2026 OneSmarter, Inc. All rights reserved. Secure Compliance & Systems.
      </footer>
    </div>
  );
}