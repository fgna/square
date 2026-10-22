'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CommandPalette } from '@/components/command-palette/command-palette';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { useProfileSync } from '@/hooks/use-profile-sync';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useProfileSync();

  return (
    <div className="min-h-screen" style={{ background: 'var(--theme-background)' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[25] bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="lg:ml-[280px]">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="pt-16 min-h-screen">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
      <CommandPalette />
      <OnboardingWizard />
    </div>
  );
}
