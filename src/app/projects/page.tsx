"use client";

import { useState } from "react";
import { FolderKanban, Plus, CheckCircle2, MoreVertical, LayoutDashboard } from "lucide-react";
import { useProject } from "@/context/ProjectContext";

export default function ProjectsPage() {
    const { projetos, selectedProject, setSelectedProject, isLoading } = useProject();
    const [newProjectName, setNewProjectName] = useState("");
    const [newProjectDesc, setNewProjectDesc] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [editName, setEditName] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;

        setIsCreating(true);
        try {
            const res = await fetch("/api/projetos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: newProjectName, descricao: newProjectDesc }),
            });
            const data = await res.json();
            if (data.success) {
                // Ao recarregar a página (com window.location.reload dentro do setSelectedProject ou aqui),
                // o servidor buscará a lista novamente. Mas vamos apenas recarregar para pegar o estado limpo.
                window.location.reload();
            } else {
                alert("Erro ao criar projeto: " + data.error);
            }
        } catch (error) {
            console.error("Erro na criação:", error);
            alert("Erro inesperado ao criar projeto.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleOpenEdit = (projeto: any) => {
        setEditingProject(projeto);
        setEditName(projeto.nome);
        setEditDesc(projeto.descricao || "");
        setIsEditModalOpen(true);
        setOpenMenuId(null);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editName.trim() || !editingProject) return;

        try {
            const res = await fetch("/api/projetos", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_projeto: editingProject.id_projeto, nome: editName, descricao: editDesc }),
            });
            const data = await res.json();
            if (data.success) {
                window.location.reload();
            } else {
                alert("Erro ao editar projeto: " + data.error);
            }
        } catch (error) {
            console.error(error);
            alert("Erro inesperado ao editar projeto.");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir este projeto? Todos os leads e vendas associados a ele serão impactados e podem ficar órfãos.")) return;

        try {
            const res = await fetch(`/api/projetos?id=${id}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (data.success) {
                if (selectedProject?.id_projeto === id) {
                    localStorage.removeItem('feracrm_selected_project');
                }
                window.location.reload();
            } else {
                alert("Erro ao excluir projeto: " + data.error);
            }
        } catch (error) {
            console.error(error);
            alert("Erro inesperado.");
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                        <FolderKanban className="text-orange-500" size={32} />
                        Projetos
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">
                        Gerencie diferentes funis, equipes e dashboards separadamente.
                    </p>
                </div>
            </div>

            {/* Aviso (Opcional baseado na imagem base) */}
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-3 text-orange-800">
                <LayoutDashboard className="shrink-0 mt-0.5" size={20} />
                <div className="text-sm">
                    <strong className="block mb-1">Múltiplos Ambientes Isolados</strong>
                    Cada projeto possui seus próprios Leads, Relatórios de Performance, Dashboard Financeiro e histórico.
                    A troca de projetos na Barra Lateral recarrega todo o sistema para o novo contexto.
                </div>
            </div>

            {/* Criar Novo Projeto */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800">Criar Novo Projeto</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Inicie um novo ambiente para separar operações de vendas.
                    </p>
                </div>
                <div className="p-6 bg-slate-50/50">
                    <form onSubmit={handleCreateProject} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full relative">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                                Nome do Projeto
                            </label>
                            <input
                                type="text"
                                placeholder="ex: Campanha Enterprise US"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 block p-3.5 transition-all shadow-sm"
                                required
                            />
                        </div>
                        <div className="flex-1 w-full relative">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                                Descrição (Opcional)
                            </label>
                            <input
                                type="text"
                                placeholder="ex: Leads B2B Internacionais"
                                value={newProjectDesc}
                                onChange={(e) => setNewProjectDesc(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 block p-3.5 transition-all shadow-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 px-6 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {isCreating ? (
                                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <Plus size={20} />
                            )}
                            Criar Projeto
                        </button>
                    </form>
                </div>
            </div>

            {/* Lista de Projetos */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        Seus Projetos
                        <span className="bg-slate-100 text-slate-600 text-xs py-1 px-2.5 rounded-full font-bold">
                            {projetos.length}
                        </span>
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Selecione um projeto para torná-old o ambiente ativo no CRM.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projetos.map((projeto) => {
                        const isSelected = selectedProject?.id_projeto === projeto.id_projeto;

                        return (
                            <div
                                key={projeto.id_projeto}
                                className={`bg-white rounded-3xl border ${isSelected ? 'border-orange-500 ring-4 ring-orange-50' : 'border-slate-200 hover:border-slate-300'} p-6 shadow-sm transition-all relative overflow-visible flex flex-col h-full`}
                            >
                                <div className="absolute top-4 right-4 flex items-center gap-2">
                                    {isSelected && (
                                        <div className="bg-orange-100 text-orange-600 p-1.5 rounded-full">
                                            <CheckCircle2 size={16} className="fill-orange-100" />
                                        </div>
                                    )}
                                    <div className="relative">
                                        <button
                                            onClick={() => setOpenMenuId(openMenuId === projeto.id_projeto ? null : projeto.id_projeto)}
                                            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
                                        >
                                            <MoreVertical size={20} />
                                        </button>

                                        {openMenuId === projeto.id_projeto && (
                                            <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-lg shadow-black/10 border border-slate-100 z-10 py-1 overflow-hidden">
                                                <button
                                                    onClick={() => handleOpenEdit(projeto)}
                                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors font-medium"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(projeto.id_projeto)}
                                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mb-4 pr-16 mt-2">
                                    <h3 className="text-lg font-bold text-slate-800 truncate" title={projeto.nome}>
                                        {projeto.nome}
                                    </h3>
                                    <p className="text-sm text-slate-500 line-clamp-2 mt-1 min-h-[40px]">
                                        {projeto.descricao || "Sem descrição"}
                                    </p>
                                </div>

                                <div className="mt-auto pt-6 border-t border-slate-100">
                                    {isSelected ? (
                                        <button
                                            disabled
                                            className="w-full bg-slate-50 text-slate-500 font-bold py-3 px-4 rounded-xl flex justify-center items-center gap-2 cursor-default border border-slate-100"
                                        >
                                            <CheckCircle2 size={18} />
                                            Projeto Ativo
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setSelectedProject(projeto)}
                                            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl flex justify-center items-center transition-all shadow-sm"
                                        >
                                            Mudar para este Projeto
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 text-lg">Editar Projeto</h3>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleEditSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                                        Nome do Projeto
                                    </label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-orange-500 block p-3.5 transition-all outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                                        Descrição
                                    </label>
                                    <input
                                        type="text"
                                        value={editDesc}
                                        onChange={(e) => setEditDesc(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-orange-500 block p-3.5 transition-all outline-none"
                                    />
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold transition-all text-sm"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-bold transition-all shadow-md shadow-orange-500/20 text-sm"
                                    >
                                        Salvar Alterações
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
