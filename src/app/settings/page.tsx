"use client";

import { useState, useEffect } from "react";
import { Settings2, Target, Users, Package, CreditCard } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { TeamSection } from "./TeamSection";
import { ProductsSection } from "./ProductsSection";
import { PaymentsSection } from "./PaymentsSection";

type TeamMeta = { meta_faturamento: number; meta_caixa: number; };
type UserMeta = { id_usuario: number; nome: string; tipo: string; meta_faturamento: number; meta_caixa: number; };

type Aba = 'geral' | 'pagamentos' | 'time' | 'produtos';

const ABAS: { id: Aba; nome: string; icon: typeof Settings2 }[] = [
    { id: 'geral', nome: 'Geral', icon: Settings2 },
    { id: 'pagamentos', nome: 'Pagamentos', icon: CreditCard },
    { id: 'time', nome: 'Meu Time', icon: Users },
    { id: 'produtos', nome: 'Produtos', icon: Package },
];

export default function SettingsPage() {
    const [aba, setAba] = useState<Aba>('geral');

    // ?aba=pagamentos / ?aba=time / ?aba=produtos abre direto na aba (os antigos /team e /products redirecionam para cá)
    useEffect(() => {
        const inicial = new URLSearchParams(window.location.search).get('aba');
        if (inicial === 'pagamentos' || inicial === 'time' || inicial === 'produtos') setAba(inicial);
    }, []);

    const trocarAba = (nova: Aba) => {
        setAba(nova);
        window.history.replaceState(null, '', nova === 'geral' ? '/settings' : `/settings?aba=${nova}`);
    };

    return (
        <div className="pt-4 h-full flex flex-col">
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-white tracking-tight">Configurações</h2>
                <p className="text-sec mt-1">Metas, meios de pagamento, time e produtos do projeto.</p>
            </div>

            <div className="flex shrink-0 gap-1 mb-8 p-1 rounded-xl w-fit max-w-full overflow-x-auto" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-str)' }}>
                {ABAS.map(({ id, nome, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => trocarAba(id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all"
                        style={aba === id ? { background: 'var(--accent)', color: 'var(--accent-text)' } : { color: 'var(--text-sec)' }}
                    >
                        <Icon size={16} />
                        {nome}
                    </button>
                ))}
            </div>

            {aba === 'geral' && <GeneralSettings />}
            {aba === 'pagamentos' && <PaymentsSection />}
            {aba === 'time' && <TeamSection />}
            {aba === 'produtos' && <ProductsSection />}
        </div>
    );
}

function GeneralSettings() {
    const { selectedProject } = useProject();

    // ── Metas do Time (project-level) ─────────────────────────
    const now = new Date();
    const [metaMes, setMetaMes] = useState(now.getMonth() + 1);
    const [metaAno, setMetaAno] = useState(now.getFullYear());
    const [teamMeta, setTeamMeta] = useState<TeamMeta>({ meta_faturamento: 0, meta_caixa: 0 });
    const [metaSaving, setMetaSaving] = useState(false);
    const [metaSaved, setMetaSaved] = useState(false);

    const fetchTeamMeta = async (mes = metaMes, ano = metaAno) => {
        if (!selectedProject?.id_projeto) return;
        try {
            const res = await fetch(`/api/metas-projeto?projectId=${selectedProject.id_projeto}&mes=${mes}&ano=${ano}`);
            const data = await res.json();
            setTeamMeta({ meta_faturamento: data.meta_faturamento || 0, meta_caixa: data.meta_caixa || 0 });
        } catch (e) {
            console.error('Failed to fetch team meta', e);
        }
    };

    // Individual metas fetching is handled in the combined useEffect below

    const handleSaveTeamMeta = async () => {
        if (!selectedProject?.id_projeto) return;
        setMetaSaving(true);
        try {
            await fetch('/api/metas-projeto', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_projeto: selectedProject.id_projeto,
                    mes: metaMes,
                    ano: metaAno,
                    meta_faturamento: teamMeta.meta_faturamento,
                    meta_caixa: teamMeta.meta_caixa,
                })
            });
            setMetaSaved(true);
            setTimeout(() => setMetaSaved(false), 2000);
        } catch (e) {
            console.error('Error saving team meta', e);
        } finally {
            setMetaSaving(false);
        }
    };

    // ── Individual Metas per user ──────────────────────────
    const [userMetas, setUserMetas] = useState<UserMeta[]>([]);
    const [userMetasSaving, setUserMetasSaving] = useState<Record<number, boolean>>({});
    const [userMetasSaved, setUserMetasSaved] = useState<Record<number, boolean>>({});

    const fetchUserMetas = async (mes = metaMes, ano = metaAno) => {
        if (!selectedProject?.id_projeto) return;
        try {
            const res = await fetch(`/api/metas?projectId=${selectedProject.id_projeto}&mes=${mes}&ano=${ano}`);
            const data = await res.json();
            setUserMetas(Array.isArray(data) ? data : []);
        } catch (e) { console.error('Failed to fetch user metas', e); }
    };

    useEffect(() => {
        if (selectedProject) { fetchTeamMeta(); fetchUserMetas(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedProject, metaMes, metaAno]);

    const handleUserMetaChange = (userId: number, field: 'meta_faturamento' | 'meta_caixa', value: string) => {
        setUserMetas(prev => prev.map(u => u.id_usuario === userId ? { ...u, [field]: parseFloat(value) || 0 } : u));
    };

    const handleSaveUserMeta = async (user: UserMeta) => {
        setUserMetasSaving(prev => ({ ...prev, [user.id_usuario]: true }));
        try {
            await fetch('/api/metas', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_usuario: user.id_usuario, mes: metaMes, ano: metaAno, meta_faturamento: user.meta_faturamento, meta_caixa: user.meta_caixa, meta_vendas: 0 })
            });
            setUserMetasSaved(prev => ({ ...prev, [user.id_usuario]: true }));
            setTimeout(() => setUserMetasSaved(prev => ({ ...prev, [user.id_usuario]: false })), 2000);
        } catch (e) { console.error('Error saving user meta', e); }
        finally { setUserMetasSaving(prev => ({ ...prev, [user.id_usuario]: false })); }
    };

    const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    return (
        <div className="flex flex-col">
            {/* ── Metas do Time ─────────────────────────── */}
            <div className="glass-panel p-6 bg-surface border-str mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: 'rgba(var(--accent-rgb),0.12)' }}>
                            <Target size={22} style={{ color: 'var(--accent)' }} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Metas do Time</h3>
                            <p className="text-sec text-sm">SDR + Closer juntos. A meta é da equipe inteira.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={metaMes}
                            onChange={e => setMetaMes(Number(e.target.value))}
                            className="bg-app border border-str text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
                        >
                            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                        <select
                            value={metaAno}
                            onChange={e => setMetaAno(Number(e.target.value))}
                            className="bg-app border border-str text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
                        >
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                {!selectedProject ? (
                    <div className="text-center py-8 border-2 border-dashed border-str rounded-xl text-sec text-sm">
                        Selecione um projeto para configurar as metas.
                    </div>
                ) : (
                    <div className="max-w-md">
                        <div className="grid grid-cols-2 gap-4 mb-5">
                            <div>
                                <label className="block text-xs font-bold text-sec uppercase mb-1.5">Meta de Faturamento</label>
                                <input
                                    type="number"
                                    step="500"
                                    value={teamMeta.meta_faturamento}
                                    onChange={e => setTeamMeta(prev => ({ ...prev, meta_faturamento: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-app border border-str text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent"
                                    placeholder="Ex: 55000"
                                />
                                <p className="text-[10px] text-sec mt-1">Receita bruta total do time</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-sec uppercase mb-1.5">Meta de Caixa</label>
                                <input
                                    type="number"
                                    step="500"
                                    value={teamMeta.meta_caixa}
                                    onChange={e => setTeamMeta(prev => ({ ...prev, meta_caixa: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-app border border-str text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent"
                                    placeholder="Ex: 45000"
                                />
                                <p className="text-[10px] text-sec mt-1">Caixa líquido após taxas</p>
                            </div>
                        </div>
                        <button
                            onClick={handleSaveTeamMeta}
                            disabled={metaSaving}
                            className="btn-primary py-2 px-6 text-sm"
                        >
                            {metaSaved ? '✓ Meta Salva!' : metaSaving ? 'Salvando…' : 'Salvar Meta do Mês'}
                        </button>
                    </div>
                )}
            </div>


            {/* ── Metas Individuais ──────────────────────── */}
            {userMetas.length > 0 && (
                <div className="glass-panel p-6 bg-surface border-str mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg" style={{ background: 'rgba(34,211,238,0.12)' }}>
                            <Target size={22} style={{ color: '#22D3EE' }} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Metas Individuais</h3>
                            <p className="text-sec text-sm">Meta de Faturamento e Caixa por membro — não somadas à Meta Geral.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {(['SDR', 'CLOSER'] as const).map(tipo => {
                            const group = userMetas.filter(u => u.tipo === tipo);
                            if (group.length === 0) return null;
                            const dotColor = tipo === 'SDR' ? 'var(--accent)' : '#22D3EE';
                            return (
                                <div key={tipo}>
                                    <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#888' }}>{tipo === 'SDR' ? 'SDRs' : 'Closers'}</h4>
                                    <div className="space-y-3">
                                        {group.map(user => (
                                            <div key={user.id_usuario} className="p-4 bg-app border border-str rounded-xl">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-black" style={{ background: dotColor }}>
                                                        {user.nome.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-white font-semibold text-sm">{user.nome}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 mb-3">
                                                    <div>
                                                        <label className="block text-[10px] uppercase font-bold text-sec mb-1">Meta Faturamento</label>
                                                        <input type="number" step="500" value={user.meta_faturamento}
                                                            onChange={e => handleUserMetaChange(user.id_usuario, 'meta_faturamento', e.target.value)}
                                                            className="w-full bg-surface border border-str text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
                                                            placeholder="Ex: 20000" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase font-bold text-sec mb-1">Meta Caixa</label>
                                                        <input type="number" step="500" value={user.meta_caixa}
                                                            onChange={e => handleUserMetaChange(user.id_usuario, 'meta_caixa', e.target.value)}
                                                            className="w-full bg-surface border border-str text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
                                                            placeholder="Ex: 16000" />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end">
                                                    <button onClick={() => handleSaveUserMeta(user)} disabled={userMetasSaving[user.id_usuario]} className="btn-primary text-xs py-1.5 px-4">
                                                        {userMetasSaved[user.id_usuario] ? '✓ Salvo!' : userMetasSaving[user.id_usuario] ? 'Salvando…' : 'Salvar'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
