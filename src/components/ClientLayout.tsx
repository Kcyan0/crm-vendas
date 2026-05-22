"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Menu } from "lucide-react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row w-full h-full overflow-hidden">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-40 shrink-0" style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(var(--accent-rgb),0.3)' }}>
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-black tracking-tight leading-none text-sm" style={{ color: 'var(--text-pri)' }}>H SALES CRM</span>
        </div>
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="hover:text-white transition-colors" style={{ color: 'var(--text-sec)' }}
        >
          <Menu size={24} />
        </button>
      </div>

      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <main className="flex-1 overflow-y-auto w-full relative h-[calc(100vh-73px)] md:h-full p-4 md:p-8 transition-colors duration-250" style={{ background: 'var(--bg-app)' }}>
        {children}
      </main>
    </div>
  );
}
