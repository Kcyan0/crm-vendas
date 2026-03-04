"use client";

import { useState, useEffect } from "react";
import { Plus, Check, X, Settings2, Trash2 } from "lucide-react";

type Gateway = {
    id_gateway: number;
    nome: string;
    taxa_percentual: number;
    taxa_fixa: number;
    ativo: number;
};

export default function SettingsPage() {
    const [gateways, setGateways] = useState<Gateway[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGatewayId, setEditingGatewayId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        nome: "",
        taxa_percentual: "0",
        taxa_fixa: "0",
        ativo: true
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

    useEffect(() => {
        fetchGateways();
    }, []);

    const handleOpenCreate = () => {
        setEditingGatewayId(null);
        setFormData({ nome: "", taxa_percentual: "0", taxa_fixa: "0", ativo: true });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (gateway: Gateway) => {
        setEditingGatewayId(gateway.id_gateway);
        setFormData({
            nome: gateway.nome,
            taxa_percentual: gateway.taxa_percentual.toString(),
            taxa_fixa: gateway.taxa_fixa.toString(),
            ativo: gateway.ativo === 1
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

    return (
        <div className="pt-4 h-full flex flex-col">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Configurações Gerais</h2>
                    <p className="text-slate-500 mt-1">Gerencie os Gateways, Formas de Pagamento e Taxas do sistema.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="glass-panel text-left p-6 h-fit bg-white border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                                <Settings2 size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Meios de Pagamento e Taxas</h3>
                        </div>
                        <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2 py-1.5 px-3 text-sm">
                            <Plus size={16} />
                            <span>Novo Gateway</span>
                        </button>
                    </div>

                    <div className="space-y-4">
                        {gateways.map(gw => (
                            <div key={gw.id_gateway} className={`p-4 rounded-xl border transition-all ${gw.ativo ? 'bg-slate-50 border-slate-200 hover:border-orange-300' : 'bg-slate-100 border-slate-200 opacity-60'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-slate-800 text-lg">{gw.nome}</h4>
                                            {!gw.ativo && <span className="text-[10px] uppercase font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">Inativo</span>}
                                        </div>
                                        <div className="flex gap-4 mt-2">
                                            <div className="text-sm">
                                                <span className="text-slate-500 block text-xs font-semibold uppercase">Taxa (%)</span>
                                                <span className="text-slate-700 font-bold">{gw.taxa_percentual.toFixed(2)}%</span>
                                            </div>
                                            <div className="text-sm">
                                                <span className="text-slate-500 block text-xs font-semibold uppercase">Taxa Fixa (R$)</span>
                                                <span className="text-slate-700 font-bold">R$ {gw.taxa_fixa.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleOpenEdit(gw)} className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors text-sm font-bold">Editar</button>
                                        <button onClick={() => handleDelete(gw.id_gateway)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {gateways.length === 0 && (
                            <div className="text-center p-8 text-slate-500 border border-dashed border-slate-300 rounded-xl">
                                Nenhum Gateway Cadastrado.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Gateway */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="glass-panel w-full max-w-md p-6 relative bg-white border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">
                                {editingGatewayId ? "Editar Gateway" : "Novo Gateway"}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800">✕</button>
                        </div>

                        <form onSubmit={handleSaveGateway} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome / Operadora *</label>
                                <input required type="text" className="w-full bg-white border border-slate-200" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Stripe, Pagar.me..." />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Taxa por venda (%)</label>
                                    <input type="number" step="0.01" className="w-full bg-white border border-slate-200" value={formData.taxa_percentual} onChange={(e) => setFormData({ ...formData, taxa_percentual: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Taxa Fixa (R$)</label>
                                    <input type="number" step="0.01" className="w-full bg-white border border-slate-200" value={formData.taxa_fixa} onChange={(e) => setFormData({ ...formData, taxa_fixa: e.target.value })} />
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 focus:ring-orange-500" checked={formData.ativo} onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })} />
                                    Disponível para uso nas Vendas
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 mt-8 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 hover:text-slate-800 transition-colors">Cancelar</button>
                                <button type="submit" className="btn-primary">{editingGatewayId ? "Salvar Alterações" : "Criar Gateway"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
