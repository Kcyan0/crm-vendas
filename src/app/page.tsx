"use client";

import { useState, useEffect } from "react";
import { Search, Plus, User, Phone, Instagram, Clock } from "lucide-react";
import { useProject } from '@/context/ProjectContext';

type Lead = {
  id_lead: number;
  nome: string;
  telefone: string;
  instagram: string;
  email: string;
  origem: string;
  observacoes_gerais: string;
  status_atual: string;
  sdr_nome: string;
  closer_nome: string;
  id_sdr_responsavel: number | null;
  id_closer_responsavel: number | null;
  valor_proposta: number | null;
  data_entrada: string;
};

const KANBAN_COLUMNS = [
  "Novo",
  "Follow-up",
  "Remarcado",
  "No-show",
  "Venda",
  "Reembolsado",
  "Loss"
];

export default function KanbanBoard() {
  const { selectedProject } = useProject();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    instagram: "",
    email: "",
    origem: "",
    id_sdr_responsavel: "",
    id_closer_responsavel: "",
    observacoes_gerais: "",
    data_entrada: ""
  });

  // Sales Modal State
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [saleLead, setSaleLead] = useState<Lead | null>(null);
  const [saleFormData, setSaleFormData] = useState({
    valor_bruto: "",
    desconto_concedido: "0",
    forma_pagamento: "",
    numero_parcelas: "1",
    taxa_gateway: "0"
  });

  const [gateways, setGateways] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedProject) {
      setLoading(false);
      return;
    }
    fetchLeads();
    fetchUsers();
    fetchGateways();
  }, [selectedProject]);

  const fetchGateways = async () => {
    try {
      const res = await fetch("/api/gateways");
      const data = await res.json();
      const ativos = data.filter((g: any) => g.ativo === 1);
      setGateways(ativos);
      if (ativos.length > 0) {
        setSaleFormData(prev => ({ ...prev, forma_pagamento: ativos[0].nome }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/users?projectId=${selectedProject.id_projeto}`);
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/leads?projectId=${selectedProject?.id_projeto}`);
      const data = await res.json();
      setLeads(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, id_lead: number) => {
    e.dataTransfer.setData("id_lead", id_lead.toString());
  };

  const handleDrop = async (e: React.DragEvent, status_novo: string) => {
    e.preventDefault();
    const id_lead = parseInt(e.dataTransfer.getData("id_lead"));

    if (!id_lead) return;

    // Intercept when dropping on "Venda"
    if (status_novo === "Venda") {
      const leadInfo = leads.find((l) => l.id_lead === id_lead);
      if (leadInfo && leadInfo.status_atual !== "Venda") {
        setSaleLead(leadInfo);

        // Setup initial default gateway fee if exists and total prop value is present
        const propValue = leadInfo.valor_proposta ? leadInfo.valor_proposta.toString() : "";
        if (propValue && gateways.length > 0) {
          const gw = gateways[0];
          const val = parseFloat(propValue);
          let calculatedTax = 0;
          if (!isNaN(val)) {
            calculatedTax = (val * (gw.taxa_percentual / 100)) + gw.taxa_fixa;
          }
          setSaleFormData({
            valor_bruto: propValue,
            desconto_concedido: "0",
            forma_pagamento: gw.nome,
            numero_parcelas: "1",
            taxa_gateway: calculatedTax.toFixed(2)
          });
        } else {
          setSaleFormData({
            valor_bruto: propValue,
            desconto_concedido: "0",
            forma_pagamento: gateways.length > 0 ? gateways[0].nome : "PIX",
            numero_parcelas: "1",
            taxa_gateway: "0"
          });
        }

        setIsSaleModalOpen(true);
      }
      return; // Stop the standard status logic update because it's a financial action
    }

    // Optimistic Update for standard columns
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id_lead === id_lead ? { ...lead, status_atual: status_novo } : lead
      )
    );

    // Persist to DB
    try {
      await fetch("/api/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_lead, status_atual: status_novo }),
      });
    } catch (err) {
      console.error("Failed to update status", err);
      fetchLeads(); // Revert on failure
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessário para permitir o drop
  };

  const handleOpenCreate = () => {
    setEditingLeadId(null);
    const now = new Date();
    // Ajuste fuso local para YYYY-MM-DDTHH:mm
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setFormData({
      nome: "", telefone: "", instagram: "", email: "", origem: "", id_sdr_responsavel: "", id_closer_responsavel: "", observacoes_gerais: "",
      data_entrada: now.toISOString().slice(0, 16)
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (lead: Lead) => {
    setEditingLeadId(lead.id_lead);

    const dEntrada = lead.data_entrada ? new Date(lead.data_entrada) : new Date();
    if (lead.data_entrada && !lead.data_entrada.includes('Z')) {
      // Handle timezone correction for SQLite string if needed, basic mapping:
      dEntrada.setMinutes(dEntrada.getMinutes() - dEntrada.getTimezoneOffset());
    }

    setFormData({
      nome: lead.nome || "",
      telefone: lead.telefone || "",
      instagram: lead.instagram || "",
      email: lead.email || "",
      origem: lead.origem || "",
      id_sdr_responsavel: lead.id_sdr_responsavel?.toString() || "",
      id_closer_responsavel: lead.id_closer_responsavel?.toString() || "",
      observacoes_gerais: lead.observacoes_gerais || "",
      data_entrada: lead.data_entrada ? lead.data_entrada.replace(' ', 'T').slice(0, 16) : dEntrada.toISOString().slice(0, 16)
    });
    setIsModalOpen(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      const isEdit = editingLeadId !== null;
      const method = isEdit ? "PUT" : "POST";

      await fetch("/api/leads", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          id_lead: editingLeadId,
          is_full_update: isEdit ? true : undefined,
          id_sdr_responsavel: formData.id_sdr_responsavel ? parseInt(formData.id_sdr_responsavel) : null,
          id_closer_responsavel: formData.id_closer_responsavel ? parseInt(formData.id_closer_responsavel) : null,
          id_projeto: selectedProject.id_projeto
        }),
      });
      setIsModalOpen(false);
      setFormData({
        nome: "", telefone: "", instagram: "", email: "", origem: "", id_sdr_responsavel: "", id_closer_responsavel: "", observacoes_gerais: "", data_entrada: ""
      });
      fetchLeads();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleLead) return;

    try {
      await fetch("/api/vendas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_lead: saleLead.id_lead,
          valor_bruto: saleFormData.valor_bruto,
          desconto_concedido: saleFormData.desconto_concedido,
          forma_pagamento: saleFormData.forma_pagamento,
          numero_parcelas: saleFormData.numero_parcelas,
          taxa_gateway: saleFormData.taxa_gateway,
          id_sdr: saleLead.id_sdr_responsavel,
          id_closer: saleLead.id_closer_responsavel
        }),
      });

      setIsSaleModalOpen(false);
      setSaleLead(null);
      setSaleFormData({ valor_bruto: "", desconto_concedido: "0", forma_pagamento: "PIX", numero_parcelas: "1", taxa_gateway: "0" });
      fetchLeads(); // Refresh board so card jumps to 'Venda' with Value displayed
    } catch (err) {
      console.error(err);
    }
  };

  const formatDateBr = (dStr: string | null | undefined) => {
    if (!dStr) return "Sem data";
    try {
      const normalized = dStr.replace('T', ' ');
      const [datePart, timePart] = normalized.split(' ');
      if (!datePart) return dStr;
      const [y, m, d] = datePart.split('-');
      if (!timePart) return `${d}/${m}/${y}`;
      const [hr, min] = timePart.split(':');
      return `${d}/${m} ${hr}:${min}`;
    } catch {
      return "Data Indisponível";
    }
  };

  const handleDeleteLead = async () => {
    if (!editingLeadId) return;
    if (!confirm('Deseja realmente excluir permanentemente este Lead?')) return;
    try {
      await fetch(`/api/leads?id=${editingLeadId}`, { method: 'DELETE' });
      setIsModalOpen(false);
      fetchLeads();
    } catch (err) {
      console.error(err);
    }
  };

  const handleGatewaySelectionChange = (gatewayName: string) => {
    const gw = gateways.find(g => g.nome === gatewayName);
    if (!gw) {
      setSaleFormData(prev => ({ ...prev, forma_pagamento: gatewayName, taxa_gateway: "0" }));
      return;
    }

    // Auto-calculate fee based on currently typed value
    const valBruto = parseFloat(saleFormData.valor_bruto) || 0;
    const desconto = parseFloat(saleFormData.desconto_concedido) || 0;
    const base = valBruto - desconto;

    let calculatedTax = 0;
    if (base > 0) {
      calculatedTax = (base * (gw.taxa_percentual / 100)) + gw.taxa_fixa;
    }

    setSaleFormData(prev => ({
      ...prev,
      forma_pagamento: gatewayName,
      taxa_gateway: calculatedTax.toFixed(2)
    }));
  };

  const handleValueChangeForFeeCalculation = (e: React.ChangeEvent<HTMLInputElement>, field: 'valor_bruto' | 'desconto_concedido') => {
    const newVal = e.target.value;

    setSaleFormData(prev => {
      const updatedState = { ...prev, [field]: newVal };

      const gw = gateways.find(g => g.nome === updatedState.forma_pagamento);
      if (gw) {
        const valBruto = parseFloat(updatedState.valor_bruto) || 0;
        const desconto = parseFloat(updatedState.desconto_concedido) || 0;
        const base = valBruto - desconto;

        if (base > 0) {
          updatedState.taxa_gateway = ((base * (gw.taxa_percentual / 100)) + gw.taxa_fixa).toFixed(2);
        } else {
          updatedState.taxa_gateway = "0";
        }
      }
      return updatedState;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-indigo-400">
        Carregando leads...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pt-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Quadro de Leads</h2>
          <p className="text-slate-500 mt-1">Arraste os cards para atualizar o status no pipeline.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar lead..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-orange-500/50 w-full md:w-64"
            />
          </div>
          <button
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
            onClick={handleOpenCreate}
          >
            <Plus size={18} />
            <span>Novo Lead</span>
          </button>
        </div>
      </div>

      {/* Kanban Board Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-4 pb-4">
        {KANBAN_COLUMNS.map((col) => {
          const columnLeads = leads.filter((l) => l.status_atual === col || (col === 'Loss' && l.status_atual === 'Nao prosseguiu'));

          return (
            <div
              key={col}
              className="kanban-col min-w-[320px] w-[320px] flex flex-col h-full bg-slate-100/50"
              onDrop={(e) => handleDrop(e, col)}
              onDragOver={handleDragOver}
            >
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-200/50 rounded-t-xl">
                <h3 className="font-semibold text-slate-700">{col}</h3>
                <span className="bg-orange-100 text-orange-600 text-xs px-2 py-1 rounded-full font-bold shadow-sm">
                  {columnLeads.length}
                </span>
              </div>

              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                {columnLeads.map((lead) => (
                  <div
                    key={lead.id_lead}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id_lead)}
                    onDoubleClick={() => handleOpenEdit(lead)}
                    className="glass-panel p-4 cursor-grab active:cursor-grabbing hover:-translate-y-1 border-slate-200 hover:border-orange-300 transition-all select-none group relative bg-white"
                  >
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(lead); }} className="text-slate-500 hover:text-slate-800 px-2 py-1 text-xs bg-slate-100 rounded shadow-sm border border-slate-200">Editar</button>
                    </div>
                    <div className="flex justify-between items-start mb-2 pr-12">
                      <h4 className="font-bold text-slate-800 leading-tight">{lead.nome}</h4>
                      {lead.valor_proposta && (
                        <span className="text-emerald-700 font-bold text-sm bg-emerald-100 px-2 rounded-md border border-emerald-200">
                          R$ {lead.valor_proposta}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 mt-3">
                      {lead.telefone && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Phone size={14} className="text-slate-500" />
                          <span>{lead.telefone}</span>
                        </div>
                      )}
                      {lead.instagram && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Instagram size={14} className="text-slate-500" />
                          <span>{lead.instagram}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                      <div className="flex -space-x-2">
                        {lead.sdr_nome && (
                          <div
                            className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 border-2 border-white"
                            title={`SDR: ${lead.sdr_nome}`}
                          >
                            {lead.sdr_nome.charAt(0)}
                          </div>
                        )}
                        {lead.closer_nome && (
                          <div
                            className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-700 border-2 border-white"
                            title={`Closer: ${lead.closer_nome}`}
                          >
                            {lead.closer_nome.charAt(0)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                        <Clock size={12} />
                        <span>{formatDateBr(lead.data_entrada)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {columnLeads.length === 0 && (
                  <div className="h-24 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 text-sm font-medium">
                    Arraste leads para cá
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Novo Lead */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 text-left">
          <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative bg-white">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">{editingLeadId ? "Editar Lead" : "Adicionar Novo Lead"}</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                  <input
                    required
                    type="text"
                    className="w-full"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    className="w-full"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data de Entrada</label>
                  <input
                    type="datetime-local"
                    className="w-full bg-white border border-slate-200"
                    value={formData.data_entrada}
                    onChange={(e) => setFormData({ ...formData, data_entrada: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                  <input
                    type="text"
                    className="w-full"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Instagram</label>
                  <input
                    type="text"
                    className="w-full"
                    placeholder="@"
                    value={formData.instagram}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Origem</label>
                  <select
                    className="w-full bg-white border border-slate-200"
                    value={formData.origem}
                    onChange={(e) => setFormData({ ...formData, origem: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    <option value="Tráfego Pago">Tráfego Pago</option>
                    <option value="Orgânico">Orgânico</option>
                    <option value="Indicação">Indicação</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SDR Responsável</label>
                  <select
                    className="w-full bg-white border border-slate-200"
                    value={formData.id_sdr_responsavel}
                    onChange={(e) => setFormData({ ...formData, id_sdr_responsavel: e.target.value })}
                  >
                    <option value="">Sem SDR</option>
                    {users.filter(u => u.tipo === 'SDR' || u.tipo === 'ADM').map(u => (
                      <option key={u.id_usuario} value={u.id_usuario}>{u.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Closer Responsável</label>
                  <select
                    className="w-full bg-white border border-slate-200"
                    value={formData.id_closer_responsavel}
                    onChange={(e) => setFormData({ ...formData, id_closer_responsavel: e.target.value })}
                  >
                    <option value="">Sem Closer</option>
                    {users.filter(u => u.tipo === 'CLOSER' || u.tipo === 'ADM').map(u => (
                      <option key={u.id_usuario} value={u.id_usuario}>{u.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações Gerais</label>
                <textarea
                  className="w-full min-h-[100px]"
                  value={formData.observacoes_gerais}
                  onChange={(e) => setFormData({ ...formData, observacoes_gerais: e.target.value })}
                ></textarea>
              </div>

              <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
                {editingLeadId ? (
                  <button type="button" onClick={handleDeleteLead} className="px-4 py-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-2">
                    Excluir Lead
                  </button>
                ) : <div></div>}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingLeadId ? "Salvar Alterações" : "Criar Lead"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Fechamento de Venda */}
      {isSaleModalOpen && saleLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 text-left">
          <div className="glass-panel w-full max-w-lg p-6 relative border border-orange-200 shadow-[0_0_50px_rgba(249,115,22,0.1)] bg-white">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-orange-500">Registrar Venda! 🎉</h3>
                <p className="text-sm text-slate-500 mt-1">Preencha os detalhes financeiros para {saleLead.nome}</p>
              </div>
              <button
                onClick={() => setIsSaleModalOpen(false)}
                className="text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSale} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor Bruto da Venda (R$) *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  className="w-full text-lg font-bold text-orange-600 focus:border-orange-500 bg-orange-50"
                  placeholder="Ex: 1500.00"
                  value={saleFormData.valor_bruto}
                  onChange={(e) => handleValueChangeForFeeCalculation(e, 'valor_bruto')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Desconto Concedido (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full"
                    placeholder="Ex: 100.00"
                    value={saleFormData.desconto_concedido}
                    onChange={(e) => handleValueChangeForFeeCalculation(e, 'desconto_concedido')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Taxa de Gateway (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full"
                    placeholder="Custos de transação"
                    value={saleFormData.taxa_gateway}
                    onChange={(e) => setSaleFormData({ ...saleFormData, taxa_gateway: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Meio de Pagamento *</label>
                  <select
                    required
                    className="w-full bg-white border border-slate-200 focus:border-orange-500"
                    value={saleFormData.forma_pagamento}
                    onChange={(e) => handleGatewaySelectionChange(e.target.value)}
                  >
                    {gateways.length === 0 ? (
                      <option value="PIX">PIX</option>
                    ) : (
                      gateways.map(gw => (
                        <option key={gw.id_gateway} value={gw.nome}>{gw.nome}</option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Parcelas *</label>
                  <select
                    required
                    className="w-full bg-white border border-slate-200 focus:border-orange-500"
                    value={saleFormData.numero_parcelas}
                    onChange={(e) => setSaleFormData({ ...saleFormData, numero_parcelas: e.target.value })}
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}x</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                * A taxa do Gateway foi auto-calculada pelas Configurações, mas você pode sobrescrevê-la.
                O fluxo de caixa será dividido igualmente pelo número de parcelas informadas.
              </p>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSaleModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Confirmar Venda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
