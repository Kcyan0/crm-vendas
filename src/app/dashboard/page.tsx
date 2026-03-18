"use client";

import { useState, useEffect } from "react";
import {
    TrendingUp,
    DollarSign,
    Users,
    BriefcaseBusiness,
    Activity,
    ArrowUpRight
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
    leadsTotais: number;
    vendasTotais: number;
    conversaoAproximada: string;
    receitaPorPagamento?: { name: string; value: number }[];
    ticketMedio: number;
    receitaPorCloser?: { name: string; value: number }[];
    receitaPorSdr?: { name: string; value: number }[];
};

const DARK = '#1A1A1A';
const BORDER = 'rgba(255,255,255,0.07)';
const LIME = '#BEFF00';
const TEXT_SEC = '#888888';

export default function Dashboard() {
    const { selectedProject } = useProject();
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [sdrs, setSdrs] = useState<any[]>([]);
    const [closers, setClosers] = useState<any[]>([]);
    const [sdrsToday, setSdrsToday] = useState<any[]>([]);
    const [closersToday, setClosersToday] = useState<any[]>([]);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [isLoading, setIsLoading] = useState(true);

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

            setMetrics(data);
            setSdrs(perfData.sdr || []);
            setClosers(perfData.closer || []);
            setSdrsToday(perfTodayData.sdr || []);
            setClosersToday(perfTodayData.closer || []);

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

    const cards = [
        { title: "Receita Bruta", value: formatBRL(metrics?.receita || 0), icon: TrendingUp },
        { title: "Caixa Líquido", value: formatBRL(metrics?.caixaLiquido || 0), icon: DollarSign },
        { title: "Leads Totais", value: metrics?.leadsTotais || 0, icon: Users },
        { title: "Vendas Concluídas", value: metrics?.vendasTotais || 0, icon: BriefcaseBusiness },
        { title: "Taxa de Conversão", value: `${metrics?.conversaoAproximada || 0}%`, icon: Activity },
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

    const [zoomedSection, setZoomedSection] = useState<string | null>(null);

    return (
        <div className="pt-4 h-full flex flex-col relative" style={{ minHeight: '100vh' }}>
            {/* Overlay backdrop */}
            {zoomedSection && (
                <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setZoomedSection(null)} />
            )}
            {/* Header e Filtros (mantidos iguais) */}
            <div className="mb-8 flex flex-col lg:flex-row justify-between lg:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Dashboard Executivo</h2>
                    <p className="mt-1 text-sm" style={{ color: TEXT_SEC }}>Visão geral financeira e de performance da operação.</p>
                </div>

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

            {/* KPI Cards (mantidos iguais) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
                {cards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <div key={idx} className="glass-panel p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2.5 rounded-lg" style={{ background: 'rgba(190,255,0,0.12)' }}>
                                    <Icon style={{ color: LIME }} size={20} />
                                </div>
                                <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full"
                                    style={{ background: 'rgba(190,255,0,0.12)', color: LIME }}>
                                    <ArrowUpRight size={12} />
                                    <span>Acima</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-medium text-sm mb-1" style={{ color: TEXT_SEC }}>{card.title}</h3>
                                {isLoading ? (
                                    <div className="h-7 w-24 rounded animate-pulse" style={{ background: '#2A2A2A' }}></div>
                                ) : (
                                    <p className="text-2xl font-black text-white">{metrics ? card.value : '...'}</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Grid Container for Dashboard Boxes */}
            <div className={`grid grid-cols-1 xl:grid-cols-2 gap-6 pb-8 ${zoomedSection ? 'flex-1' : ''}`}>

            {/* Zoomable Box: Performance Comercial */}
            <div className={`transition-all duration-300 ${zoomedSection === 'performance' ? 'fixed inset-6 md:inset-12 lg:inset-20 z-50 glass-panel rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95' : zoomedSection ? 'hidden' : 'glass-panel rounded-xl overflow-hidden relative group flex flex-col'}`}>
                <div className="p-4 sm:p-5 flex items-center justify-between font-bold text-lg text-white select-none border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-2">
                        <Activity size={20} style={{ color: LIME }} />
                        Performance Comercial
                    </div>
                    {zoomedSection === 'performance' ? (
                        <button onClick={() => setZoomedSection(null)} className="flex items-center gap-2 text-sm px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition">
                            <span className="hidden sm:inline">Fechar Zoom</span>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    ) : (
                        <button onClick={() => setZoomedSection('performance')} className="flex items-center gap-2 text-xs sm:text-sm px-3 py-1.5 bg-transparent hover:bg-white/10 rounded-lg transition opacity-0 group-hover:opacity-100 ring-1 ring-white/10">
                            <span className="hidden sm:inline">Expandir</span>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                        </button>
                    )}
                </div>
                
                <div className="p-4 overflow-hidden flex-1 flex flex-col">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full flex-1">
                        {/* SDRs Período */}
                        <div className="flex flex-col">
                            <h3 className="text-xs sm:text-sm font-bold text-white mb-2">SDRs (Período)</h3>
                            <div className={`flex-1 w-full ${zoomedSection === 'performance' ? 'min-h-[250px]' : 'min-h-[140px]'}`}>
                                {sdrs.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={sdrs} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                            <Tooltip {...tooltipStyle} />
                                            <Legend wrapperStyle={{ paddingTop: '8px', color: TEXT_SEC, fontSize: 11 }} />
                                            <Bar dataKey="conversasIniciadas" name="Conversas" fill={LIME} radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="leadsQualificados" name="Qualificados" fill="#22D3EE" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="callMarcada" name="Calls" fill="#A78BFA" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-xs" style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>
                                        Sem dados no período
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Closers Período */}
                        <div className="flex flex-col">
                            <h3 className="text-xs sm:text-sm font-bold text-white mb-2">Closers (Período)</h3>
                            <div className={`flex-1 w-full ${zoomedSection === 'performance' ? 'min-h-[250px]' : 'min-h-[140px]'}`}>
                                {closers.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={closers} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                            <Tooltip {...tooltipStyle} />
                                            <Legend wrapperStyle={{ paddingTop: '8px', color: TEXT_SEC, fontSize: 11 }} />
                                            <Bar dataKey="totalCalls" name="Total Calls" fill="#888888" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="vendas" name="Vendas" fill={LIME} radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-xs" style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>
                                        Sem dados no período
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SDRs Hoje */}
                        <div className="flex flex-col">
                            <h3 className="text-xs sm:text-sm font-bold text-white mb-2">SDRs (Hoje)</h3>
                            <div className={`flex-1 w-full ${zoomedSection === 'performance' ? 'min-h-[250px]' : 'min-h-[140px]'}`}>
                                {sdrsToday.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={sdrsToday} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                            <Tooltip {...tooltipStyle} />
                                            <Legend wrapperStyle={{ paddingTop: '8px', color: TEXT_SEC, fontSize: 11 }} />
                                            <Bar dataKey="conversasIniciadas" name="Conversas" fill={LIME} radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="leadsQualificados" name="Qualificados" fill="#22D3EE" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="callMarcada" name="Calls" fill="#A78BFA" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-xs" style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>
                                        Sem dados hoje
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Closers Hoje */}
                        <div className="flex flex-col">
                            <h3 className="text-xs sm:text-sm font-bold text-white mb-2">Closers (Hoje)</h3>
                            <div className={`flex-1 w-full ${zoomedSection === 'performance' ? 'min-h-[250px]' : 'min-h-[140px]'}`}>
                                {closersToday.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={closersToday} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                            <Tooltip {...tooltipStyle} />
                                            <Legend wrapperStyle={{ paddingTop: '8px', color: TEXT_SEC, fontSize: 11 }} />
                                            <Bar dataKey="totalCalls" name="Total Calls" fill="#888888" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="vendas" name="Vendas" fill={LIME} radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-xs" style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>
                                        Sem dados hoje
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Zoomable Box: Receita */}
            <div className={`transition-all duration-300 ${zoomedSection === 'receita' ? 'fixed inset-6 md:inset-12 lg:inset-20 z-50 glass-panel rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95' : zoomedSection ? 'hidden' : 'glass-panel rounded-xl overflow-hidden relative group flex flex-col'}`}>
                <div className="p-4 sm:p-5 flex items-center justify-between font-bold text-lg text-white select-none border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-2">
                        <DollarSign size={20} style={{ color: LIME }} />
                        Receita e Pagamentos
                    </div>
                    {zoomedSection === 'receita' ? (
                        <button onClick={() => setZoomedSection(null)} className="flex items-center gap-2 text-sm px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition">
                            <span className="hidden sm:inline">Fechar Zoom</span>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    ) : (
                        <button onClick={() => setZoomedSection('receita')} className="flex items-center gap-2 text-xs sm:text-sm px-3 py-1.5 bg-transparent hover:bg-white/10 rounded-lg transition opacity-0 group-hover:opacity-100 ring-1 ring-white/10">
                            <span className="hidden sm:inline">Expandir</span>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                        </button>
                    )}
                </div>
                
                <div className="p-4 overflow-hidden flex-1 flex flex-col">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full flex-1">

                        {/* Receita por Forma de Pagamento */}
                        <div className="flex flex-col">
                            <h3 className="text-xs sm:text-sm font-bold text-white mb-2">Por Forma de Pagamento</h3>
                            <div className={`flex-1 w-full flex items-center justify-center overflow-hidden ${zoomedSection === 'receita' ? 'min-h-[250px]' : 'min-h-[140px]'}`}>
                                {metrics?.receitaPorPagamento && metrics.receitaPorPagamento.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={metrics.receitaPorPagamento}
                                                cx="50%" cy="50%"
                                                innerRadius={zoomedSection === 'receita' ? 60 : 30} 
                                                outerRadius={zoomedSection === 'receita' ? 100 : 50}
                                                paddingAngle={5} dataKey="value"
                                                label={({ name, percent }: any) => zoomedSection === 'receita' ? `${name} ${percent ? (percent * 100).toFixed(0) : 0}%` : null}
                                                labelLine={zoomedSection === 'receita'}
                                            >
                                                {metrics.receitaPorPagamento.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle.contentStyle} formatter={(value: any) => formatBRL(value)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center border-2 border-dashed rounded-xl text-xs" style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>
                                        Nenhum pagamento
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Ticket Médio */}
                        <div className="flex flex-col">
                            <h3 className="text-xs sm:text-sm font-bold text-white mb-2">Ticket Médio</h3>
                            <div className={`flex-1 w-full flex items-center justify-center ${zoomedSection === 'receita' ? 'min-h-[250px]' : 'min-h-[140px]'}`}>
                                <div className="text-center">
                                    <div className={`rounded-full inline-flex ${zoomedSection === 'receita' ? 'p-4 mb-4' : 'p-2 mb-2'}`} style={{ background: 'rgba(190,255,0,0.1)' }}>
                                        <DollarSign size={zoomedSection === 'receita' ? 32 : 20} style={{ color: LIME }} />
                                    </div>
                                    <div className={`font-black text-white ${zoomedSection === 'receita' ? 'text-4xl' : 'text-xl'}`}>{formatBRL(metrics?.ticketMedio || 0)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Receita por Closer */}
                        <div className="flex flex-col">
                            <h3 className="text-xs sm:text-sm font-bold text-white mb-2">Receita por Closer</h3>
                            <div className={`flex-1 w-full ${zoomedSection === 'receita' ? 'min-h-[250px]' : 'min-h-[140px]'}`}>
                                {metrics?.receitaPorCloser && metrics.receitaPorCloser.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={metrics.receitaPorCloser} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} tickFormatter={(val) => `R$${val/1000}k`} />
                                            <Tooltip {...tooltipStyle} formatter={(value: any) => formatBRL(value)} />
                                            <Bar dataKey="value" name="Receita" fill="#A78BFA" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-xs" style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>
                                        Sem vendas
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Receita por SDR */}
                        <div className="flex flex-col">
                            <h3 className="text-xs sm:text-sm font-bold text-white mb-2">Receita por Origem (SDR)</h3>
                            <div className={`flex-1 w-full ${zoomedSection === 'receita' ? 'min-h-[250px]' : 'min-h-[140px]'}`}>
                                {metrics?.receitaPorSdr && metrics.receitaPorSdr.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={metrics.receitaPorSdr} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} tickFormatter={(val) => `R$${val/1000}k`} />
                                            <Tooltip {...tooltipStyle} formatter={(value: any) => formatBRL(value)} />
                                            <Bar dataKey="value" name="Receita" fill="#22D3EE" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-xs" style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>
                                        Sem vendas
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            </div> {/* End of grid container */}
        </div>
    );
}
