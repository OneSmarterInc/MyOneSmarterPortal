import React from 'react';

export default function Navbar({ user, onLogout }) {
  return (
    <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 sm:h-20 items-center">
          
          {/* Left Side: Hamburger (Mobile) + Logo and Brand */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            
            {/* Mobile Hamburger Button */}
            {user && (
              <button 
                onClick={() => window.dispatchEvent(new Event('toggleMobileMenu'))}
                className="md:hidden -ml-2 p-2 text-slate-600 hover:text-zinc-900 focus:outline-none transition-colors rounded-lg hover:bg-slate-50"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
              </button>
            )}

            <img 
              src="/logo.png" 
              alt="MyOnesmarter Logo" 
              className="h-8 sm:h-10 lg:h-12 w-auto object-contain"
              onError={(e) => {
                e.target.onerror = null; 
                e.target.style.display = 'none';
              }}
            />
            <div className="flex flex-col justify-center">
              <span className="font-black text-xl sm:text-2xl lg:text-3xl tracking-tight text-zinc-900 leading-none">
                MyOnesmarter
              </span>
              <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                Employee Portal
              </span>
            </div>
          </div>

          {/* Right Side: User Profile & Actions */}
          <div className="flex items-center gap-3 sm:gap-5">
            {user ? (
              <>
                <div className="hidden md:flex flex-col items-end text-right">
                  <span className="text-sm font-bold text-zinc-800 leading-tight">
                    @{user.username}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-600">
                    {user.role === 'manager' ? 'Administrator' : user.role}
                  </span>
                </div>
                
                <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
                
                <button 
                  onClick={onLogout}
                  className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 px-4 sm:px-5 py-2 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors shadow-sm whitespace-nowrap"
                >
                  Logout
                </button>
              </>
            ) : (
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                Secure Login
              </span>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}