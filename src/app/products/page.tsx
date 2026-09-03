"use client";

import { useState, useEffect } from "react";
import { useProject } from "@/context/ProjectContext";
import { Package, Plus, Pencil, X, Check, Loader2 } from "lucide-react";

type Produto = {
  id_produto: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
};

export default function ProductsPage() {
  const { selectedProject, isAdmin } = useProject();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ nome: "", descricao: "" });

  const fetchProdutos = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/produtos?projectId=${selectedProject.id_projeto}`);
      const data = await res.json();
      setProdutos(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProdutos(); }, [selectedProject]);

  const openCreate = () => { setEditingProduto(null); setForm({ nome: "", descricao: "" }); setIsModalOpen(true); };
  const openEdit = (p: Produto) => { setEditingProduto(p); setForm({ nome: p.nome, descricao: p.descricao || "" }); setIsModalOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || isSaving) return;
    setIsSaving(true);
    try {
      if (editingProduto) {
        await fetch("/api/produtos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id_produto: editingProduto.id_produto, nome: form.nome, descricao: form.descricao }) });
      } else {
        await fetch("/api/produtos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: form.nome, descricao: form.descricao, id_projeto: selectedProject.id_projeto }) });
      }
      setIsModalOpen(false);
      fetchProdutos();
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleDeactivate = async (id_produto: number) => {
    if (!confirm("Desativar este produto?")) return;
    await fetch(`/api/produtos?id=${id_produto}`, { method: "DELETE" });
    fetchProdutos();
  };

  if (!selectedProject) return (
    <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-sec)' }}>
      <div className="text-center"><Package size={48} className="mx-auto mb-4 opacity-30" /><p className="text-lg font-semibold">Selecione um projeto</p></div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-pri)' }}>Produtos</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-sec)' }}>Catálogo do projeto <span className="font-semibold" style={{ color: 'var(--accent)' }}>{selectedProject.nome}</span></p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
            <Plus size={16} />Novo Produto
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} /></div>
      ) : produtos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-2xl border" style={{ borderColor: 'var(--border)', color: 'var(--text-sec)' }}>
          <Package size={40} className="mb-4 opacity-30" /><p className="font-semibold text-lg">Nenhum produto cadastrado</p>
          <p className="text-sm mt-1">Clique em "Novo Produto" para começar</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="p-4 text-left text-xs font-bold uppercase" style={{ color: 'var(--text-sec)' }}>Produto</th>
                <th className="p-4 text-left text-xs font-bold uppercase hidden md:table-cell" style={{ color: 'var(--text-sec)' }}>Descrição</th>
                {isAdmin && <th className="p-4 text-right text-xs font-bold uppercase" style={{ color: 'var(--text-sec)' }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {produtos.map((p, i) => (
                <tr key={p.id_produto} className="border-b" style={{ borderColor: 'var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface-2)' }}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(var(--accent-rgb), 0.12)' }}>
                        <Package size={14} style={{ color: 'var(--accent)' }} />
                      </div>
                      <span className="font-semibold" style={{ color: 'var(--text-pri)' }}>{p.nome}</span>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell" style={{ color: 'var(--text-sec)' }}>{p.descricao || <span className="opacity-40">—</span>}</td>
                  {isAdmin && (
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg" style={{ background: 'var(--bg-surface-3)', color: 'var(--text-sec)' }}><Pencil size={14} /></button>
                        <button onClick={() => handleDeactivate(p.id_produto)} className="p-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}><X size={14} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl p-6 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-str)' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-pri)' }}>{editingProduto ? "Editar Produto" : "Novo Produto"}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ color: 'var(--text-sec)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-sec)' }}>Nome do Produto *</label>
                <input required type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Legacy Club, Mentoria 1:1..." className="w-full rounded-xl p-3 text-sm border focus:outline-none" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-str)', color: 'var(--text-pri)' }} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-sec)' }}>Descrição (opcional)</label>
                <textarea rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva o produto brevemente..." className="w-full rounded-xl p-3 text-sm border focus:outline-none resize-none" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-str)', color: 'var(--text-pri)' }} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: 'var(--border-str)', color: 'var(--text-sec)' }}>Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                  {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {editingProduto ? "Salvar" : "Criar Produto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
