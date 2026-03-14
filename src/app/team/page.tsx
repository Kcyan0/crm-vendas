"use client";

import { useState, useEffect } from "react";
import { UserPlus, MoreVertical, CreditCard } from "lucide-react";
import { useProject } from "@/context/ProjectContext";

type User = {
    id_usuario: number;
    nome: string;
    email: string;
    tipo: string;
    ativo: number;
    salario_fixo_mensal: number;
    percentual_comissao_sdr: number;
    percentual_comissao_closer: number;
};

export default function TeamPage() {
    const [team, setTeam] = useState<User[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUserId, setEditingUserId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        nome: "", email: "", tipo: "SDR", salario: "0", pctSdr: "0", pctCloser: "0", ativo: true
    });

    const { selectedProject } = useProject();

    const fetchUsers = () => {
        if (!selectedProject) return;
        fetch(`/api/users?projectId=${selectedProject.id_projeto}`)
            .then(res => res.json())
            .then(data => setTeam(data));
    };

    useEffect(() => {
        if (selectedProject) {
            fetchUsers();
        }
    }, [selectedProject]);

    const handleOpenCreate = () => {
        setEditingUserId(null);
        setFormData({ nome: "", email: "", tipo: "SDR", salario: "0", pctSdr: "0", pctCloser: "0", ativo: true });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (user: User) => {
        setEditingUserId(user.id_usuario);
        setFormData({
            nome: user.nome,
            email: user.email,
            tipo: user.tipo,
            salario: user.salario_fixo_mensal?.toString() || "0",
            pctSdr: user.percentual_comissao_sdr?.toString() || "0",
            pctCloser: user.percentual_comissao_closer?.toString() || "0",
            ativo: user.ativo === 1
        });
        setIsModalOpen(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProject) return;
        try {
            const method = editingUserId ? "PUT" : "POST";
            const body = {
                id_usuario: editingUserId,
                nome: formData.nome,
                email: formData.email,
                tipo: formData.tipo,
                salario: parseFloat(formData.salario),
                pctSdr: parseFloat(formData.pctSdr),
                pctCloser: parseFloat(formData.pctCloser),
                ativo: formData.ativo,
                id_projeto: selectedProject.id_projeto
            };

            await fetch("/api/users", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            setIsModalOpen(false);
            fetchUsers();
        } catch (err) {
            console.error("Erro ao salvar usuário:", err);
        }
    };

    const handleDeleteUser = async () => {
        if (!editingUserId) return;
        if (!confirm('Deseja realmente remover este membro da equipe permanentemente?')) return;
        try {
            await fetch(`/api/users?id=${editingUserId}`, { method: 'DELETE' });
            setIsModalOpen(false);
            fetchUsers();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="pt-4 h-full flex flex-col">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Gestão do Time</h2>
                    <p className="text-[#888888] mt-1">Configure permissões, comissionamentos e salários.</p>
                </div>
                <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2">
                    <UserPlus size={18} />
                    <span>Novo Membro</span>
                </button>
            </div>

            <div className="glass-panel overflow-hidden bg-[#1A1A1A]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[#2A2A2A] bg-[#111111]">
                                <th className="p-4 text-xs font-semibold text-[#888888] tracking-wider uppercase">Nome / Cargo</th>
                                <th className="p-4 text-xs font-semibold text-[#888888] tracking-wider uppercase">Status</th>
                                <th className="p-4 text-xs font-semibold text-[#888888] tracking-wider uppercase">Salário Fixo</th>
                                <th className="p-4 text-xs font-semibold text-[#888888] tracking-wider uppercase">Comissão SDR</th>
                                <th className="p-4 text-xs font-semibold text-[#888888] tracking-wider uppercase">Comissão Closer</th>
                                <th className="p-4 text-xs font-semibold text-[#888888] tracking-wider uppercase text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {team.map((member) => (
                                <tr key={member.id_usuario} className="hover:bg-[#111111] transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white font-bold border border-[#2A2A2A]">
                                                {member.nome.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-white">{member.nome}</p>
                                                <p className="text-xs text-[#888888]">{member.email}</p>
                                                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600">
                                                    {member.tipo}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${member.ativo ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-600 border-red-200'}`}>
                                            {member.ativo ? "Ativo" : "Inativo"}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-white font-bold">
                                            <CreditCard size={14} className="text-[#666666]" />
                                            R$ {member.salario_fixo_mensal?.toFixed(2) || '0.00'}
                                        </div>
                                    </td>
                                    <td className="p-4 text-white font-bold">
                                        {member.percentual_comissao_sdr}%
                                    </td>
                                    <td className="p-4 text-white font-bold">
                                        {member.percentual_comissao_closer}%
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleOpenEdit(member)}
                                            className="p-2 text-orange-500 hover:text-orange-700 rounded-lg hover:bg-orange-50 transition-colors font-bold text-sm"
                                        >
                                            Editar
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {team.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-[#888888]">
                                        Carregando membros...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Membro */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="glass-panel w-full max-w-lg p-6 relative bg-[#1A1A1A]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">
                                {editingUserId ? "Editar Membro" : "Novo Membro"}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-[#666666] hover:text-white">✕</button>
                        </div>

                        <form onSubmit={handleSaveUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white mb-1">Nome Completo *</label>
                                <input required type="text" className="w-full" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white mb-1">E-mail *</label>
                                <input required type="email" className="w-full" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-1">Cargo *</label>
                                    <select className="w-full bg-[#1A1A1A] border border-[#2A2A2A]" value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}>
                                        <option value="SDR">SDR</option>
                                        <option value="CLOSER">CLOSER</option>
                                        <option value="EXPERT">EXPERT</option>
                                        <option value="ADM">ADMIN</option>
                                    </select>
                                </div>
                                <div className="flex items-end pb-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-white">
                                        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 focus:ring-orange-500" checked={formData.ativo} onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })} />
                                        Usuário Ativo
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#222222]">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-1">Salário (R$)</label>
                                    <input type="number" step="0.01" className="w-full bg-[#1A1A1A]" value={formData.salario} onChange={(e) => setFormData({ ...formData, salario: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-1">% SDR</label>
                                    <input type="number" step="0.1" className="w-full bg-[#1A1A1A]" value={formData.pctSdr} onChange={(e) => setFormData({ ...formData, pctSdr: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-1">% Closer</label>
                                    <input type="number" step="0.1" className="w-full bg-[#1A1A1A]" value={formData.pctCloser} onChange={(e) => setFormData({ ...formData, pctCloser: e.target.value })} />
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-8 pt-4 border-t border-[#222222]">
                                {editingUserId ? (
                                    <button type="button" onClick={handleDeleteUser} className="px-4 py-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors font-bold">
                                        Excluir Membro
                                    </button>
                                ) : <div></div>}

                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-[#888888] hover:text-white transition-colors">Cancelar</button>
                                    <button type="submit" className="btn-primary">{editingUserId ? "Salvar Alterações" : "Criar Membro"}</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
