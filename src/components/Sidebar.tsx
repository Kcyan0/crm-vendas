"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Calendar, Settings as SettingsIcon, LogOut, KanbanSquare, BarChart2, FolderKanban } from "lucide-react";
import { useProject } from "@/context/ProjectContext";

export default function Sidebar() {
    const pathname = usePathname();
    const { projetos, selectedProject, setSelectedProject, isLoading } = useProject();

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
        <div className="w-64 h-full flex flex-col pt-6 pb-4" style={{ background: '#0A0A0A', borderRight: '1px solid #1E1E1E' }}>
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
                <div
                    className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all"
                    style={{ color: '#666666' }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.color = '#FFFFFF';
                        (e.currentTarget as HTMLElement).style.background = '#1A1A1A';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.color = '#666666';
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                >
                    <LogOut size={17} />
                    <span className="font-medium text-sm">Sair da Conta</span>
                </div>

                <div className="mt-3 px-4 py-3 rounded-xl flex items-center gap-3" style={{ background: '#1A1A1A', border: '1px solid #2A2A2A' }}>
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Cassiano" alt="User" className="w-9 h-9 rounded-full" style={{ background: '#2A2A2A' }} />
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">Cassiano M.</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#BEFF00' }}>Admin</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
