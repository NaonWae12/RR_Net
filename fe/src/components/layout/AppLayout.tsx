'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
// NOTE: BottomNav is currently NOT USED - commented out
// import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // NOTE: BottomNav is currently NOT USED - removed related logic
  // const { isTechnician } = useRole();
  // const pathname = usePathname();
  // const showBottomNav = isTechnician && pathname.startsWith('/technician');

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:pl-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* NOTE: BottomNav is currently NOT USED - commented out */}
      {/* {showBottomNav && <BottomNav />} */}
    </div>
  );
}


