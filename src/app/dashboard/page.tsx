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
            const res = await fetch(`/api/metrics?${query.toString()}`);
            const data = await res.json();
            setMetrics(data);
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
        const perfQuery = new URLSearchParams();
        perfQuery.set('projectId', selectedProject.id_projeto.toString());
        fetch(`/api/performance?${perfQuery.toString()}`)
            .then(res => res.json())
            .then(data => {
                setSdrs(data.sdr || []);
                setClosers(data.closer || []);
            });
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

    return (
        <div className="pt-4 h-full flex flex-col">
            {/* Header */}
            <div className="mb-8 flex flex-col lg:flex-row justify-between lg:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Dashboard Executivo</h2>
                    <p className="mt-1 text-sm" style={{ color: TEXT_SEC }}>Visão geral financeira e de performance da operação.</p>
                </div>

                <div className="flex items-center gap-3 p-2 rounded-xl" style={{ background: DARK, border: `1px solid ${BORDER}` }}>
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold px-2" style={{ color: TEXT_SEC }}>Data Inicial</span>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-sm font-medium text-white outline-none focus:ring-0 p-1" />
                    </div>
                    <span style={{ color: '#333' }}>–</span>
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold px-2" style={{ color: TEXT_SEC }}>Data Final</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-sm font-medium text-white outline-none focus:ring-0 p-1" />
                    </div>
                    <button onClick={() => fetchMetrics(startDate, endDate)} className="btn-primary py-2 px-4 text-sm whitespace-nowrap ml-2">Filtrar</button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
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

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 mb-8">
                {/* SDRs */}
                <div className="glass-panel p-6 flex flex-col">
                    <h3 className="text-base font-bold text-white mb-4">Performance SDRs (Hoje)</h3>
                    <div className="flex-1 w-full min-h-[280px]">
                        {sdrs.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sdrs} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 12 }} />
                                    <Tooltip {...tooltipStyle} />
                                    <Legend wrapperStyle={{ paddingTop: '16px', color: TEXT_SEC }} />
                                    <Bar dataKey="conversasIniciadas" name="Conversas" fill={LIME} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="leadsQualificados" name="Qualificados" fill="#22D3EE" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="callMarcada" name="Calls" fill="#A78BFA" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-sm"
                                style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>
                                Sem dados para hoje.
                            </div>
                        )}
                    </div>
                </div>

                {/* Closers */}
                <div className="glass-panel p-6 flex flex-col">
                    <h3 className="text-base font-bold text-white mb-4">Performance Closers (Hoje)</h3>
                    <div className="flex-1 w-full min-h-[280px]">
                        {closers.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={closers} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 12 }} />
                                    <Tooltip {...tooltipStyle} />
                                    <Legend wrapperStyle={{ paddingTop: '16px', color: TEXT_SEC }} />
                                    <Bar dataKey="totalCalls" name="Total Calls" fill="#888888" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="vendas" name="Vendas" fill={LIME} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-sm"
                                style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>
                                Sem dados para hoje.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Pie Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="glass-panel p-6 flex flex-col">
                    <h3 className="text-base font-bold text-white mb-4">Receita por Forma de Pagamento</h3>
                    <div className="flex-1 w-full min-h-[280px] flex items-center justify-center">
                        {metrics?.receitaPorPagamento && metrics.receitaPorPagamento.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={metrics.receitaPorPagamento}
                                        cx="50%" cy="50%"
                                        innerRadius={60} outerRadius={100}
                                        paddingAngle={5} dataKey="value"
                                        label={({ name, percent }: any) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                                        labelLine={{ stroke: '#555' }}
                                    >
                                        {metrics.receitaPorPagamento.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle.contentStyle} formatter={(value: any) => formatBRL(value)} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full w-full flex items-center justify-center border-2 border-dashed rounded-xl text-sm"
                                style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>
                                Nenhum pagamento registrado no período.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
