"use client";
import React, { useState, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableItem } from './SortableItem';
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

const DEFAULT_LAYOUT = [
    'statusLeads', 'sdrsPeriodo', 'closersPeriodo', 'conversaoSdr', 'conversaoCloser',
    'tmFatCloser', 'tmCaixaCloser', 'tmFatSdr', 'tmCaixaSdr',
    'recFat', 'recCaixa', 'recCloser', 'recSdr', 'reembolsos', 'comissaoCloser', 'comissaoSdr',
    'pagamentosPendentes'
];

export function DashboardGrid({
    metrics, sdrs, closers, formatBRL, CHART_COLORS, TEXT_SEC, LIME, tooltipStyle, renderTicketDonut,
    user, selectedProject, isEditMode
}: any) {
    const [layoutOrder, setLayoutOrder] = useState<string[]>(DEFAULT_LAYOUT);

    useEffect(() => {
        if (user?.email) {
            fetch(`/api/users/preferences?email=${user.email}`)
                .then(r => r.json())
                .then(data => {
                    const prefs = data.prefs || {};
                    const key = selectedProject?.id_projeto ? selectedProject.id_projeto.toString() : 'global';
                    if (prefs[key] && prefs[key].length > 0) {
                        // Merge with new blocks if they exist
                        const saved = prefs[key];
                        const missing = DEFAULT_LAYOUT.filter(id => !saved.includes(id));
                        setLayoutOrder([...saved, ...missing]);
                    } else {
                        setLayoutOrder(DEFAULT_LAYOUT);
                    }
                })
                .catch(err => console.error("Error fetching prefs:", err));
        }
    }, [selectedProject?.id_projeto, user?.email]);

    const saveLayout = async (newOrder: string[]) => {
        setLayoutOrder(newOrder);
        if (!user?.email) return;

        try {
            const res = await fetch(`/api/users/preferences?email=${user.email}`);
            const data = await res.json();
            const prefs = data.prefs || {};
            const key = selectedProject?.id_projeto ? selectedProject.id_projeto.toString() : 'global';

            prefs[key] = newOrder;
            await fetch('/api/users/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, prefs })
            });
        } catch (error) {
            console.error("Error saving prefs:", error);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = layoutOrder.indexOf(active.id as string);
            const newIndex = layoutOrder.indexOf(over?.id as string);
            const newOrder = arrayMove(layoutOrder, oldIndex, newIndex);
            saveLayout(newOrder);
        }
    };

    // --- Component Dictionary ---
    const BLOCKS: Record<string, { colSpan: string; render: () => React.ReactNode }> = {
        statusLeads: {
            colSpan: "col-span-1 md:col-span-2 xl:col-span-4",
            render: () => metrics?.statusLeads && metrics.statusLeads.length > 0 ? (
                <div className="glass-panel p-4 sm:p-5 bg-[#151515] border border-white/5 rounded-2xl h-full flex flex-col">
                    <h3 className="text-xs sm:text-sm font-bold text-white mb-1">Status dos Leads</h3>
                    <p className="text-[10px] text-[#888] mb-4">Distribuição de todos os leads por status no fluxo.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-3 gap-x-6">
                        {metrics.statusLeads.map(({ status, count, pct }: any) => {
                            const STATUS_COLORS: Record<string, string> = {
                                'Venda': '#BEFF00', 'Loss': '#f472b6', 'Remarcado': '#facc15',
                                'No-show': '#fb923c', 'Novo': '#60a5fa', 'Reembolsado': '#a78bfa', 'Follow-up': '#34d399'
                            };
                            const color = STATUS_COLORS[status] || '#888';
                            return (
                                <div key={status} className="flex items-center gap-3">
                                    <div className="flex justify-between items-center w-full max-w-[120px] shrink-0">
                                        <div className="flex items-center gap-1.5 truncate">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                            <span className="text-white font-semibold text-xs truncate" title={status}>
                                                {status === 'Loss' ? 'Loss' : status}
                                            </span>
                                        </div>
                                        <span className="text-[#666] text-[10px] ml-1">({count})</span>
                                    </div>
                                    <div className="flex-1 h-2 bg-[#111] rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                                    </div>
                                    <span className="text-white font-bold shrink-0 text-[10px] text-right w-8">{pct}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : null
        },
        sdrsPeriodo: {
            colSpan: "col-span-1 md:col-span-2",
            render: () => (
                <div className="glass-panel p-4 sm:p-5 border border-white/5 rounded-xl flex flex-col">
                    <h3 className="text-xs sm:text-sm font-bold text-white mb-4">SDRs (Período)</h3>
                    <div className="w-full" style={{ height: 260 }}>
                        {sdrs.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={sdrs} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                    <Tooltip {...tooltipStyle} />
                                    <Legend wrapperStyle={{ paddingTop: '8px', color: TEXT_SEC, fontSize: 10 }} />
                                    <Bar dataKey="conversasIniciadas" name="Conversas" fill={LIME} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="leadsQualificados" name="Qualificados" fill="#22D3EE" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="callMarcada" name="Calls" fill="#A78BFA" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-xs" style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>Sem dados no período</div>
                        )}
                    </div>
                </div>
            )
        },
        closersPeriodo: {
            colSpan: "col-span-1 md:col-span-2",
            render: () => (
                <div className="glass-panel p-4 sm:p-5 border border-white/5 rounded-xl flex flex-col">
                    <h3 className="text-xs sm:text-sm font-bold text-white mb-4">Closers (Período)</h3>
                    <div className="w-full" style={{ height: 260 }}>
                        {closers.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={closers} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                    <Tooltip {...tooltipStyle} />
                                    <Legend wrapperStyle={{ paddingTop: '8px', color: TEXT_SEC, fontSize: 10 }} />
                                    <Bar dataKey="totalCalls" name="Total Calls" fill="#888888" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="vendas" name="Vendas" fill={LIME} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-xs" style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>Sem dados no período</div>
                        )}
                    </div>
                </div>
            )
        },
        conversaoSdr: {
            colSpan: "col-span-1 md:col-span-2",
            render: () => (
                <div className="glass-panel p-4 sm:p-5 bg-black/20 border border-white/5 rounded-xl flex flex-col h-full overflow-hidden">
                    <h3 className="text-xs sm:text-sm font-bold text-white mb-1">Conversão SDR</h3>
                    <p className="text-[10px] text-[#888888] mb-4">Performance do time de prospecção.</p>
                    <div className="w-full overflow-x-auto overflow-y-auto flex-1 max-h-[250px] custom-scrollbar">
                        <table className="w-full text-left text-xs text-[#888888] min-w-[280px]">
                            <thead>
                                <tr className="border-b border-white/10 pb-2">
                                    <th className="font-medium pb-2 text-[10px] xl:text-xs">Membro</th>
                                    <th className="font-medium pb-2 text-center text-[10px] xl:text-xs">Leads</th>
                                    <th className="font-medium pb-2 text-center text-[10px] xl:text-xs">Vendas</th>
                                    <th className="font-medium pb-2 text-center text-[10px] xl:text-xs">Conv.</th>
                                    <th className="font-medium pb-2 text-center text-[10px] xl:text-xs">Reemb.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {sdrs.map((sdr: any, idx: number) => {
                                    const leads = sdr.conversasIniciadas || 0;
                                    const vendas = sdr.vendasFechadas || 0;
                                    const reembolsos = sdr.reembolsos || 0;
                                    const taxaConv = leads > 0 ? ((vendas / leads) * 100).toFixed(1) : "0.0";
                                    const taxaReemb = vendas > 0 ? ((reembolsos / vendas) * 100).toFixed(1) : "0.0";
                                    const c = ['#fff', '#BEFF00', '#22D3EE', '#A78BFA', '#F472B6'][idx % 5];
                                    return (
                                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="py-2.5 flex items-center gap-2 text-white">
                                                <div className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[8px] text-black shrink-0" style={{ background: c }}>{sdr.nome.charAt(0).toUpperCase()}</div>
                                                <span className="truncate max-w-[120px] text-[10px] xl:text-xs">{sdr.nome}</span>
                                            </td>
                                            <td className="py-2.5 text-center text-white text-[10px] xl:text-xs">{leads}</td>
                                            <td className="py-2.5 text-center text-white text-[10px] xl:text-xs">{vendas}</td>
                                            <td className="py-2.5 text-center text-[#22D3EE] font-bold text-[10px] xl:text-xs">{taxaConv}%</td>
                                            <td className="py-2.5 text-center text-red-500 font-bold text-[10px] xl:text-xs">{taxaReemb}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
        },
        conversaoCloser: {
            colSpan: "col-span-1 md:col-span-2",
            render: () => (
                <div className="glass-panel p-4 sm:p-5 bg-black/20 border border-white/5 rounded-xl flex flex-col h-full overflow-hidden">
                    <h3 className="text-xs sm:text-sm font-bold text-white mb-1">Conversão Closer</h3>
                    <p className="text-[10px] text-[#888888] mb-4">Performance do time de vendas.</p>
                    <div className="w-full overflow-x-auto overflow-y-auto flex-1 max-h-[250px] custom-scrollbar">
                        <table className="w-full text-left text-xs text-[#888888] min-w-[280px]">
                            <thead>
                                <tr className="border-b border-white/10 pb-2">
                                    <th className="font-medium pb-2 text-[10px] xl:text-xs">Membro</th>
                                    <th className="font-medium pb-2 text-center text-[10px] xl:text-xs">Leads</th>
                                    <th className="font-medium pb-2 text-center text-[10px] xl:text-xs">Vendas</th>
                                    <th className="font-medium pb-2 text-center text-[10px] xl:text-xs">Conv.</th>
                                    <th className="font-medium pb-2 text-center text-[10px] xl:text-xs">Reemb.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {closers.map((closer: any, idx: number) => {
                                    const leads = closer.totalCalls || 0;
                                    const vendas = closer.vendas || 0;
                                    const reembolsos = closer.reembolsos || 0;
                                    const taxaConv = leads > 0 ? ((vendas / leads) * 100).toFixed(1) : "0.0";
                                    const taxaReemb = vendas > 0 ? ((reembolsos / vendas) * 100).toFixed(1) : "0.0";
                                    const c = ['#A78BFA', '#22D3EE', '#BEFF00', '#F472B6', '#fff'][idx % 5];
                                    return (
                                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="py-2.5 flex items-center gap-2 text-white">
                                                <div className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[8px] text-black shrink-0" style={{ background: c }}>{closer.nome.charAt(0).toUpperCase()}</div>
                                                <span className="truncate max-w-[120px] text-[10px] xl:text-xs">{closer.nome}</span>
                                            </td>
                                            <td className="py-2.5 text-center text-white text-[10px] xl:text-xs">{leads}</td>
                                            <td className="py-2.5 text-center text-white text-[10px] xl:text-xs">{vendas}</td>
                                            <td className="py-2.5 text-center text-[#22D3EE] font-bold text-[10px] xl:text-xs">{taxaConv}%</td>
                                            <td className="py-2.5 text-center text-red-500 font-bold text-[10px] xl:text-xs">{taxaReemb}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
        },
        tmFatCloser: { colSpan: "col-span-1", render: () => renderTicketDonut("Ticket Médio (Faturamento) por Closer", metrics?.tmFaturamentoCloser) },
        tmCaixaCloser: { colSpan: "col-span-1", render: () => renderTicketDonut("Ticket Médio (Caixa) por Closer", metrics?.tmCaixaCloser) },
        tmFatSdr: { colSpan: "col-span-1", render: () => renderTicketDonut("Ticket Médio (Faturamento) por SDR", metrics?.tmFaturamentoSdr) },
        tmCaixaSdr: { colSpan: "col-span-1", render: () => renderTicketDonut("Ticket Médio (Caixa) por SDR", metrics?.tmCaixaSdr) },
        recFat: { colSpan: "col-span-1", render: () => renderTicketDonut("Rec. Formas de Pagamento (Fat.)", metrics?.receitaPorPagamentoFaturamento) },
        recCaixa: { colSpan: "col-span-1", render: () => renderTicketDonut("Rec. Formas de Pagamento (Caixa)", metrics?.receitaPorPagamentoCaixa) },
        pagamentosPendentes: {
            colSpan: "col-span-1 md:col-span-2",
            render: () => {
                const total = metrics?.pagamentosPendentes || 0;
                const detalhes = metrics?.pendentesPorCloser || [];
                return (
                    <div className="glass-panel p-4 sm:p-5 bg-black/20 border border-white/5 rounded-xl flex flex-col h-full">
                        <div className="flex items-center justify-between mb-1">
                            <h4 className="text-xs sm:text-sm font-bold text-white">Pagamentos Pendentes</h4>
                            <span className="text-xs font-black text-white">{formatBRL(total)}</span>
                        </div>
                        <p className="text-[10px] text-[#888888] mb-4">Vendas confirmadas ainda não liquidadas, por closer.</p>
                        <div className="w-full overflow-x-auto overflow-y-auto flex-1 max-h-[250px] custom-scrollbar">
                            {detalhes.length > 0 ? (
                                <table className="w-full text-left text-xs text-[#888888] min-w-[220px]">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="font-medium pb-2 text-[10px] xl:text-xs">Membro</th>
                                            <th className="font-medium pb-2 text-right text-[10px] xl:text-xs">Pendente</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {detalhes.map((d: any, index: number) => {
                                            const c = ['#A78BFA', '#22D3EE', '#BEFF00', '#F472B6', '#fff'][index % 5];
                                            return (
                                                <tr key={d.nome} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="py-2.5 flex items-center gap-2 text-white">
                                                        <div className="w-4 h-4 rounded-full flex justify-center items-center font-bold text-[8px] text-black shrink-0" style={{ background: c }}>
                                                            {d.nome.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="truncate max-w-[130px] text-[10px] xl:text-xs">{d.nome}</span>
                                                    </td>
                                                    <td className="py-2.5 text-right text-white font-bold text-[10px] xl:text-xs">{formatBRL(d.valor)}</td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="border-t border-white/10">
                                            <td className="pt-2.5 text-[10px] text-[#555] font-medium">Total Pendente</td>
                                            <td className="pt-2.5 text-right text-white font-black text-[10px] xl:text-xs">{formatBRL(total)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-[10px]"
                                    style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>
                                    Nenhum pagamento pendente 🎉
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
        },
        recCloser: {
            colSpan: "col-span-1",
            render: () => (
                <div className="glass-panel p-4 rounded-xl flex flex-col border border-white/5">
                    <h3 className="text-xs sm:text-sm font-bold text-white mb-2">Receita por Closer</h3>
                    <div className="w-full" style={{ height: 200 }}>
                        {metrics?.receitaPorCloser && metrics.receitaPorCloser.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={metrics.receitaPorCloser} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} tickFormatter={(val) => `R$${val/1000}k`} />
                                    <Tooltip {...tooltipStyle} formatter={(value: any) => formatBRL(value)} />
                                    <Bar dataKey="value" name="Receita" fill="#A78BFA" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-xs" style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>Sem vendas</div>
                        )}
                    </div>
                </div>
            )
        },
        recSdr: {
            colSpan: "col-span-1",
            render: () => (
                <div className="glass-panel p-4 rounded-xl flex flex-col border border-white/5">
                    <h3 className="text-xs sm:text-sm font-bold text-white mb-2">Receita por SDR</h3>
                    <div className="w-full" style={{ height: 200 }}>
                        {metrics?.receitaPorSdr && metrics.receitaPorSdr.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={metrics.receitaPorSdr} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: TEXT_SEC, fontSize: 10 }} tickFormatter={(val) => `R$${val/1000}k`} />
                                    <Tooltip {...tooltipStyle} formatter={(value: any) => formatBRL(value)} />
                                    <Bar dataKey="value" name="Receita" fill="#22D3EE" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-xs" style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>Sem vendas</div>
                        )}
                    </div>
                </div>
            )
        },
        reembolsos: {
            colSpan: "col-span-1",
            render: () => (
                <div className="glass-panel p-4 rounded-xl flex flex-col h-full border border-white/5">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs sm:text-sm font-bold text-white">Reembolsos & Chargeback</h3>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg" style={{ background: '#ef4444', color: '#fff' }}>
                            {metrics?.chargebackRate || '0.0'}% tx
                        </span>
                    </div>
                    <div className="flex-1 w-full min-h-[120px] max-h-[160px] overflow-y-auto space-y-2 custom-scrollbar">
                        {metrics?.recentRefundReasons && metrics.recentRefundReasons.length > 0 ? (
                            metrics.recentRefundReasons.map((reason: string, i: number) => (
                                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[#111] border border-[#2A2A2A]">
                                    <span className="text-red-400 mt-0.5 shrink-0 text-[10px]">⚠</span>
                                    <p className="text-[10px] text-[#cccccc]">{reason}</p>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-[10px]" style={{ borderColor: 'rgba(255,255,255,0.08)', color: TEXT_SEC }}>Nenhum reembolso 🎉</div>
                        )}
                    </div>
                </div>
            )
        },
        comissaoCloser: {
            colSpan: "col-span-1 md:col-span-2",
            render: () => metrics?.comissaoCloserDetalhes && metrics.comissaoCloserDetalhes.length > 0 ? (
                <div className="glass-panel p-4 sm:p-5 bg-black/20 border border-white/5 rounded-xl flex flex-col h-full">
                    <h4 className="text-xs sm:text-sm font-bold text-white mb-1">Comissão Closer</h4>
                    <p className="text-[10px] text-[#888888] mb-4">Calculado sobre caixa recebido.</p>
                    <div className="w-full overflow-x-auto overflow-y-auto flex-1 max-h-[250px] custom-scrollbar">
                        <table className="w-full text-left text-xs text-[#888888] min-w-[260px]">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="font-medium pb-2 text-[10px] xl:text-xs">Membro</th>
                                    <th className="font-medium pb-2 text-right text-[10px] xl:text-xs">Caixa</th>
                                    <th className="font-medium pb-2 text-center text-[10px] xl:text-xs">%</th>
                                    <th className="font-medium pb-2 text-right text-[10px] xl:text-xs">Comissão</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {metrics.comissaoCloserDetalhes.map((d: any, index: number) => {
                                    const c = ['#A78BFA', '#22D3EE', '#BEFF00', '#F472B6', '#fff'][index % 5];
                                    return (
                                        <tr key={d.nome} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="py-2.5 flex items-center gap-2 text-white">
                                                <div className="w-4 h-4 rounded-full flex justify-center items-center font-bold text-[8px] text-black shrink-0" style={{ background: c }}>{d.nome.charAt(0).toUpperCase()}</div>
                                                <span className="truncate max-w-[110px] text-[10px] xl:text-xs">{d.nome}</span>
                                            </td>
                                            <td className="py-2.5 text-right text-white text-[10px] xl:text-xs">{formatBRL(d.caixa)}</td>
                                            <td className="py-2.5 text-center text-[#A78BFA] font-bold text-[10px] xl:text-xs">{d.pct}%</td>
                                            <td className="py-2.5 text-right text-[#A78BFA] font-black text-[10px] xl:text-xs">{formatBRL(d.comissao)}</td>
                                        </tr>
                                    );
                                })}
                                <tr className="border-t border-white/10">
                                    <td colSpan={3} className="pt-2.5 text-[10px] text-[#555] font-medium">Total Closers</td>
                                    <td className="pt-2.5 text-right text-[#A78BFA] font-black text-xs">{formatBRL(metrics.comissaoCloserTotal || 0)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null
        },
        comissaoSdr: {
            colSpan: "col-span-1 md:col-span-2",
            render: () => metrics?.comissaoSdrDetalhes && metrics.comissaoSdrDetalhes.length > 0 ? (
                <div className="glass-panel p-4 sm:p-5 bg-black/20 border border-white/5 rounded-xl flex flex-col h-full">
                    <h4 className="text-xs sm:text-sm font-bold text-white mb-1">Comissão SDR</h4>
                    <p className="text-[10px] text-[#888888] mb-4">Calculado sobre caixa recebido.</p>
                    <div className="w-full overflow-x-auto overflow-y-auto flex-1 max-h-[250px] custom-scrollbar">
                        <table className="w-full text-left text-xs text-[#888888] min-w-[260px]">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="font-medium pb-2 text-[10px] xl:text-xs">Membro</th>
                                    <th className="font-medium pb-2 text-right text-[10px] xl:text-xs">Caixa</th>
                                    <th className="font-medium pb-2 text-center text-[10px] xl:text-xs">%</th>
                                    <th className="font-medium pb-2 text-right text-[10px] xl:text-xs">Comissão</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {metrics.comissaoSdrDetalhes.map((d: any, index: number) => {
                                    const c = ['#22D3EE', '#BEFF00', '#F472B6', '#A78BFA', '#fff'][index % 5];
                                    return (
                                        <tr key={d.nome} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="py-2.5 flex items-center gap-2 text-white">
                                                <div className="w-4 h-4 rounded-full flex justify-center items-center font-bold text-[8px] text-black shrink-0" style={{ background: c }}>{d.nome.charAt(0).toUpperCase()}</div>
                                                <span className="truncate max-w-[110px] text-[10px] xl:text-xs">{d.nome}</span>
                                            </td>
                                            <td className="py-2.5 text-right text-white text-[10px] xl:text-xs">{formatBRL(d.caixa)}</td>
                                            <td className="py-2.5 text-center text-[#22D3EE] font-bold text-[10px] xl:text-xs">{d.pct}%</td>
                                            <td className="py-2.5 text-right text-[#22D3EE] font-black text-[10px] xl:text-xs">{formatBRL(d.comissao)}</td>
                                        </tr>
                                    );
                                })}
                                <tr className="border-t border-white/10">
                                    <td colSpan={3} className="pt-2.5 text-[10px] text-[#555] font-medium">Total SDRs</td>
                                    <td className="pt-2.5 text-right text-[#22D3EE] font-black text-xs">{formatBRL(metrics.comissaoSdrTotal || 0)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null
        }
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={layoutOrder} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 pb-12 mt-4">
                    {layoutOrder.map(id => {
                        const block = BLOCKS[id];
                        if (!block) return null;
                        return <SortableItem key={id} id={id} block={block} isEditMode={isEditMode} />;
                    })}
                </div>
            </SortableContext>
        </DndContext>
    );
}
