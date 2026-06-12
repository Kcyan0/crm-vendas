"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    ShieldCheck, UserPlus, ArrowRightLeft, DollarSign, Trash2,
    FileEdit, RefreshCw, Filter, ChevronDown, Clock, Search
} from "lucide-react";
import { useProject } from "@/context/ProjectContext";

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Atividade = {
    id: number;
    id_projeto: number | null;
    id_usuario: number | null;
    usuario_nome: string | null;
    tipo: string;
    descricao: string;
    meta: Record<string, any>;
    created_at: string;
};

/* ─── Config per type ────────────────────────────────────────────────────── */
const TIPO_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    lead_criado:       { label: "Lead Criado",         icon: UserPlus,        color: "#34d399", bg: "rgba(52,211,153,0.12)" },
    status_alterado:   { label: "Status Alterado",     icon: ArrowRightLeft,  color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
    venda_registrada:  { label: "Venda Registrada",    icon: DollarSign,      color: "#facc15", bg: "rgba(250,204,21,0.12)" },
    lead_editado:      { label: "Lead Editado",        icon: FileEdit,        color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
    lead_deletado:     { label: "Lead Deletado",       icon: Trash2,          color: "#f87171", bg: "rgba(248,113,113,0.12)" },
};

const TIPOS = ["todos", ...Object.keys(TIPO_CONFIG)];

/* ─── Role badge config ──────────────────────────────────────────────────── */
const ROLE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
    ADMIN:  { label: "Admin",  color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
    EXPERT: { label: "Expert", color: "#f59e0b", bg: "rgba(245,158,11,0.15)"  },
    CLOSER: { label: "Closer", color: "#fb923c", bg: "rgba(251,146,60,0.15)"  },
    SDR:    { label: "SDR",    color: "#60a5fa", bg: "rgba(96,165,250,0.15)"  },
};

/* ─── Relative time ──────────────────────────────────────────────────────── */
function timeAgo(iso: string): string {
    const diffMs  = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1)   return "agora mesmo";
    if (diffMin < 60)  return `há ${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)    return `há ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1)   return "ontem";
    if (diffD < 7)     return `há ${diffD} dias`;
    return new Date(iso).toLocaleDateString("pt-BR");
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function AdminPage() {
    const { selectedProject, isAdmin, isLoading: roleLoading } = useProject();

    /* ─── Access gate ────────────────────────────────────────────────── */
    if (roleLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-app)" }}>
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                    <p className="text-sm" style={{ color: "var(--text-sec)" }}>Verificando permissões…</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--bg-app)" }}>
                <div className="text-center max-w-sm">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                         style={{ background: "rgba(248,113,113,0.12)" }}>
                        <ShieldCheck size={36} style={{ color: "#f87171" }} />
                    </div>
                    <h2 className="text-2xl font-black mb-2" style={{ color: "var(--text-pri)" }}>Acesso Restrito</h2>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-sec)" }}>
                        Essa área é exclusiva para usuários com cargo <strong style={{ color: "var(--text-pri)" }}>Admin</strong> ou <strong style={{ color: "var(--text-pri)" }}>Expert</strong>.
                        <br />Entre em contato com o administrador do sistema.
                    </p>
                </div>
            </div>
        );
    }

    const [atividades, setAtividades]     = useState<Atividade[]>([]);
    const [total, setTotal]               = useState(0);
    const [loading, setLoading]           = useState(true);
    const [loadingMore, setLoadingMore]   = useState(false);
    const [tipoFilter, setTipoFilter]     = useState("todos");
    const [search, setSearch]             = useState("");
    const [autoRefresh, setAutoRefresh]   = useState(true);
    const [lastRefresh, setLastRefresh]   = useState(new Date());
    const [showFilter, setShowFilter]     = useState(false);

    const LIMIT = 40;
    const offset = useRef(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    /* ─── Fetch ──────────────────────────────────────────────────────── */
    const fetchAtividades = useCallback(async (reset = true) => {
        if (!selectedProject?.id_projeto) return;
        if (reset) { setLoading(true); offset.current = 0; }
        else        setLoadingMore(true);

        const o = reset ? 0 : offset.current;
        const params = new URLSearchParams({
            projectId: String(selectedProject.id_projeto),
            limit:     String(LIMIT),
            offset:    String(o),
        });
        if (tipoFilter !== "todos") params.set("tipo", tipoFilter);

        try {
            const res  = await fetch(`/api/atividades?${params}`);
            const json = await res.json();
            const rows: Atividade[] = json.data || [];

            if (reset) {
                setAtividades(rows);
                offset.current = rows.length;
            } else {
                setAtividades(prev => [...prev, ...rows]);
                offset.current += rows.length;
            }
            setTotal(json.total || 0);
            setLastRefresh(new Date());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [selectedProject, tipoFilter]);

    useEffect(() => { fetchAtividades(true); }, [fetchAtividades]);

    /* ─── Auto-refresh every 30s ─────────────────────────────────────── */
    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(() => fetchAtividades(true), 30000);
        }
        return () => clearInterval(intervalRef.current);
    }, [autoRefresh, fetchAtividades]);

    /* ─── Filtered list (client-side search) ─────────────────────────── */
    const filtered = search.trim()
        ? atividades.filter(a =>
            a.descricao.toLowerCase().includes(search.toLowerCase()) ||
            (a.usuario_nome || "").toLowerCase().includes(search.toLowerCase())
          )
        : atividades;

    const hasMore = offset.current < total;

    /* ─── Avatar initials ────────────────────────────────────────────── */
    function initials(name: string | null): string {
        if (!name) return "?";
        return name.trim().split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    }

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: "var(--bg-app)" }}>
            {/* ─── Header ───────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                         style={{ background: "rgba(var(--accent-rgb),0.15)" }}>
                        <ShieldCheck size={22} style={{ color: "var(--accent)" }} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-pri)" }}>
                            Log de Atividades
                        </h1>
                        <p className="text-sm" style={{ color: "var(--text-sec)" }}>
                            Tudo que o time fez — {total} registro{total !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Auto-refresh toggle */}
                    <button
                        onClick={() => setAutoRefresh(v => !v)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={{
                            background: autoRefresh ? "rgba(var(--accent-rgb),0.15)" : "var(--bg-surface)",
                            color: autoRefresh ? "var(--accent)" : "var(--text-sec)",
                            border: "1px solid var(--border-str)"
                        }}
                        title={`Auto-refresh ${autoRefresh ? "ligado" : "desligado"} · Atualizado ${timeAgo(lastRefresh.toISOString())}`}
                    >
                        <RefreshCw size={13} className={autoRefresh ? "animate-spin" : ""} style={{ animationDuration: "3s" }} />
                        {autoRefresh ? "Ao vivo" : "Pausado"}
                    </button>

                    {/* Manual refresh */}
                    <button
                        onClick={() => fetchAtividades(true)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: "var(--bg-surface)", color: "var(--text-sec)", border: "1px solid var(--border-str)" }}
                    >
                        <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                        Atualizar
                    </button>

                    {/* Filter button */}
                    <button
                        onClick={() => setShowFilter(v => !v)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={{
                            background: tipoFilter !== "todos" ? "rgba(var(--accent-rgb),0.15)" : "var(--bg-surface)",
                            color: tipoFilter !== "todos" ? "var(--accent)" : "var(--text-sec)",
                            border: "1px solid var(--border-str)"
                        }}
                    >
                        <Filter size={13} />
                        {tipoFilter !== "todos" ? (TIPO_CONFIG[tipoFilter]?.label ?? tipoFilter) : "Filtrar"}
                        <ChevronDown size={12} className={`transition-transform ${showFilter ? "rotate-180" : ""}`} />
                    </button>
                </div>
            </div>

            {/* ─── Filter chips ─────────────────────────────────────────── */}
            {showFilter && (
                <div className="mb-6 p-4 rounded-2xl flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-200"
                     style={{ background: "var(--bg-surface)", border: "1px solid var(--border-str)" }}>
                    {TIPOS.map(t => {
                        const cfg = TIPO_CONFIG[t];
                        const isActive = tipoFilter === t;
                        return (
                            <button
                                key={t}
                                onClick={() => { setTipoFilter(t); setShowFilter(false); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                style={{
                                    background: isActive ? (cfg?.bg ?? "rgba(var(--accent-rgb),0.15)") : "var(--bg-app)",
                                    color: isActive ? (cfg?.color ?? "var(--accent)") : "var(--text-sec)",
                                    border: `1px solid ${isActive ? (cfg?.color ?? "var(--accent)") : "var(--border-str)"}`,
                                }}
                            >
                                {cfg && <cfg.icon size={11} />}
                                {cfg?.label ?? "Todos"}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ─── Search ───────────────────────────────────────────────── */}
            <div className="relative mb-6">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sec)" }} />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar atividade ou usuário..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-str)",
                        color: "var(--text-pri)",
                    }}
                />
            </div>

            {/* ─── Timeline ─────────────────────────────────────────────── */}
            {!selectedProject ? (
                <div className="text-center py-20 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px dashed var(--border-str)" }}>
                    <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" style={{ color: "var(--text-sec)" }} />
                    <p style={{ color: "var(--text-sec)" }}>Selecione um projeto para ver o log de atividades.</p>
                </div>
            ) : loading ? (
                <div className="space-y-3">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex gap-4 p-4 rounded-2xl animate-pulse"
                             style={{ background: "var(--bg-surface)" }}>
                            <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ background: "var(--bg-app)" }} />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 rounded-full w-3/4" style={{ background: "var(--bg-app)" }} />
                                <div className="h-3 rounded-full w-1/2" style={{ background: "var(--bg-app)" }} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px dashed var(--border-str)" }}>
                    <Clock size={40} className="mx-auto mb-3 opacity-30" style={{ color: "var(--text-sec)" }} />
                    <p className="font-semibold" style={{ color: "var(--text-pri)" }}>Nenhuma atividade encontrada</p>
                    <p className="text-sm mt-1" style={{ color: "var(--text-sec)" }}>
                        As ações do time aparecerão aqui em tempo real.
                    </p>
                </div>
            ) : (
                <>
                    <div className="space-y-2">
                        {filtered.map((a, idx) => {
                            const cfg = TIPO_CONFIG[a.tipo] ?? {
                                label: a.tipo,
                                icon: Clock,
                                color: "var(--text-sec)",
                                bg: "var(--bg-surface)",
                            };
                            const Icon = cfg.icon;
                            return (
                                <div
                                    key={a.id}
                                    className="flex gap-4 p-4 rounded-2xl transition-all duration-150 group"
                                    style={{
                                        background: "var(--bg-surface)",
                                        border: "1px solid var(--border-str)",
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.borderColor = cfg.color + "50")}
                                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-str)")}
                                >
                                    {/* Icon */}
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                         style={{ background: cfg.bg }}>
                                        <Icon size={18} style={{ color: cfg.color }} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 flex-wrap">
                                            <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text-pri)" }}>
                                                {a.descricao}
                                            </p>
                                            <span className="text-[11px] font-medium flex-shrink-0 flex items-center gap-1"
                                                  style={{ color: "var(--text-sec)" }}
                                                  title={formatDate(a.created_at)}>
                                                <Clock size={10} />
                                                {timeAgo(a.created_at)}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                            {/* Type badge */}
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide"
                                                  style={{ background: cfg.bg, color: cfg.color }}>
                                                {cfg.label}
                                            </span>

                                            {/* User avatar + name + role badge */}
                                            {a.usuario_nome && (
                                                <span className="flex items-center gap-1.5 text-[11px] font-medium"
                                                      style={{ color: "var(--text-sec)" }}>
                                                    <span className="w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center flex-shrink-0"
                                                          style={{ background: "rgba(var(--accent-rgb),0.2)", color: "var(--accent)" }}>
                                                        {initials(a.usuario_nome)}
                                                    </span>
                                                    {a.usuario_nome}
                                                    {/* Role pill */}
                                                    {a.meta?.usuario_tipo && ROLE_BADGE[a.meta.usuario_tipo.toUpperCase()] && (
                                                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
                                                              style={{
                                                                  background: ROLE_BADGE[a.meta.usuario_tipo.toUpperCase()].bg,
                                                                  color: ROLE_BADGE[a.meta.usuario_tipo.toUpperCase()].color,
                                                              }}>
                                                            {ROLE_BADGE[a.meta.usuario_tipo.toUpperCase()].label}
                                                        </span>
                                                    )}
                                                </span>
                                            )}

                                            {/* Extra meta */}
                                            {a.tipo === "venda_registrada" && a.meta?.valor_bruto > 0 && (
                                                <span className="text-[11px] font-bold" style={{ color: "#facc15" }}>
                                                    R$ {Number(a.meta.valor_bruto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                </span>
                                            )}
                                            {a.tipo === "status_alterado" && a.meta?.status_de && (
                                                <span className="text-[11px]" style={{ color: "var(--text-sec)" }}>
                                                    {a.meta.status_de} → <span className="font-bold" style={{ color: "#60a5fa" }}>{a.meta.status_para}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Load more */}
                    {hasMore && !search && (
                        <div className="mt-6 text-center">
                            <button
                                onClick={() => fetchAtividades(false)}
                                disabled={loadingMore}
                                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
                                style={{
                                    background: "var(--bg-surface)",
                                    border: "1px solid var(--border-str)",
                                    color: "var(--text-sec)",
                                }}
                            >
                                {loadingMore ? "Carregando..." : `Carregar mais (${total - offset.current} restantes)`}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
