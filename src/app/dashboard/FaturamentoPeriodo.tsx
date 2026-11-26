"use client";
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { SerieFaturamento, PontoFaturamento } from '@/lib/serieFaturamento';

// "YYYY-MM-DD" → "24/11" (ou "24/11/26" quando o período cruza anos)
const diaMes = (d: string, comAno = false) => `${d.slice(8, 10)}/${d.slice(5, 7)}${comAno ? `/${d.slice(2, 4)}` : ''}`;
const dataCompleta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const diaDaSemana = (d: string) => {
    const nome = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)).replace('.', '');
    return nome.charAt(0).toUpperCase() + nome.slice(1);
};

// Eixo Y: R$ 500, R$ 10k, R$ 1,2 mi
const abreviarBRL = (v: number) => {
    const abs = Math.abs(v);
    const num = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    if (abs >= 1_000_000) return `R$ ${num(v / 1_000_000)} mi`;
    if (abs >= 1_000) return `R$ ${num(v / 1_000)}k`;
    return `R$ ${Math.round(v)}`;
};

// O recharts repassa o próprio contentStyle ao conteúdo e sobrescreveria um prop com esse nome: por isso "estilo"
function TooltipFaturamento({ active, payload, formatBRL, estilo }: {
    active?: boolean; payload?: { payload: PontoFaturamento }[];
    formatBRL: (v: number) => string; estilo: React.CSSProperties;
}) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    // Semana cortada no limite do período pode ter um dia só: aí mostra como dia
    const titulo = p.inicio === p.fim
        ? `${diaDaSemana(p.inicio)}, ${dataCompleta(p.inicio)}`
        : `Semana ${p.inicio.slice(0, 4) === p.fim.slice(0, 4) ? diaMes(p.inicio) : dataCompleta(p.inicio)} a ${dataCompleta(p.fim)}`;
    return (
        <div style={{ ...estilo, padding: '8px 12px' }}>
            <p className="text-[10px] font-semibold" style={{ color: 'var(--text-sec)' }}>{titulo}</p>
            <p className="text-sm font-black mt-0.5" style={{ color: 'var(--text-pri)' }}>{formatBRL(p.valor)}</p>
        </div>
    );
}

export function FaturamentoPeriodo({ serie, formatBRL, tooltipContentStyle, TEXT_SEC }: {
    serie?: SerieFaturamento; formatBRL: (v: number) => string;
    tooltipContentStyle: React.CSSProperties; TEXT_SEC: string;
}) {
    const pontos = serie?.pontos || [];
    const agrupamento = serie?.agrupamento || 'dia';
    // Mesma soma da Receita Bruta (os pontos vêm em centavos exatos da API)
    const total = pontos.reduce((s, p) => Math.round((s + p.valor) * 100) / 100, 0);
    const cruzaAno = pontos.length > 0 && pontos[0].inicio.slice(0, 4) !== pontos[pontos.length - 1].fim.slice(0, 4);

    return (
        <div className="glass-panel fat-periodo p-4 sm:p-5 rounded-2xl h-full flex flex-col">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-white">Faturamento no período</h3>
                    <p className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums">{formatBRL(total)}</p>
                    <p className="text-[10px] text-sec mt-0.5">
                        {agrupamento === 'semana'
                            ? 'Período longo: cada ponto soma uma semana (segunda a domingo).'
                            : 'Pagamentos pagos, pela data da venda.'}
                    </p>
                </div>
                <span className="fat-periodo-legenda shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold">
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--fat-linha)' }} />
                    {agrupamento === 'semana' ? 'Por semana' : 'Por dia'}
                </span>
            </div>

            <div className="w-full mt-4" style={{ height: 240 }}>
                {total > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={pontos} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="fatPeriodoGradiente" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--fat-linha)" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="var(--fat-linha)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="var(--border)" />
                            <XAxis
                                dataKey="inicio"
                                tickFormatter={(d: string) => diaMes(d, cruzaAno)}
                                axisLine={false} tickLine={false} minTickGap={20} tickMargin={8}
                                interval="equidistantPreserveStart"
                                tick={{ fill: TEXT_SEC, fontSize: 10 }}
                            />
                            <YAxis
                                tickFormatter={abreviarBRL} tickCount={4} width={58}
                                axisLine={false} tickLine={false}
                                tick={{ fill: TEXT_SEC, fontSize: 10 }}
                            />
                            <Tooltip
                                content={<TooltipFaturamento formatBRL={formatBRL} estilo={tooltipContentStyle} />}
                                cursor={{ stroke: 'var(--text-sec)', strokeWidth: 1, strokeDasharray: '4 4' }}
                            />
                            <Area
                                type="monotone" dataKey="valor" name="Faturamento"
                                stroke="var(--fat-linha)" strokeWidth={2.5} fill="url(#fatPeriodoGradiente)"
                                // Período de um dia só: sem ponto a linha não aparece
                                dot={pontos.length === 1 ? { r: 4, fill: 'var(--fat-linha)', strokeWidth: 0 } : false}
                                activeDot={{ r: 6, fill: 'var(--fat-ponto)', stroke: 'var(--bg-surface)', strokeWidth: 3 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl text-xs" style={{ borderColor: 'var(--border)', color: TEXT_SEC }}>
                        Sem faturamento no período
                    </div>
                )}
            </div>
        </div>
    );
}
