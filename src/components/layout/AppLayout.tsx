import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { isSandboxMode } from '@/sandbox/mode';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sandboxActive = isSandboxMode();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader onMenuClick={() => setSidebarOpen(true)} />
      {sandboxActive && (
        <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900">
          Sandbox mode is active. Changes are stored only in this browser and never sent to production services.
        </div>
      )}
      <div className="flex">
        <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
