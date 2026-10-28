"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Settings2 } from "lucide-react";
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

export function PaymentsSection() {
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
        if (!selectedProject?.id_projeto) {
            setGateways([]);
            return;
        }
        try {
            const res = await fetch(`/api/gateways?projectId=${selectedProject.id_projeto}`);
            const data = await res.json();
            setGateways(data);
        } catch (e) {
            console.error("Failed to fetch gateways", e);
        }
    };

    useEffect(() => { fetchGateways(); }, [selectedProject]);

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
        if (!selectedProject?.id_projeto) return;
        try {
            const method = editingGatewayId ? "PUT" : "POST";
            await fetch("/api/gateways", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id_gateway: editingGatewayId,
                    ...formData,
                    taxa_percentual: parseFloat(formData.taxa_percentual),
                    taxa_fixa: parseFloat(formData.taxa_fixa),
                    // Only send id_projeto on creation (PUT doesn't change project)
                    ...(!editingGatewayId && { id_projeto: selectedProject.id_projeto }),
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

    return (
        <div className="flex flex-col">
            {/* ── Gateways ──────────────────────────────── */}
            <div className="max-w-3xl">
                <div className="glass-panel text-left p-6 h-fit bg-surface border-str">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-surface text-green-700 rounded-lg">
                                <Settings2 size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Meios de Pagamento e Taxas</h3>
                                {selectedProject && (
                                    <p className="text-xs text-sec mt-0.5">Projeto: <span className="text-accent font-bold">{selectedProject.nome}</span></p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={handleOpenCreate}
                            disabled={!selectedProject}
                            className="btn-primary flex items-center gap-2 py-1.5 px-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Plus size={16} />
                            <span>Novo Gateway</span>
                        </button>
                    </div>

                    <div className="space-y-4">
                        {!selectedProject ? (
                            <div className="text-center py-8 border-2 border-dashed border-str rounded-xl text-sec text-sm">
                                Selecione um projeto para ver e gerenciar seus gateways.
                            </div>
                        ) : gateways.length === 0 ? (
                            <div className="text-center p-8 text-sec border border-dashed border-slate-300 rounded-xl">
                                Nenhum gateway cadastrado para este projeto.
                            </div>
                        ) : (
                            gateways.map(gw => (
                                <div key={gw.id_gateway} className={`p-4 rounded-xl border transition-all ${gw.ativo ? 'bg-app border-str hover:border-green-300' : 'bg-surface border-str opacity-60'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-white text-lg">{gw.nome}</h4>
                                                {!gw.ativo && <span className="text-[10px] uppercase font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">Inativo</span>}
                                            </div>
                                            <div className="flex gap-4 mt-2">
                                                <div className="text-sm">
                                                    <span className="text-sec block text-xs font-semibold uppercase">Taxa (%)</span>
                                                    <span className="text-white font-bold">{gw.taxa_percentual.toFixed(2)}%</span>
                                                </div>
                                                <div className="text-sm">
                                                    <span className="text-sec block text-xs font-semibold uppercase">Taxa Fixa (R$)</span>
                                                    <span className="text-white font-bold">R$ {gw.taxa_fixa.toFixed(2)}</span>
                                                </div>
                                                {gw.tem_entrada && (
                                                    <div className="text-sm">
                                                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded mt-1">Aceita Entrada</span>
                                                        <span className="text-sec block text-xs font-semibold uppercase mt-1">Taxa Entrada: <span className="text-white">{gw.taxa_entrada_percentual?.toFixed(2) || '0.00'}%</span></span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleOpenEdit(gw)} className="p-2 text-green-500 hover:bg-app rounded-lg transition-colors text-sm font-bold">Editar</button>
                                            <button onClick={() => handleDelete(gw.id_gateway)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Gateway */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="glass-panel w-full max-w-md p-6 relative bg-surface border-str">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">
                                {editingGatewayId ? "Editar Gateway" : "Novo Gateway"}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-sec hover:text-white">✕</button>
                        </div>

                        <form onSubmit={handleSaveGateway} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white mb-1">Nome / Operadora *</label>
                                <input required type="text" className="w-full bg-surface border border-str" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Stripe, Pagar.me..." />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-1">Taxa por venda (%)</label>
                                    <input type="number" step="0.01" className="w-full bg-surface border border-str" value={formData.taxa_percentual} onChange={(e) => setFormData({ ...formData, taxa_percentual: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-1">Taxa Fixa (R$)</label>
                                    <input type="number" step="0.01" className="w-full bg-surface border border-str" value={formData.taxa_fixa} onChange={(e) => setFormData({ ...formData, taxa_fixa: e.target.value })} />
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
                                        <p className="text-xs text-sec mt-0.5">Permite informar um valor de entrada + parcelas ao registrar uma venda</p>
                                    </div>
                                </label>
                            </div>

                            {formData.tem_entrada && (
                                <div className="grid grid-cols-2 gap-4 p-4 mt-4 bg-blue-500/5 border border-blue-500/20 rounded-xl animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <label className="block text-xs font-medium text-sec uppercase tracking-wider mb-1">Taxa da Entrada (%)</label>
                                        <input type="number" step="0.01" className="w-full bg-app border border-str text-white focus:ring-blue-500" value={formData.taxa_entrada_percentual} onChange={(e) => setFormData({ ...formData, taxa_entrada_percentual: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-sec uppercase tracking-wider mb-1">Taxa Fixa Entrada (R$)</label>
                                        <input type="number" step="0.01" className="w-full bg-app border border-str text-white focus:ring-blue-500" value={formData.taxa_entrada_fixa} onChange={(e) => setFormData({ ...formData, taxa_entrada_fixa: e.target.value })} />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-8 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sec hover:text-white transition-colors">Cancelar</button>
                                <button type="submit" className="btn-primary">{editingGatewayId ? "Salvar Alterações" : "Criar Gateway"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
