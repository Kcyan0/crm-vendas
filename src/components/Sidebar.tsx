"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, Users, Calendar, Settings as SettingsIcon, LogOut, KanbanSquare, BarChart2, FolderKanban, X } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { createClient } from "@/lib/supabase/browser";

export default function Sidebar({ isOpen, setIsOpen }: { isOpen?: boolean, setIsOpen?: (val: boolean) => void }) {
    const pathname = usePathname();
    const router = useRouter();
    const { projetos, selectedProject, setSelectedProject, isLoading, user } = useProject();

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
    };

    const NAV_ITEMS = [
        { name: "Painel de Leads", icon: KanbanSquare, path: "/" },
        { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
        { name: "Performance", icon: BarChart2, path: "/performance" },
        { name: "Meu Time", icon: Users, path: "/team" },
        { name: "Calendário", icon: Calendar, path: "/calendar" },
        { name: "Projetos", icon: FolderKanban, path: "/projects" },
        { name: "Configurações", icon: SettingsIcon, path: "/settings" },
    ];

    return (
        <>
            {/* Overlay Mobile */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-40 md:hidden" 
                    onClick={() => setIsOpen && setIsOpen(false)}
                />
            )}
            
            <div 
                className={`fixed inset-y-0 left-0 z-50 w-56 md:w-64 h-full flex flex-col pt-6 pb-4 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`} 
                style={{ background: '#0A0A0A', borderRight: '1px solid #1E1E1E' }}
            >
                {/* Mobile Close Button */}
                <button 
                    onClick={() => setIsOpen && setIsOpen(false)}
                    className="md:hidden absolute top-4 right-4 text-[#888888] hover:text-white"
                >
                    <X size={20} />
                </button>

                {/* Logo */}
            <div className="px-6 mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0" style={{ border: '2px solid rgba(190,255,0,0.3)' }}>
                        <img src="/logo.png" alt="H SALES Logo" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="text-white font-black text-lg tracking-tight leading-none">H SALES</span>
                        <span className="text-xs font-medium uppercase" style={{ color: '#BEFF00', letterSpacing: '0.15em' }}>CRM</span>
                    </div>
                </div>
            </div>

            {/* Project selector */}
            <div className="px-4 mb-4">
                <div className="rounded-xl p-2 flex items-center gap-2" style={{ background: '#1A1A1A', border: '1px solid #2A2A2A' }}>
                    <FolderKanban size={15} style={{ color: '#BEFF00', flexShrink: 0 }} />
                    {isLoading ? (
                        <div className="h-5 w-full rounded animate-pulse" style={{ background: '#2A2A2A' }}></div>
                    ) : (
                        <select
                            className="bg-transparent border-none text-sm font-semibold outline-none w-full cursor-pointer appearance-none"
                            style={{ color: '#FFFFFF', padding: 0 }}
                            value={selectedProject?.id_projeto || ''}
                            onChange={(e) => {
                                const p = projetos.find(proj => proj.id_projeto === Number(e.target.value));
                                if (p) setSelectedProject(p);
                            }}
                        >
                            {projetos.map(p => (
                                <option key={p.id_projeto} value={p.id_projeto} style={{ background: '#1A1A1A' }}>{p.nome}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-4 space-y-1 mt-2">
                {NAV_ITEMS.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.path;
                    return (
                        <Link
                            key={link.name}
                            href={link.path}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150"
                            style={isActive
                                ? { background: '#BEFF00', color: '#0A0A0A' }
                                : { color: '#888888' }
                            }
                            onMouseEnter={e => {
                                if (!isActive) {
                                    (e.currentTarget as HTMLElement).style.background = '#1A1A1A';
                                    (e.currentTarget as HTMLElement).style.color = '#FFFFFF';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!isActive) {
                                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    (e.currentTarget as HTMLElement).style.color = '#888888';
                                }
                            }}
                        >
                            <Icon size={18} />
                            <span className="font-semibold text-sm">{link.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4" style={{ borderTop: '1px solid #1E1E1E' }}>
                <div className="flex items-center gap-3 px-2 py-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center border border-[#2A2A2A] text-[#BEFF00] font-bold text-xs">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-white text-sm font-semibold truncate">{user?.email?.split('@')[0] || 'Carregando...'}</span>
                        <span className="text-[#666666] text-xs truncate">{user?.email}</span>
                    </div>
                </div>

                <div
                    className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all hover:bg-red-500/10 hover:text-red-500"
                    style={{ color: '#666666' }}
                    onClick={handleLogout}
                >
                    <LogOut size={18} />
                    <span className="font-semibold text-sm">Sair da Conta</span>
                </div>
            </div>
        </div>
        </>
    );
}
