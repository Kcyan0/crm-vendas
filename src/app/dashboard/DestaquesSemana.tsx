"use client";

import { useState, useEffect } from "react";
import { Trophy, BriefcaseBusiness, BellRing, TrendingUp } from "lucide-react";

type Destaque = {
    valor: number;
    pessoas: { id_usuario: number; nome: string; cargo: string | null }[];
} | null;

type Destaques = {
    semana: { inicio: string; fim: string };
    maisVendeu: Destaque;
    maisFollow: Destaque;
    maisResultado: Destaque;
};

const CARGO_LABEL: Record<string, string> = { CLOSER: 'Closer', SDR: 'SDR', ADMIN: 'Admin', EXPERT: 'Expert' };

// "2026-10-27" → "27/10"
const formatDia = (dateStr: string) => {
    const [, m, d] = dateStr.split('-');
    return `${d}/${m}`;
};

export function DestaquesSemana({ projectId, formatBRL }: { projectId?: number; formatBRL: (v: number) => string }) {
    const [data, setData] = useState<Destaques | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!projectId) return;
        const fetchDestaques = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/destaques?projectId=${projectId}`);
                if (!res.ok) throw new Error();
                setData(await res.json());
                setError(false);
            } catch {
                setError(true);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDestaques();
    }, [projectId]);

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
                    <span className="font-bold text-white text-sm">Destaques da semana</span>
                    {data?.semana && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full text-sec bg-white/5">
                            {formatDia(data.semana.inicio)} – {formatDia(data.semana.fim)}
                        </span>
                    )}
                </div>
            </div>

            {error ? (
                <p className="text-xs text-sec">Não foi possível carregar os destaques da semana.</p>
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
                                <p className="text-sm text-sec">Ninguém ainda nesta semana</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
