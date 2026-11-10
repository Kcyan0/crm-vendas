"use client";

import { useState, useEffect } from "react";
import { Trophy, BriefcaseBusiness, BellRing, TrendingUp } from "lucide-react";

type Destaque = {
    valor: number;
    pessoas: { id_usuario: number; nome: string; cargo: string | null }[];
} | null;

type DadosDestaques = {
    periodo: { inicio: string; fim: string };
    maisVendeu: Destaque;
    maisFollow: Destaque;
    maisResultado: Destaque;
};

// Última resposta de cada filtro, só na memória desta aba: ao voltar, aparece na hora e se atualiza em seguida
const cacheDestaques = new Map<string, DadosDestaques>();

const CARGO_LABEL: Record<string, string> = { CLOSER: 'Closer', SDR: 'SDR', ADMIN: 'Admin', EXPERT: 'Expert' };

// "2026-10-27" → "27/10" (com o ano, "27/10/26", quando o período passa de um ano para outro)
const formatDia = (dateStr: string, comAno: boolean) => {
    const [a, m, d] = dateStr.split('-');
    return comAno ? `${d}/${m}/${a.slice(2)}` : `${d}/${m}`;
};

const formatPeriodo = ({ inicio, fim }: { inicio: string; fim: string }) => {
    const comAno = inicio.slice(0, 4) !== fim.slice(0, 4);
    return inicio === fim ? formatDia(inicio, comAno) : `${formatDia(inicio, comAno)} – ${formatDia(fim, comAno)}`;
};

// Período e projeto do filtro aplicado na Dashboard (o que o botão Filtrar buscou)
export function Destaques({ projectId, startDate, endDate, formatBRL }: {
    projectId?: number;
    startDate?: string;
    endDate?: string;
    formatBRL: (v: number) => string;
}) {
    const [data, setData] = useState<DadosDestaques | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!projectId || !startDate || !endDate) return;
        let atual = true; // ignora a resposta de um filtro que já foi trocado
        const query = new URLSearchParams({ projectId: String(projectId), startDate, endDate }).toString();
        const emCache = cacheDestaques.get(query);
        const fetchDestaques = async () => {
            if (emCache) {
                setData(emCache);
                setError(false);
            }
            setIsLoading(!emCache);
            try {
                const res = await fetch(`/api/destaques?${query}`);
                if (!res.ok) throw new Error();
                const json = await res.json();
                cacheDestaques.delete(query);
                cacheDestaques.set(query, json);
                if (cacheDestaques.size > 30) cacheDestaques.delete(cacheDestaques.keys().next().value as string);
                if (!atual) return;
                setData(json);
                setError(false);
            } catch {
                if (atual && !emCache) setError(true); // com dados guardados, continua mostrando eles
            } finally {
                if (atual) setIsLoading(false);
            }
        };
        fetchDestaques();
        return () => { atual = false; };
    }, [projectId, startDate, endDate]);

    const items = [
        { titulo: 'Mais vendeu', icon: BriefcaseBusiness, destaque: data?.maisVendeu, formato: (v: number) => `${v} venda${v > 1 ? 's' : ''}` },
        { titulo: 'Mais fez follow', icon: BellRing, destaque: data?.maisFollow, formato: (v: number) => `${v} follow${v > 1 ? 's' : ''}` },
        { titulo: 'Mais deu resultado', icon: TrendingUp, destaque: data?.maisResultado, formato: formatBRL },
    ];

    return (
        <div className="glass-panel p-4 sm:p-5 mb-6 border border-white/5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ background: 'rgba(var(--accent-rgb),0.12)' }}>
                        <Trophy size={16} style={{ color: 'var(--accent)' }} />
                    </div>
                    <span className="font-bold text-white text-sm">Destaques</span>
                    {data?.periodo && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full text-sec bg-white/5">
                            {formatPeriodo(data.periodo)}
                        </span>
                    )}
                </div>
            </div>

            {error ? (
                <p className="text-xs text-sec">Não foi possível carregar os destaques.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {items.map(({ titulo, icon: Icon, destaque, formato }) => (
                        <div key={titulo} className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-str)' }}>
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-sec">
                                <Icon size={13} style={{ color: 'var(--accent)' }} />
                                {titulo}
                            </div>
                            {isLoading ? (
                                <div className="h-10 w-32 rounded animate-pulse" style={{ background: 'var(--bg-surface-3)' }} />
                            ) : destaque ? (
                                <>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        {destaque.pessoas.map(p => (
                                            <span key={p.id_usuario} className="flex items-center gap-1.5">
                                                <span className="text-base font-black text-white leading-tight">{p.nome}</span>
                                                {p.cargo && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase" style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)' }}>
                                                        {CARGO_LABEL[p.cargo.toUpperCase()] || p.cargo}
                                                    </span>
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-xl font-black" style={{ color: 'var(--accent)' }}>{formato(destaque.valor)}</p>
                                    {destaque.pessoas.length > 1 && <p className="text-[10px] text-sec -mt-1">Empate</p>}
                                </>
                            ) : (
                                <p className="text-sm text-sec">Ninguém ainda neste período</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
