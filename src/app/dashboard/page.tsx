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

        // Fetch performance for charts (defaults to today based on API)
        const perfQuery = new URLSearchParams();
        perfQuery.set('projectId', selectedProject.id_projeto.toString());

        fetch(`/api/performance?${perfQuery.toString()}`)
            .then(res => res.json())
            .then(data => {
                setSdrs(data.sdr || []);
                setClosers(data.closer || []);
            });
    }, [selectedProject]);

    const handleDateFilter = () => {
        fetchMetrics(startDate, endDate);
    };

    const formatBRL = (val: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL"
        }).format(val || 0);
    };

    const cards = [
        { title: "Receita Bruta", value: formatBRL(metrics?.receita || 0), icon: TrendingUp, color: "text-emerald-700", bg: "bg-emerald-100" },
        { title: "Caixa Líquido", value: formatBRL(metrics?.caixaLiquido || 0), icon: DollarSign, color: "text-indigo-700", bg: "bg-indigo-100" },
        { title: "Leads Totais", value: metrics?.leadsTotais || 0, icon: Users, color: "text-blue-700", bg: "bg-blue-100" },
        { title: "Vendas Concluídas", value: metrics?.vendasTotais || 0, icon: BriefcaseBusiness, color: "text-purple-700", bg: "bg-purple-100" },
        { title: "Taxa de Conversão", value: `${metrics?.conversaoAproximada || 0}%`, icon: Activity, color: "text-amber-700", bg: "bg-amber-100" },
    ];

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8b5cf6'];

    return (
        <div className="pt-4 h-full flex flex-col">
            <div className="mb-8 flex flex-col lg:flex-row justify-between lg:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Dashboard Executivo</h2>
                    <p className="text-slate-500 mt-1">Visão geral financeira e de performance da operação.</p>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400 px-2">Data Inicial</span>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-sm font-medium text-slate-700 outline-none focus:ring-0 p-1" />
                    </div>
                    <span className="text-slate-300">-</span>
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400 px-2">Data Final</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-sm font-medium text-slate-700 outline-none focus:ring-0 p-1" />
                    </div>
                    <button onClick={handleDateFilter} className="btn-primary py-2 px-4 text-sm whitespace-nowrap ml-2">Filtrar</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
                {cards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <div key={idx} className="glass-panel p-6 flex flex-col justify-between group hover:-translate-y-1 transition-transform">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-xl ${card.bg}`}>
                                    <Icon className={card.color} size={24} />
                                </div>
                                <div className="flex items-center gap-1 text-emerald-700 text-sm font-bold bg-emerald-100 px-2 py-1 rounded-full">
                                    <ArrowUpRight size={14} />
                                    <span>Excedente</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-slate-500 font-medium text-sm mb-1">{card.title}</h3>
                                {isLoading ? (
                                    <div className="h-8 w-24 bg-slate-200 animate-pulse rounded"></div>
                                ) : (
                                    <p className="text-2xl font-bold text-slate-800">{metrics ? card.value : '...'}</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 mb-8">
                {/* Gráfico SDRs */}
                <div className="glass-panel p-6 flex flex-col bg-white">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Performance SDRs (Hoje)</h3>
                    <div className="flex-1 w-full min-h-[300px]">
                        {sdrs.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={sdrs}
                                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: '#F1F5F9' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar dataKey="conversasIniciadas" name="Conversas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="leadsQualificados" name="Qualificados" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="callMarcada" name="Calls Marcadas" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                                Sem dados para hoje.
                            </div>
                        )}
                    </div>
                </div>

                {/* Gráfico Closers */}
                <div className="glass-panel p-6 flex flex-col bg-white">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Performance Closers (Hoje)</h3>
                    <div className="flex-1 w-full min-h-[300px]">
                        {closers.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={closers}
                                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: '#F1F5F9' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar dataKey="totalCalls" name="Total Calls" fill="#64748B" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="vendas" name="Vendas" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                                Sem dados para hoje.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 mb-8">
                <div className="glass-panel p-6 flex flex-col bg-white">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Receita por Forma de Pagamento (Faturamento Bruto)</h3>
                    <div className="flex-1 w-full min-h-[300px] flex items-center justify-center">
                        {metrics?.receitaPorPagamento && metrics.receitaPorPagamento.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={metrics.receitaPorPagamento}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }: any) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                                    >
                                        {metrics.receitaPorPagamento.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: any) => formatBRL(value)}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full w-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                                Nenhum pagamento registrado no período.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
