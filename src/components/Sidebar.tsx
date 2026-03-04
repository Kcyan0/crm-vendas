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
        <div className="w-64 h-full bg-white border-r border-[#0000000a] flex flex-col pt-6 pb-4">
            <div className="px-6 mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-600 to-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/30">
                        <span className="text-white font-bold text-lg">F</span>
                    </div>
                    <span className="text-xl font-extrabold tracking-tight text-slate-800">
                        FERACRM
                    </span>
                </div>
            </div>

            <div className="px-4 mb-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center gap-2">
                    <FolderKanban size={16} className="text-slate-400" />
                    {isLoading ? (
                        <div className="h-5 w-full bg-slate-200 animate-pulse rounded"></div>
                    ) : (
                        <select
                            className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none focus:ring-0 w-full cursor-pointer appearance-none"
                            value={selectedProject?.id_projeto || ''}
                            onChange={(e) => {
                                const p = projetos.find(proj => proj.id_projeto === Number(e.target.value));
                                if (p) setSelectedProject(p);
                            }}
                        >
                            {projetos.map(p => (
                                <option key={p.id_projeto} value={p.id_projeto}>{p.nome}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
                {NAV_ITEMS.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.path;
                    return (
                        <Link
                            key={link.name}
                            href={link.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                ? "bg-orange-50 text-orange-600 border border-orange-200 shadow-sm"
                                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                }`}
                        >
                            <Icon size={20} className={isActive ? "text-orange-500" : ""} />
                            <span className="font-medium text-sm">{link.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-[#0000000a]">
                <div className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">
                    <SettingsIcon size={18} />
                    <span className="font-medium text-sm">Configurações</span>
                </div>

                <div className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer mt-1">
                    <LogOut size={18} />
                    <span className="font-medium text-sm">Sair da Conta</span>
                </div>

                <div className="mt-4 px-4 py-3 bg-slate-50 rounded-xl flex items-center gap-3 border border-slate-100">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Cassiano" alt="User" className="w-9 h-9 rounded-full bg-slate-200" />
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">Cassiano M.</span>
                        <span className="text-[10px] text-slate-500 font-medium uppercase">Admin</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
