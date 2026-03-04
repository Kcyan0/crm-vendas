"use client";

import { useState, useEffect } from "react";
import { BarChart2, TrendingUp, Users } from "lucide-react";
import { useProject } from "@/context/ProjectContext";

type SDRPerformance = {
    id: number;
    nome: string;
    conversasIniciadas: number;
    primeiraResposta: number;
    convitesEnviados: number;
    callMarcada: number;
    leadsQualificados: number;
    agendamentosHoje: number;
    isManual?: boolean;
};

type CloserPerformance = {
    id: number;
    nome: string;
    callsAgendadas: number;
    reagendamentos: number;
    noShows: number;
    totalCalls: number;
    vendas: number;
    vgv: number;
    caixa: number;
    isManual?: boolean;
};

export default function PerformancePage() {
    const [sdrs, setSdrs] = useState<SDRPerformance[]>([]);
    const [closers, setClosers] = useState<CloserPerformance[]>([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState("");
    const { selectedProject } = useProject();

    const fetchPerformance = async (filterDate?: string) => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            if (filterDate) query.set('date', filterDate);
            if (selectedProject?.id_projeto) query.set('projectId', selectedProject.id_projeto.toString());

            const res = await fetch(`/api/performance?${query.toString()}`);
            const data = await res.json();
            setSdrs(data.sdr || []);
            setClosers(data.closer || []);
            if (data.period && !filterDate) {
                setDate(data.period.date);
            }
        } catch (error) {
            console.error("Failed to fetch performance metrics:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedProject) return;
        fetchPerformance();
    }, [selectedProject]);

    const handleDateChange = () => {
        fetchPerformance(date);
    };

    const handleMetricEdit = async (userId: number, isSDR: boolean, metricKey: string, newValue: string) => {
        const parsedValue = parseInt(newValue, 10);
        if (isNaN(parsedValue)) return; // Ignore invalid typing

        // Optimistic UI update
        if (isSDR) {
            setSdrs(prev => prev.map(s => s.id === userId ? { ...s, [metricKey]: parsedValue, isManual: true } : s));
        } else {
            setClosers(prev => prev.map(c => c.id === userId ? { ...c, [metricKey]: parsedValue, isManual: true } : c));
        }

        // Send to backend
        try {
            const user = isSDR ? sdrs.find(s => s.id === userId) : closers.find(c => c.id === userId);
            if (!user) return;

            const updatedMetrics = { ...user, [metricKey]: parsedValue };

            await fetch("/api/performance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id_usuario: userId,
                    data_referencia: date,
                    isSDR,
                    metrics: updatedMetrics
                })
            });
        } catch (error) {
            console.error("Error saving manual metric", error);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="pt-4 h-full flex flex-col space-y-8 pb-12">
            <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                        <BarChart2 className="text-orange-500" size={32} />
                        Performance do Time
                    </h2>
                    <p className="text-slate-500 mt-1">Acompanhe as métricas de produtividade e conversão de SDRs e Closers.</p>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400 px-2">Data</span>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent border-none text-sm font-medium text-slate-700 outline-none focus:ring-0 p-1" />
                    </div>
                    <button onClick={handleDateChange} className="btn-primary py-2 px-4 text-sm whitespace-nowrap ml-2">Filtrar</button>
                </div>
            </div>

            {/* SDR Performance Table */}
            <div className="glass-panel text-left p-6 h-fit bg-white border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Users size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Métricas de SDRs</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="pb-3 pt-2 px-4 font-semibold text-slate-500 text-sm">SDR</th>
                                <th className="pb-3 pt-2 px-4 font-semibold text-slate-500 text-sm text-center">Conversas Inic.</th>
                                <th className="pb-3 pt-2 px-4 font-semibold text-slate-500 text-sm text-center">1ª Resposta</th>
                                <th className="pb-3 pt-2 px-4 font-semibold text-slate-500 text-sm text-center">Convites Env.</th>
                                <th className="pb-3 pt-2 px-4 font-semibold text-slate-500 text-sm text-center">Leads Qualif.</th>
                                <th className="pb-3 pt-2 px-4 font-semibold text-slate-500 text-sm text-center">Calls Marcadas</th>
                                <th className="pb-3 pt-2 px-4 font-semibold text-orange-600 text-sm text-center bg-orange-50/50 rounded-t-lg">Agends. Hoje <span className="text-[10px] text-slate-400 font-normal block">(Automático)</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sdrs.map((sdr) => (
                                <tr key={sdr.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-4 px-4 font-bold text-slate-800">
                                        {sdr.nome}
                                        {sdr.isManual && <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Editado</span>}
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <input type="number" min="0" value={sdr.conversasIniciadas} onChange={(e) => handleMetricEdit(sdr.id, true, 'conversasIniciadas', e.target.value)} className="w-16 text-center font-medium text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-orange-300 focus:bg-white rounded p-1 transition-all outline-none" />
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <input type="number" min="0" value={sdr.primeiraResposta} onChange={(e) => handleMetricEdit(sdr.id, true, 'primeiraResposta', e.target.value)} className="w-16 text-center font-medium text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-orange-300 focus:bg-white rounded p-1 transition-all outline-none" />
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <input type="number" min="0" value={sdr.convitesEnviados} onChange={(e) => handleMetricEdit(sdr.id, true, 'convitesEnviados', e.target.value)} className="w-16 text-center font-medium text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-orange-300 focus:bg-white rounded p-1 transition-all outline-none" />
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <input type="number" min="0" value={sdr.leadsQualificados} onChange={(e) => handleMetricEdit(sdr.id, true, 'leadsQualificados', e.target.value)} className="w-16 text-center font-bold text-indigo-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-300 focus:bg-white rounded p-1 transition-all outline-none" />
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <input type="number" min="0" value={sdr.callMarcada} onChange={(e) => handleMetricEdit(sdr.id, true, 'callMarcada', e.target.value)} className="w-16 text-center font-bold text-emerald-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-300 focus:bg-white rounded p-1 transition-all outline-none" />
                                    </td>
                                    <td className="py-4 px-4 text-center font-bold text-orange-600 bg-orange-50/30">{sdr.agendamentosHoje}</td>
                                </tr>
                            ))}
                            {sdrs.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-slate-400">Nenhum SDR encontrado ou ativo.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Closer Performance Table */}
            <div className="glass-panel text-left p-6 h-fit bg-white border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                        <TrendingUp size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Métricas de Closers</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="pb-3 pt-2 px-4 font-semibold text-slate-500 text-sm">Closer</th>
                                <th className="pb-3 pt-2 px-4 font-semibold text-slate-500 text-sm text-center">Total Calls</th>
                                <th className="pb-3 pt-2 px-4 font-semibold text-slate-500 text-sm text-center">Calls Agendadas</th>
                                <th className="pb-3 pt-2 px-4 font-semibold text-slate-500 text-sm text-center">Reagendamentos</th>
                                <th className="pb-3 pt-2 px-4 font-semibold text-rose-500 text-sm text-center">No Shows</th>
                                <th className="pb-3 pt-2 px-4 font-semibold text-emerald-600 text-sm text-center bg-emerald-50/50 rounded-tl-lg">Vendas <span className="text-[10px] text-slate-400 font-normal block">(Automático)</span></th>
                                <th className="pb-3 pt-2 px-4 font-semibold text-emerald-700 text-sm text-right bg-emerald-50/50">VGV <span className="text-[10px] text-slate-400 font-normal block">(Automático)</span></th>
                                <th className="pb-3 pt-2 px-4 font-semibold text-emerald-800 text-sm text-right bg-emerald-50/50 rounded-tr-lg">Caixa <span className="text-[10px] text-slate-400 font-normal block">(Automático)</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {closers.map((closer) => (
                                <tr key={closer.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-4 px-4 font-bold text-slate-800">
                                        {closer.nome}
                                        {closer.isManual && <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Editado</span>}
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <input type="number" min="0" value={closer.totalCalls} onChange={(e) => handleMetricEdit(closer.id, false, 'totalCalls', e.target.value)} className="w-16 text-center font-medium text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-300 focus:bg-white rounded p-1 transition-all outline-none" />
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <input type="number" min="0" value={closer.callsAgendadas} onChange={(e) => handleMetricEdit(closer.id, false, 'callsAgendadas', e.target.value)} className="w-16 text-center font-medium text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-300 focus:bg-white rounded p-1 transition-all outline-none" />
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <input type="number" min="0" value={closer.reagendamentos} onChange={(e) => handleMetricEdit(closer.id, false, 'reagendamentos', e.target.value)} className="w-16 text-center font-medium text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-300 focus:bg-white rounded p-1 transition-all outline-none" />
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <input type="number" min="0" value={closer.noShows} onChange={(e) => handleMetricEdit(closer.id, false, 'noShows', e.target.value)} className="w-16 text-center font-bold text-rose-500 bg-transparent border border-transparent hover:border-slate-200 focus:border-rose-300 focus:bg-white rounded p-1 transition-all outline-none" />
                                    </td>
                                    <td className="py-4 px-4 text-center font-bold text-emerald-600 bg-emerald-50/30">{closer.vendas}</td>
                                    <td className="py-4 px-4 text-right font-bold text-emerald-700 bg-emerald-50/30">{formatCurrency(closer.vgv)}</td>
                                    <td className="py-4 px-4 text-right font-black text-emerald-800 bg-emerald-50/30">{formatCurrency(closer.caixa)}</td>
                                </tr>
                            ))}
                            {closers.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-slate-400">Nenhum Closer encontrado ou ativo.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
