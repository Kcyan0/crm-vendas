"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Calendar, Settings as SettingsIcon, LogOut, KanbanSquare, BarChart2, FolderKanban, X, Globe, Palette, ChevronDown } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { createClient } from "@/lib/supabase/browser";
import { useTheme, THEMES, MODES, ThemeId, ModeId } from "@/context/ThemeContext";
import { useState } from "react";

export default function Sidebar({ isOpen, setIsOpen }: { isOpen?: boolean, setIsOpen?: (val: boolean) => void }) {
    const pathname = usePathname();
    const { projetos, selectedProject, setSelectedProject, isLoading, user } = useProject();
    const { theme, mode, setTheme, setMode } = useTheme();
    const [showThemePicker, setShowThemePicker] = useState(false);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        localStorage.removeItem('feracrm_selected_project');
        window.location.href = '/login';
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

    const MODE_ORDER:  ModeId[]  = ["preto", "cinza", "branco"];
    const THEME_ORDER: ThemeId[] = ["verde", "ciano", "roxo", "laranja", "vermelho", "branco"];

    return (
        <>
            {isOpen && (
                <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setIsOpen && setIsOpen(false)} />
            )}

            <div
                className={`fixed inset-y-0 left-0 z-50 w-56 md:w-64 h-full flex flex-col pt-6 pb-4 transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
                style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--sidebar-border)' }}
            >
                {/* Mobile Close */}
                <button onClick={() => setIsOpen && setIsOpen(false)} className="md:hidden absolute top-4 right-4 hover:text-white" style={{ color: 'var(--text-sec)' }}>
                    <X size={20} />
                </button>

                {/* Logo */}
                <div className="px-6 mb-8">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center transition-colors duration-300"
                            style={{ background: 'var(--logo-bg)', border: '2px solid rgba(var(--accent-rgb), 0.3)', padding: '6px' }}
                        >
                            <img
                                src="/logo-transparent.png"
                                alt="H SALES Logo"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    const img = e.currentTarget as HTMLImageElement;
                                    img.src = '/logo.png';
                                    img.style.objectFit = 'cover';
                                    img.style.margin = '-6px';
                                    img.style.width = 'calc(100% + 12px)';
                                    img.style.height = 'calc(100% + 12px)';
                                }}
                            />
                        </div>
                        <div className="flex flex-col leading-tight">
                            <span className="font-black text-lg tracking-tight leading-none" style={{ color: 'var(--text-pri)' }}>H SALES</span>
                            <span className="text-xs font-medium uppercase text-accent" style={{ letterSpacing: '0.15em' }}>CRM</span>
                        </div>
                    </div>
                </div>

                {/* Visão Geral */}
                <div className="px-4 mb-2">
                    <Link
                        href="/overview"
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-150 w-full"
                        style={pathname === '/overview'
                            ? { background: 'var(--accent)', color: 'var(--accent-text)' }
                            : { color: 'var(--text-sec)' }
                        }
                        onMouseEnter={e => { if (pathname !== '/overview') { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-pri)'; } }}
                        onMouseLeave={e => { if (pathname !== '/overview') { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-sec)'; } }}
                    >
                        <Globe size={18} />
                        <span className="font-semibold text-sm">Visão Geral</span>
                    </Link>
                </div>

                {/* Project selector */}
                <div className="px-4 mb-4">
                    <div className="rounded-xl p-2 flex items-center gap-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-str)' }}>
                        <FolderKanban size={15} className="text-accent flex-shrink-0" />
                        {isLoading ? (
                            <div className="h-5 w-full rounded animate-pulse" style={{ background: 'var(--bg-surface-2)' }} />
                        ) : (
                            <select
                                className="bg-transparent border-none text-sm font-semibold outline-none w-full cursor-pointer appearance-none"
                                style={{ color: 'var(--text-pri)', padding: 0 }}
                                value={selectedProject?.id_projeto || ''}
                                onChange={e => { const p = projetos.find(proj => proj.id_projeto === Number(e.target.value)); if (p) setSelectedProject(p); }}
                            >
                                {projetos.map(p => (
                                    <option key={p.id_projeto} value={p.id_projeto} style={{ background: 'var(--bg-surface)' }}>{p.nome}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-4 space-y-1 mt-2">
                    {NAV_ITEMS.map(link => {
                        const Icon = link.icon;
                        const isActive = pathname === link.path;
                        return (
                            <Link
                                key={link.name}
                                href={link.path}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150"
                                style={isActive
                                    ? { background: 'var(--accent)', color: 'var(--accent-text)' }
                                    : { color: 'var(--text-sec)' }
                                }
                                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-pri)'; } }}
                                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-sec)'; } }}
                            >
                                <Icon size={18} />
                                <span className="font-semibold text-sm">{link.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="p-4" style={{ borderTop: '1px solid var(--sidebar-border)' }}>

                    {/* ── Aparência ── */}
                    <div className="mb-3">
                        <button
                            onClick={() => setShowThemePicker(v => !v)}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl w-full transition-all"
                            style={{ color: 'var(--text-sec)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                            <Palette size={18} />
                            <span className="font-semibold text-sm flex-1 text-left">Aparência</span>
                            <div className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0" style={{ background: 'var(--accent)' }} />
                            <ChevronDown size={14} className={`transition-transform ${showThemePicker ? 'rotate-180' : ''}`} />
                        </button>

                        {showThemePicker && (
                            <div className="mt-2 px-4 space-y-3 pb-1">
                                {/* Primário — modo de fundo */}
                                <div>
                                    <p className="text-[10px] uppercase font-bold mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>Primário</p>
                                    <div className="flex gap-1.5">
                                        {MODE_ORDER.map(mid => {
                                            const mdef = MODES[mid];
                                            const isActive = mode === mid;
                                            return (
                                                <button
                                                    key={mid}
                                                    title={mdef.label}
                                                    onClick={() => setMode(mid)}
                                                    className="flex-1 h-8 rounded-lg text-[10px] font-bold transition-all duration-150"
                                                    style={{
                                                        background: mdef.bgSurface,
                                                        color: mdef.textPri,
                                                        border: isActive ? `2px solid var(--accent)` : `1.5px solid ${mdef.borderStr}`,
                                                        boxShadow: isActive ? `0 0 8px rgba(var(--accent-rgb),0.3)` : 'none',
                                                        transform: isActive ? 'scale(1.04)' : 'scale(1)',
                                                    }}
                                                >
                                                    {mdef.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Secundário — cor de destaque */}
                                <div>
                                    <p className="text-[10px] uppercase font-bold mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>Secundário</p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {THEME_ORDER.map(tid => {
                                            const def = THEMES[tid];
                                            const isActive = theme === tid;
                                            return (
                                                <button
                                                    key={tid}
                                                    title={def.label}
                                                    onClick={() => setTheme(tid)}
                                                    className="w-6 h-6 rounded-full transition-all duration-150 flex-shrink-0"
                                                    style={{
                                                        background: def.accent,
                                                        border: tid === 'branco' ? '1.5px solid var(--border-str)' : 'none',
                                                        outline: isActive ? `2px solid ${def.accent}` : '2px solid transparent',
                                                        outlineOffset: '2px',
                                                        transform: isActive ? 'scale(1.2)' : 'scale(1)',
                                                        boxShadow: isActive ? `0 0 8px ${def.accent}60` : 'none',
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                        {THEMES[theme].label}{mode !== 'preto' && theme === 'branco' ? ' → Escuro' : ''}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* User info */}
                    <div className="flex items-center gap-3 px-2 py-2 mb-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center border font-bold text-xs text-accent"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-str)' }}>
                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-pri)' }}>{user?.email?.split('@')[0] || 'Carregando...'}</span>
                            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</span>
                        </div>
                    </div>

                    <div
                        className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all hover:bg-red-500/10 hover:text-red-500"
                        style={{ color: 'var(--text-sec)' }}
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
