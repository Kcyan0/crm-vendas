"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Settings2, Target } from "lucide-react";
import { useProject } from "@/context/ProjectContext";

type Gateway = {
    id_gateway: number;
    nome: string;
    taxa_percentual: number;
    taxa_fixa: number;
    ativo: number;
    tem_entrada: boolean;
    taxa_entrada_percentual: number;
    taxa_entrada_fixa: number;
};

type TeamMeta = { meta_faturamento: number; meta_caixa: number; };
type UserMeta = { id_usuario: number; nome: string; tipo: string; meta_faturamento: number; meta_caixa: number; };

export default function SettingsPage() {
    const { selectedProject } = useProject();

    // ── Gateways ──────────────────────────────────────────────
    const [gateways, setGateways] = useState<Gateway[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGatewayId, setEditingGatewayId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        nome: "",
        taxa_percentual: "0",
        taxa_fixa: "0",
        ativo: true,
        tem_entrada: false,
        taxa_entrada_percentual: "0",
        taxa_entrada_fixa: "0"
    });

    const fetchGateways = async () => {
        try {
            const res = await fetch("/api/gateways");
            const data = await res.json();
            setGateways(data);
        } catch (e) {
            console.error("Failed to fetch gateways", e);
        }
    };

    useEffect(() => { fetchGateways(); }, []);

    const handleOpenCreate = () => {
        setEditingGatewayId(null);
        setFormData({ nome: "", taxa_percentual: "0", taxa_fixa: "0", ativo: true, tem_entrada: false, taxa_entrada_percentual: "0", taxa_entrada_fixa: "0" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (gateway: Gateway) => {
        setEditingGatewayId(gateway.id_gateway);
        setFormData({
            nome: gateway.nome,
            taxa_percentual: gateway.taxa_percentual.toString(),
            taxa_fixa: gateway.taxa_fixa.toString(),
            ativo: gateway.ativo === 1 || gateway.ativo === true as any,
            tem_entrada: !!gateway.tem_entrada,
            taxa_entrada_percentual: (gateway.taxa_entrada_percentual || 0).toString(),
            taxa_entrada_fixa: (gateway.taxa_entrada_fixa || 0).toString()
        });
        setIsModalOpen(true);
    };

    const handleSaveGateway = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const method = editingGatewayId ? "PUT" : "POST";
            await fetch("/api/gateways", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id_gateway: editingGatewayId,
                    ...formData,
                    taxa_percentual: parseFloat(formData.taxa_percentual),
                    taxa_fixa: parseFloat(formData.taxa_fixa)
                }),
            });
            setIsModalOpen(false);
            fetchGateways();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Deseja realmente remover este Gateway?')) return;
        try {
            await fetch(`/api/gateways?id=${id}`, { method: 'DELETE' });
            fetchGateways();
        } catch (e) {
            console.error(e);
        }
    };

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
        <div className="pt-4 h-full flex flex-col">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Configurações Gerais</h2>
                    <p className="text-[#888888] mt-1">Gerencie Gateways, Formas de Pagamento e Metas do time.</p>
                </div>
            </div>

            {/* ── Metas do Time ─────────────────────────── */}
            <div className="glass-panel p-6 bg-[#1A1A1A] border-[#2A2A2A] mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: 'rgba(190,255,0,0.12)' }}>
                            <Target size={22} style={{ color: '#BEFF00' }} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Metas do Time</h3>
                            <p className="text-[#888888] text-sm">SDR + Closer juntos. A meta é da equipe inteira.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={metaMes}
                            onChange={e => setMetaMes(Number(e.target.value))}
                            className="bg-[#111] border border-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#BEFF00]"
                        >
                            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                        <select
                            value={metaAno}
                            onChange={e => setMetaAno(Number(e.target.value))}
                            className="bg-[#111] border border-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#BEFF00]"
                        >
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                {!selectedProject ? (
                    <div className="text-center py-8 border-2 border-dashed border-[#2A2A2A] rounded-xl text-[#888888] text-sm">
                        Selecione um projeto para configurar as metas.
                    </div>
                ) : (
                    <div className="max-w-md">
                        <div className="grid grid-cols-2 gap-4 mb-5">
                            <div>
                                <label className="block text-xs font-bold text-[#888888] uppercase mb-1.5">Meta de Faturamento</label>
                                <input
                                    type="number"
                                    step="500"
                                    value={teamMeta.meta_faturamento}
                                    onChange={e => setTeamMeta(prev => ({ ...prev, meta_faturamento: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-[#111] border border-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#BEFF00]"
                                    placeholder="Ex: 55000"
                                />
                                <p className="text-[10px] text-[#666] mt-1">Receita bruta total do time</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[#888888] uppercase mb-1.5">Meta de Caixa</label>
                                <input
                                    type="number"
                                    step="500"
                                    value={teamMeta.meta_caixa}
                                    onChange={e => setTeamMeta(prev => ({ ...prev, meta_caixa: parseFloat(e.target.value) || 0 }))}
                                    className="w-full bg-[#111] border border-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#BEFF00]"
                                    placeholder="Ex: 45000"
                                />
                                <p className="text-[10px] text-[#666] mt-1">Caixa líquido após taxas</p>
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
                <div className="glass-panel p-6 bg-[#1A1A1A] border-[#2A2A2A] mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg" style={{ background: 'rgba(34,211,238,0.12)' }}>
                            <Target size={22} style={{ color: '#22D3EE' }} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Metas Individuais</h3>
                            <p className="text-[#888888] text-sm">Meta de Faturamento e Caixa por membro — não somadas à Meta Geral.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {(['SDR', 'CLOSER'] as const).map(tipo => {
                            const group = userMetas.filter(u => u.tipo === tipo);
                            if (group.length === 0) return null;
                            const dotColor = tipo === 'SDR' ? '#BEFF00' : '#22D3EE';
                            return (
                                <div key={tipo}>
                                    <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#888' }}>{tipo === 'SDR' ? 'SDRs' : 'Closers'}</h4>
                                    <div className="space-y-3">
                                        {group.map(user => (
                                            <div key={user.id_usuario} className="p-4 bg-[#111] border border-[#2A2A2A] rounded-xl">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-black" style={{ background: dotColor }}>
                                                        {user.nome.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-white font-semibold text-sm">{user.nome}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 mb-3">
                                                    <div>
                                                        <label className="block text-[10px] uppercase font-bold text-[#888] mb-1">Meta Faturamento</label>
                                                        <input type="number" step="500" value={user.meta_faturamento}
                                                            onChange={e => handleUserMetaChange(user.id_usuario, 'meta_faturamento', e.target.value)}
                                                            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#BEFF00]"
                                                            placeholder="Ex: 20000" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase font-bold text-[#888] mb-1">Meta Caixa</label>
                                                        <input type="number" step="500" value={user.meta_caixa}
                                                            onChange={e => handleUserMetaChange(user.id_usuario, 'meta_caixa', e.target.value)}
                                                            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#BEFF00]"
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

            {/* ── Gateways ──────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="glass-panel text-left p-6 h-fit bg-[#1A1A1A] border-[#2A2A2A]">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#1A1A1A] text-green-700 rounded-lg">
                                <Settings2 size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white">Meios de Pagamento e Taxas</h3>
                        </div>
                        <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2 py-1.5 px-3 text-sm">
                            <Plus size={16} />
                            <span>Novo Gateway</span>
                        </button>
                    </div>

                    <div className="space-y-4">
                        {gateways.map(gw => (
                            <div key={gw.id_gateway} className={`p-4 rounded-xl border transition-all ${gw.ativo ? 'bg-[#111111] border-[#2A2A2A] hover:border-green-300' : 'bg-[#1A1A1A] border-[#2A2A2A] opacity-60'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-white text-lg">{gw.nome}</h4>
                                            {!gw.ativo && <span className="text-[10px] uppercase font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">Inativo</span>}
                                        </div>
                                        <div className="flex gap-4 mt-2">
                                            <div className="text-sm">
                                                <span className="text-[#888888] block text-xs font-semibold uppercase">Taxa (%)</span>
                                                <span className="text-white font-bold">{gw.taxa_percentual.toFixed(2)}%</span>
                                            </div>
                                            <div className="text-sm">
                                                <span className="text-[#888888] block text-xs font-semibold uppercase">Taxa Fixa (R$)</span>
                                                <span className="text-white font-bold">R$ {gw.taxa_fixa.toFixed(2)}</span>
                                            </div>
                                            {gw.tem_entrada && (
                                                <div className="text-sm">
                                                    <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded mt-1">Aceita Entrada</span>
                                                    <span className="text-[#888888] block text-xs font-semibold uppercase mt-1">Taxa Entrada: <span className="text-white">{gw.taxa_entrada_percentual?.toFixed(2) || '0.00'}%</span></span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleOpenEdit(gw)} className="p-2 text-green-500 hover:bg-[#111111] rounded-lg transition-colors text-sm font-bold">Editar</button>
                                        <button onClick={() => handleDelete(gw.id_gateway)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {gateways.length === 0 && (
                            <div className="text-center p-8 text-[#888888] border border-dashed border-slate-300 rounded-xl">
                                Nenhum Gateway Cadastrado.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Gateway */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="glass-panel w-full max-w-md p-6 relative bg-[#1A1A1A] border-[#2A2A2A]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">
                                {editingGatewayId ? "Editar Gateway" : "Novo Gateway"}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-[#666666] hover:text-white">✕</button>
                        </div>

                        <form onSubmit={handleSaveGateway} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white mb-1">Nome / Operadora *</label>
                                <input required type="text" className="w-full bg-[#1A1A1A] border border-[#2A2A2A]" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Stripe, Pagar.me..." />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-1">Taxa por venda (%)</label>
                                    <input type="number" step="0.01" className="w-full bg-[#1A1A1A] border border-[#2A2A2A]" value={formData.taxa_percentual} onChange={(e) => setFormData({ ...formData, taxa_percentual: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-1">Taxa Fixa (R$)</label>
                                    <input type="number" step="0.01" className="w-full bg-[#1A1A1A] border border-[#2A2A2A]" value={formData.taxa_fixa} onChange={(e) => setFormData({ ...formData, taxa_fixa: e.target.value })} />
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-[#222222] space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer text-white">
                                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 focus:ring-green-500" checked={formData.ativo} onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })} />
                                    Disponível para uso nas Vendas
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-white">
                                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 focus:ring-blue-500" checked={formData.tem_entrada} onChange={(e) => setFormData({ ...formData, tem_entrada: e.target.checked })} />
                                    <div>
                                        <span className="font-medium">Aceita Entrada</span>
                                        <p className="text-xs text-[#888888] mt-0.5">Permite informar um valor de entrada + parcelas ao registrar uma venda</p>
                                    </div>
                                </label>
                            </div>

                            {formData.tem_entrada && (
                                <div className="grid grid-cols-2 gap-4 p-4 mt-4 bg-blue-500/5 border border-blue-500/20 rounded-xl animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <label className="block text-xs font-medium text-[#888] uppercase tracking-wider mb-1">Taxa da Entrada (%)</label>
                                        <input type="number" step="0.01" className="w-full bg-[#111] border border-[#2A2A2A] text-white focus:ring-blue-500" value={formData.taxa_entrada_percentual} onChange={(e) => setFormData({ ...formData, taxa_entrada_percentual: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[#888] uppercase tracking-wider mb-1">Taxa Fixa Entrada (R$)</label>
                                        <input type="number" step="0.01" className="w-full bg-[#111] border border-[#2A2A2A] text-white focus:ring-blue-500" value={formData.taxa_entrada_fixa} onChange={(e) => setFormData({ ...formData, taxa_entrada_fixa: e.target.value })} />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-8 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-[#888888] hover:text-white transition-colors">Cancelar</button>
                                <button type="submit" className="btn-primary">{editingGatewayId ? "Salvar Alterações" : "Criar Gateway"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
