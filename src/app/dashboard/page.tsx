"use client";

import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { DashboardGrid } from "./DashboardGrid";

import {
    TrendingUp,
    DollarSign,
    Users,
    BriefcaseBusiness,
    Activity,
    ArrowUpRight,
    Clock
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from "recharts";
import { useProject } from "@/context/ProjectContext";

type Metrics = {
    receita: number;
    caixaLiquido: number;
    pagamentosPendentes: number;
    leadsTotais: number;
    vendasTotais: number;
    conversaoAproximada: string;
    receitaPorPagamentoFaturamento?: { name: string; value: number }[];
    receitaPorPagamentoCaixa?: { name: string; value: number }[];
    ticketMedio: number;
    receitaPorCloser?: { name: string; value: number }[];
    receitaPorSdr?: { name: string; value: number }[];
    tmFaturamentoCloser?: { name: string; value: number }[];
    tmCaixaCloser?: { name: string; value: number }[];
    tmFaturamentoSdr?: { name: string; value: number }[];
    tmCaixaSdr?: { name: string; value: number }[];
    funnelData?: { name: string; value: number }[];
    chargebackRate?: string;
    recentRefundReasons?: string[];
    comissaoCloserTotal?: number;
    comissaoSdrTotal?: number;
    comissaoCloserDetalhes?: { nome: string; caixa: number; pct: number; comissao: number }[];
    comissaoSdrDetalhes?: { nome: string; caixa: number; pct: number; comissao: number }[];
    statusLeads?: { status: string; count: number; pct: number }[];
};

const DARK = '#1A1A1A';
const BORDER = 'rgba(255,255,255,0.07)';
const LIME = '#BEFF00';
const TEXT_SEC = '#888888';

// ─── MetasPanel component ────────────────────────────────────────────────────
type MetaUser = { id_usuario: number; nome: string; tipo: string; meta_faturamento: number; meta_caixa: number; };

function MetasPanel({ projectId, mes, ano, receitaBruta, caixaLiquido, sdrs, closers, formatBRL }: {
    projectId?: string; mes: number; ano: number;
    receitaBruta: number; caixaLiquido: number;
    sdrs: any[]; closers: any[];
    formatBRL: (v: number) => string;
}) {
    const [metaProjeto, setMetaProjeto] = useState<{ meta_faturamento: number; meta_caixa: number } | null>(null);
    const [metasIndividuais, setMetasIndividuais] = useState<MetaUser[]>([]);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!projectId || !mes || !ano) return;
        // Project-level goal for summary bars
        fetch(`/api/metas-projeto?projectId=${projectId}&mes=${mes}&ano=${ano}`)
            .then(r => r.json())
            .then(d => {
                if (d && (d.meta_faturamento > 0 || d.meta_caixa > 0)) setMetaProjeto(d);
                else setMetaProjeto(null);
            })
            .catch(() => setMetaProjeto(null));
        // Individual goals for expanded view
        fetch(`/api/metas?projectId=${projectId}&mes=${mes}&ano=${ano}`)
            .then(r => r.json())
            .then(d => setMetasIndividuais(Array.isArray(d) ? d : []))
            .catch(() => setMetasIndividuais([]));
    }, [projectId, mes, ano]);

    if (!metaProjeto) return null;

    const pctFat = metaProjeto.meta_faturamento > 0 ? parseFloat(((receitaBruta / metaProjeto.meta_faturamento) * 100).toFixed(1)) : 0;
    const pctCaixa = metaProjeto.meta_caixa > 0 ? parseFloat(((caixaLiquido / metaProjeto.meta_caixa) * 100).toFixed(1)) : 0;

    const ProgressBar = ({ label, current, goal, pct, color, slim }: { label: string; current: number; goal: number; pct: number; color: string; slim?: boolean }) => {
        const over = pct > 100;
        const overExtra = over ? parseFloat((pct - 100).toFixed(1)) : 0;
        const displayLabel = over ? `100% +${overExtra}%` : `${pct}%`;
        const bonusColor = '#FFD700'; // Dourado pra representar o excedente na barra
        const displayColor = over ? bonusColor : color;

        // Se over, a "meta"(100) comprimiu pra dar espaço pro extra na mesma escala, ou seja: (100 / pct)%
        const widthBase = over ? (100 / pct) * 100 : pct;
        const widthExtra = over ? ((pct - 100) / pct) * 100 : 0;

        return (
        <div className="flex-1 min-w-[140px]">
            <div className="flex justify-between items-baseline mb-1">
                <span className={`${slim ? 'text-[10px]' : 'text-xs'} font-bold text-white`}>{label}</span>
                <span className={`${slim ? 'text-[9px]' : 'text-[10px]'} font-black flex items-center gap-1`} style={{ color: displayColor }}>
                    {over && <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: bonusColor }} />}
                    {displayLabel}
                </span>
            </div>
            {/* ProgressBar container com overflow hidden para que as bordas da base e do extra não saiam quadradas nas pontas */}
            <div className={`${slim ? 'h-1.5' : 'h-2.5'} bg-[#111] rounded-full flex overflow-hidden`}>
                <div className="h-full transition-all duration-700 relative" style={{ width: `${widthBase}%`, background: color }}>
                    {/* O Pino de Chegada */}
                    {over && <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white z-10 shadow-[0_0_8px_rgba(255,255,255,0.8)]" title="Alcance da Meta" />} 
                </div>
                {over && (
                    <div className="h-full transition-all duration-700" style={{ width: `${widthExtra}%`, background: bonusColor }} />
                )}
            </div>
            {!slim && (
                <div className="flex justify-between text-[10px] mt-1" style={{ color: TEXT_SEC }}>
                    <span>{formatBRL(current)}</span>
                    <span className="flex items-center gap-1">
                        meta {formatBRL(goal)}
                        {over && <span style={{ color: bonusColor }}>(Bônus: {formatBRL(current - goal)})</span>}
                    </span>
                </div>
            )}
        </div>
        );
    };

    // Build a performanceMap from the perf data by user id
    const perfMap: Record<number, { fat: number; caixa: number }> = {};
    [...sdrs, ...closers].forEach((u: any) => {
        if (u.id) perfMap[u.id] = { fat: u.vgv || 0, caixa: u.caixa || 0 };
    });

    return (
        <div className="glass-panel p-4 sm:p-5 mb-6 border border-white/5 bg-[#151515] rounded-2xl">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ background: 'rgba(190,255,0,0.12)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BEFF00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                        </svg>
                    </div>
                    <span className="font-bold text-white text-sm">Acompanhamento de Metas</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full text-[#888] bg-white/5">Meta Geral do Time</span>
                </div>
                <button
                    onClick={() => setExpanded(v => !v)}
                    className="text-xs px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white transition flex items-center gap-1"
                >
                    {expanded ? 'Fechar' : 'Metas Individuais'}
                    <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
            </div>

            {/* Summary bars — driven by Meta Geral do Projeto */}
            <div className="flex flex-wrap gap-6">
                <ProgressBar label="Faturamento do Time" current={receitaBruta} goal={metaProjeto.meta_faturamento} pct={pctFat} color={LIME} />
                <ProgressBar label="Caixa do Time" current={caixaLiquido} goal={metaProjeto.meta_caixa} pct={pctCaixa} color="#22D3EE" />
            </div>

            {/* Expanded: individual goals per user */}
            {expanded && (
                <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {(['SDR', 'CLOSER'] as const).map(tipo => {
                        const groupMetas = metasIndividuais.filter(m => m.tipo === tipo);
                        if (groupMetas.length === 0) return null;
                        const colors = tipo === 'SDR'
                            ? ['#BEFF00','#A3E635','#84CC16','#65A30D','#4D7C0F']
                            : ['#22D3EE','#38BDF8','#60A5FA','#818CF8','#A78BFA'];
                        return (
                            <div key={tipo}>
                                <p className="text-[10px] uppercase font-bold tracking-wider mb-3" style={{ color: TEXT_SEC }}>
                                    {tipo === 'SDR' ? 'SDRs — Metas Individuais' : 'Closers — Metas Individuais'}
                                </p>
                                <div className="space-y-3">
                                    {groupMetas.map((user, i) => {
                                        const perf = perfMap[user.id_usuario] || { fat: 0, caixa: 0 };
                                        const uPctFat = user.meta_faturamento > 0 ? parseFloat(((perf.fat / user.meta_faturamento) * 100).toFixed(1)) : 0;
                                        const uPctCaixa = user.meta_caixa > 0 ? parseFloat(((perf.caixa / user.meta_caixa) * 100).toFixed(1)) : 0;
                                        return (
                                            <div key={user.id_usuario} className="p-3 bg-[#111] rounded-xl border border-white/5">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-black shrink-0"
                                                        style={{ background: colors[i % colors.length] }}>
                                                        {user.nome.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-xs font-semibold text-white truncate">{user.nome}</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-3">
                                                        <ProgressBar label="Fat." current={perf.fat} goal={user.meta_faturamento} pct={uPctFat} color={colors[i % colors.length]} slim />
                                                        <span className="text-[9px] text-[#555] whitespace-nowrap">{formatBRL(perf.fat)} / {formatBRL(user.meta_faturamento)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <ProgressBar label="Caixa" current={perf.caixa} goal={user.meta_caixa} pct={uPctCaixa} color={colors[i % colors.length] + 'BB'} slim />
                                                        <span className="text-[9px] text-[#555] whitespace-nowrap">{formatBRL(perf.caixa)} / {formatBRL(user.meta_caixa)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
// ─────────────────────────────────────────────────────────────────────────────


export default function Dashboard() {
    const { selectedProject, user } = useProject();
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [sdrs, setSdrs] = useState<any[]>([]);
    const [closers, setClosers] = useState<any[]>([]);
    const [sdrsToday, setSdrsToday] = useState<any[]>([]);
    const [closersToday, setClosersToday] = useState<any[]>([]);
    const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);

    const fetchMetrics = async (start?: string, end?: string) => {
        setIsLoading(true);
        try {
            const query = new URLSearchParams();
            if (start) query.set('startDate', start);
            if (end) query.set('endDate', end);
            if (selectedProject?.id_projeto) query.set('projectId', selectedProject.id_projeto.toString());
            
            const paramsToday = new URLSearchParams();
            if (selectedProject?.id_projeto) paramsToday.set('projectId', selectedProject.id_projeto.toString());

            const [metricsRes, perfRes, perfTodayRes] = await Promise.all([
                fetch(`/api/metrics?${query.toString()}`),
                fetch(`/api/performance?${query.toString()}`),
                fetch(`/api/performance?${paramsToday.toString()}`)
            ]);
            
            const data = await metricsRes.json();
            const perfData = await perfRes.json();
            const perfTodayData = await perfTodayRes.json();

            // ─── Single source of truth for Caixa per user ───────────────────────────
            // /api/metrics has the canonical per-user caixa (installment-aware, deduplicated).
            // Override the independently-calculated values from /api/performance so every
            // UI component (commission table, donut, MetasPanel goals) shows the same number.
            const closerCaixaMap: Record<string, number> = {};
            (data.comissaoCloserDetalhes || []).forEach((d: any) => {
                closerCaixaMap[d.nome] = d.caixa;
            });
            const sdrCaixaMap: Record<string, number> = {};
            (data.comissaoSdrDetalhes || []).forEach((d: any) => {
                sdrCaixaMap[d.nome] = d.caixa;
            });

            const normalizeClosers = (arr: any[]) =>
                arr.map((c: any) => ({
                    ...c,
                    caixa: closerCaixaMap[c.nome] ?? c.caixa ?? 0,
                }));
            const normalizeSdrs = (arr: any[]) =>
                arr.map((s: any) => ({
                    ...s,
                    caixa: sdrCaixaMap[s.nome] ?? s.caixa ?? 0,
                }));

            setMetrics(data);
            setSdrs(normalizeSdrs(perfData.sdr || []));
            setClosers(normalizeClosers(perfData.closer || []));
            setSdrsToday(normalizeSdrs(perfTodayData.sdr || []));
            setClosersToday(normalizeClosers(perfTodayData.closer || []));

            if (data.period) {
                if (!start) setStartDate(data.period.startDate);
                if (!end) setEndDate(data.period.endDate);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedProject) return;
        fetchMetrics(startDate, endDate);
    }, [selectedProject]);

    const formatBRL = (val: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

    const AMBER = '#FB923C';
    const cards = [
        { title: "Receita Bruta", value: formatBRL(metrics?.receita || 0), icon: TrendingUp, accent: LIME },
        { title: "Caixa Líquido", value: formatBRL(metrics?.caixaLiquido || 0), icon: DollarSign, accent: LIME },
        { title: "Pgtos. Pendentes", value: formatBRL(metrics?.pagamentosPendentes || 0), icon: Clock, accent: AMBER, badge: '⏳ A receber' },
        { title: "Leads Totais", value: metrics?.leadsTotais || 0, icon: Users, accent: LIME },
        { title: "Vendas Concluídas", value: metrics?.vendasTotais || 0, icon: BriefcaseBusiness, accent: LIME },
        { title: "Taxa de Conversão", value: `${metrics?.conversaoAproximada || 0}%`, icon: Activity, accent: LIME },
    ];

    const CHART_COLORS = [LIME, '#22D3EE', '#A78BFA', '#FB923C', '#F472B6'];

    const tooltipStyle = {
        contentStyle: {
            background: '#1A1A1A',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#FFFFFF',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        },
        cursor: { fill: 'rgba(255,255,255,0.03)' }
    };

    const renderTicketDonut = (title: string, data: any[] | undefined) => {
        const total = data?.reduce((acc, curr) => acc + curr.value, 0) || 0;
        return (
            <div className="glass-panel p-4 rounded-xl flex flex-col items-center border border-white/5">
                <h3 className="text-[10px] w-full font-bold text-white mb-1 truncate" title={title}>{title}</h3>
                <div className="w-full" style={{ height: 140 }}>
                    {data && data.length > 0 ? (
                        <ResponsiveContainer width="100%" height={140}>
                            <PieChart>
                                <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value" label={false}>
                                    {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyle.contentStyle} formatter={(v: any) => formatBRL(v)} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full w-full flex items-center justify-center border-2 border-dashed rounded-xl text-[10px]" style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>Sem dados</div>
                    )}
                </div>
                {data && data.length > 0 && (
                    <div className="mt-2 w-full space-y-1 border-t border-white/5 pt-2">
                        {data.slice(0, 3).map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="text-[#aaa] truncate max-w-[90px]">{d.name}</span></div>
                                <span className="text-white font-bold">{formatBRL(d.value)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="pt-4 h-full flex flex-col relative" style={{ minHeight: '100vh' }}>
            {/* Header e Filtros (mantidos iguais) */}
            <div className="mb-8 flex flex-col lg:flex-row justify-between lg:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Dashboard Executivo</h2>
                    <p className="mt-1 text-sm" style={{ color: TEXT_SEC }}>Visão geral financeira e de performance da operação.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-end gap-3">
                    <button 
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`flex items-center gap-2 px-4 py-2 font-bold rounded-lg border transition-all ${isEditMode ? 'bg-[#BEFF00] text-black border-[#BEFF00]' : 'bg-[#111] text-[#888] border-[#2A2A2A] hover:text-white hover:border-[#444]'}`}
                        style={{ height: '42px' }}
                    >
                        <Settings size={16} />
                        {isEditMode ? 'Salvar Layout' : 'Layout'}
                    </button>
                    <div className="flex flex-col sm:flex-row items-center gap-3 p-2 rounded-xl" style={{ background: DARK, border: `1px solid ${BORDER}` }}>
                    <div className="flex flex-col w-full sm:w-auto">
                        <span className="text-[10px] uppercase font-bold px-2" style={{ color: TEXT_SEC }}>Data Inicial</span>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-sm font-medium text-white outline-none focus:ring-0 p-1 w-full" />
                    </div>
                    <span className="hidden sm:inline" style={{ color: '#333' }}>–</span>
                    <div className="flex flex-col w-full sm:w-auto">
                        <span className="text-[10px] uppercase font-bold px-2" style={{ color: TEXT_SEC }}>Data Final</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-sm font-medium text-white outline-none focus:ring-0 p-1 w-full" />
                    </div>
                    <button onClick={() => fetchMetrics(startDate, endDate)} className="w-full sm:w-auto btn-primary py-2 px-4 text-sm whitespace-nowrap sm:ml-2">Filtrar</button>
                </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                {cards.map((card, idx) => {
                    const Icon = card.icon;
                    const accent = card.accent || LIME;
                    const isAmber = accent === AMBER;
                    return (
                        <div key={idx} className="glass-panel p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform"
                            style={isAmber ? { borderColor: 'rgba(251,146,60,0.25)' } : {}}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2.5 rounded-lg" style={{ background: isAmber ? 'rgba(251,146,60,0.12)' : 'rgba(190,255,0,0.12)' }}>
                                    <Icon style={{ color: accent }} size={20} />
                                </div>
                                <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full"
                                    style={{ background: isAmber ? 'rgba(251,146,60,0.12)' : 'rgba(190,255,0,0.12)', color: accent }}>
                                    {isAmber ? (
                                        <><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} /><span>{(card as any).badge}</span></>
                                    ) : (
                                        <><ArrowUpRight size={12} /><span>Acima</span></>
                                    )}
                                </div>
                            </div>
                            <div>
                                <h3 className="font-medium text-sm mb-1" style={{ color: TEXT_SEC }}>{card.title}</h3>
                                {isLoading ? (
                                    <div className="h-7 w-24 rounded animate-pulse" style={{ background: '#2A2A2A' }}></div>
                                ) : (
                                    <p className="text-2xl font-black" style={{ color: isAmber && (metrics?.pagamentosPendentes || 0) > 0 ? AMBER : 'white' }}>
                                        {metrics ? card.value : '...'}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Acompanhamento de Metas ──────────────────────────────────── */}
            <MetasPanel
                projectId={selectedProject?.id_projeto?.toString()}
                mes={startDate ? parseInt(startDate.split('-')[1]) : (new Date().getMonth() + 1)}
                ano={startDate ? parseInt(startDate.split('-')[0]) : new Date().getFullYear()}
                receitaBruta={metrics?.receita || 0}
                caixaLiquido={metrics?.caixaLiquido || 0}
                sdrs={sdrs}
                closers={closers}
                formatBRL={formatBRL}
            />

            {/* ── Main Dashboard Fluid Grid ─────────────────────────────────── */}
            <DashboardGrid 
                metrics={metrics} sdrs={sdrs} closers={closers} 
                formatBRL={formatBRL} CHART_COLORS={CHART_COLORS} 
                TEXT_SEC={TEXT_SEC} LIME={LIME} tooltipStyle={tooltipStyle}
                renderTicketDonut={renderTicketDonut}
                user={user} selectedProject={selectedProject}
                isEditMode={isEditMode}
            />
        </div>
    );
}
