"use client";

import { useState, useEffect, useCallback } from "react";
import {
    DollarSign, TrendingUp, Users, ShoppingCart, Percent, Loader2, Calendar, ChevronDown, RefreshCw
} from "lucide-react";
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";

type ProjectMetric = {
    id_projeto: number;
    nome: string;
    receita: number;
    caixa: number;
    vendas: number;
    leads: number;
    conversao: number;
    chargebackRate: number;
    ticketFaturamento: number;
    ticketCaixa: number;
};

type OverviewData = {
    totalReceita: number;
    totalCaixa: number;
    totalVendas: number;
    totalLeads: number;
    totalConversao: number;
    totalTicket: number;
    byProject: ProjectMetric[];
    period: { startDate: string; endDate: string };
};

const COLORS = ['#BEFF00', '#00E5FF', '#FF6B6B', '#FFB347', '#A78BFA', '#34D399', '#F472B6', '#60A5FA'];
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

const today = new Date();
const firstDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

const PRESETS = [
    { label: 'Este mês', start: firstDay, end: lastDay },
    { label: 'Últimos 7 dias', start: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0], end: today.toISOString().split('T')[0] },
    { label: 'Últimos 30 dias', start: new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0], end: today.toISOString().split('T')[0] },
    { label: 'Últimos 3 meses', start: new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().split('T')[0], end: lastDay },
];

function KpiCard({ icon: Icon, label, value, sub, color = '#BEFF00' }: {
    icon: any; label: string; value: string; sub?: string; color?: string;
}) {
    return (
        <div className="glass-panel bg-[#1A1A1A] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#888] uppercase tracking-wider">{label}</span>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: color + '20' }}>
                    <Icon size={16} style={{ color }} />
                </div>
            </div>
            <div>
                <p className="text-2xl font-black text-white">{value}</p>
                {sub && <p className="text-xs text-[#666] mt-1">{sub}</p>}
            </div>
        </div>
    );
}

function DonutChart({ data, title, subtitle, format }: {
    data: { name: string; value: number }[];
    title: string;
    subtitle: string;
    format: (v: number) => string;
}) {
    const total = data.reduce((s, d) => s + d.value, 0);
    return (
        <div className="glass-panel bg-[#1A1A1A] p-5 flex flex-col">
            <div className="mb-4">
                <h4 className="text-base font-bold text-white">{title}</h4>
                <p className="text-xs text-[#666] mt-0.5">{subtitle}</p>
            </div>
            <div className="flex gap-4 flex-1 min-h-0">
                <div className="flex-1 min-w-0" style={{ minHeight: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data.filter(d => d.value > 0)}
                                cx="50%" cy="50%"
                                innerRadius="55%" outerRadius="80%"
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v: any) => format(v)} contentStyle={{ background: '#1A1A1A', border: '1px solid #333', borderRadius: 10 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex flex-col justify-center gap-2 min-w-[160px]">
                    <div className="flex justify-between text-[10px] font-bold text-[#555] uppercase mb-1 px-1">
                        <span>Projeto</span><span>Valor</span>
                    </div>
                    {data.map((d, i) => (
                        <div key={d.name} className="flex items-center justify-between gap-2 px-1">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                                <span className="text-xs text-[#aaa] truncate">{d.name}</span>
                            </div>
                            <span className="text-xs font-bold text-white shrink-0">{format(d.value)}</span>
                        </div>
                    ))}
                    <div className="border-t border-[#2A2A2A] mt-1 pt-1 flex justify-between px-1">
                        <span className="text-[10px] font-bold text-[#555] uppercase">Total</span>
                        <span className="text-xs font-black text-[#BEFF00]">{format(total)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function OverviewPage() {
    const [data, setData] = useState<OverviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);
    const [presetOpen, setPresetOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/overview?startDate=${startDate}&endDate=${endDate}`);
            const json = await res.json();
            setData(json);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const applyPreset = (s: string, e: string) => {
        setStartDate(s);
        setEndDate(e);
        setPresetOpen(false);
    };

    const projects = data?.byProject || [];

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Visão Geral</h2>
                    <p className="text-[#888] mt-1 text-sm">Métricas consolidadas de todos os projetos que você tem acesso.</p>
                </div>

                {/* Period picker */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-3 py-2">
                        <Calendar size={14} className="text-[#BEFF00]" />
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                            className="bg-transparent text-white text-sm outline-none w-32" />
                        <span className="text-[#555] text-sm">–</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                            className="bg-transparent text-white text-sm outline-none w-32" />
                    </div>

                    <div className="relative">
                        <button onClick={() => setPresetOpen(v => !v)}
                            className="flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm rounded-xl px-3 py-2 hover:border-[#BEFF00] transition">
                            Período <ChevronDown size={14} />
                        </button>
                        {presetOpen && (
                            <div className="absolute right-0 top-full mt-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden z-10 min-w-[160px]">
                                {PRESETS.map(p => (
                                    <button key={p.label} onClick={() => applyPreset(p.start, p.end)}
                                        className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-[#2A2A2A] transition">
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button onClick={fetchData} disabled={loading}
                        className="flex items-center gap-2 bg-[#BEFF00] text-[#0A0A0A] font-bold text-sm rounded-xl px-4 py-2 hover:bg-[#A8E800] transition">
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Atualizar
                    </button>
                </div>
            </div>

            {loading && !data ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 size={36} className="animate-spin text-[#BEFF00]" />
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <KpiCard icon={DollarSign} label="Receita Total" value={fmt(data?.totalReceita || 0)} sub={`${data?.totalVendas || 0} venda(s) no período`} color="#BEFF00" />
                        <KpiCard icon={TrendingUp} label="Ticket Médio" value={fmt(data?.totalTicket || 0)} sub="Receita Total / Vendas" color="#00E5FF" />
                        <KpiCard icon={ShoppingCart} label="Caixa Líquido" value={fmt(data?.totalCaixa || 0)} sub="Caixa gerado no período" color="#A78BFA" />
                        <KpiCard icon={Users} label="Leads no Período" value={String(data?.totalLeads || 0)} sub="Leads com entrada no período" color="#FFB347" />
                        <KpiCard icon={Percent} label="Taxa de Conversão" value={`${data?.totalConversao || 0}%`} sub="Conversões / Leads" color="#FF6B6B" />
                    </div>

                    {/* Charts row 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <DonutChart
                            data={projects.map(p => ({ name: p.nome, value: p.receita }))}
                            title="Receita por Projeto"
                            subtitle="Receita total gerada."
                            format={fmt}
                        />
                        <DonutChart
                            data={projects.map(p => ({ name: p.nome, value: p.caixa }))}
                            title="Caixa Gerado por Projeto"
                            subtitle="Caixa líquido gerado."
                            format={fmt}
                        />
                    </div>

                    {/* Charts row 2 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <DonutChart
                            data={projects.map(p => ({ name: p.nome, value: p.ticketFaturamento }))}
                            title="Ticket Médio (Faturamento) por Projeto"
                            subtitle="Valor médio da venda."
                            format={fmt}
                        />
                        <DonutChart
                            data={projects.map(p => ({ name: p.nome, value: p.ticketCaixa }))}
                            title="Ticket Médio (Caixa) por Projeto"
                            subtitle="Valor médio de caixa gerado."
                            format={fmt}
                        />
                    </div>

                    {/* Bar chart leads */}
                    <div className="glass-panel bg-[#1A1A1A] p-5">
                        <h4 className="text-base font-bold text-white mb-1">Leads por Projeto</h4>
                        <p className="text-xs text-[#666] mb-4">Leads totais no período.</p>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={projects} barSize={36}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                                <XAxis dataKey="nome" tick={{ fill: '#888', fontSize: 12 }} />
                                <YAxis tick={{ fill: '#888', fontSize: 12 }} />
                                <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #333', borderRadius: 10 }} />
                                <Bar dataKey="leads" name="Leads" fill="#BEFF00" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Conversion table */}
                    <div className="glass-panel bg-[#1A1A1A] p-5">
                        <h4 className="text-base font-bold text-white mb-1">Conversão por Projeto</h4>
                        <p className="text-xs text-[#666] mb-4">Performance de cada item.</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-[#2A2A2A]">
                                        {['Projeto', 'Leads', 'Vendas', 'Taxa de Conv.', 'Ticket Fat.', 'Ticket Caixa', 'Chargeback'].map(h => (
                                            <th key={h} className="pb-3 pr-4 text-[10px] font-bold text-[#555] uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1E1E1E]">
                                    {projects.map((p, i) => (
                                        <tr key={p.id_projeto} className="hover:bg-[#111] transition">
                                            <td className="py-3 pr-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                                                    <span className="text-sm text-white font-semibold">{p.nome}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 pr-4 text-sm text-[#aaa]">{p.leads}</td>
                                            <td className="py-3 pr-4 text-sm text-[#aaa]">{p.vendas}</td>
                                            <td className="py-3 pr-4">
                                                <span className={`text-sm font-bold ${p.conversao >= 30 ? 'text-[#BEFF00]' : p.conversao >= 10 ? 'text-orange-400' : 'text-red-400'}`}>
                                                    {p.conversao}%
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 text-sm text-[#aaa]">{fmt(p.ticketFaturamento)}</td>
                                            <td className="py-3 pr-4 text-sm text-[#aaa]">{fmt(p.ticketCaixa)}</td>
                                            <td className="py-3">
                                                <span className={`text-sm font-bold ${p.chargebackRate > 10 ? 'text-red-400' : p.chargebackRate > 5 ? 'text-orange-400' : 'text-[#666]'}`}>
                                                    {p.chargebackRate}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {projects.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="py-8 text-center text-[#555] text-sm">Nenhum dado no período selecionado.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
