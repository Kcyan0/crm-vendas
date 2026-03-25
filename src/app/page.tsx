"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Phone, Instagram, Clock, Download } from "lucide-react";
import { useProject } from '@/context/ProjectContext';
import { exportLeadsToCSV } from '@/lib/exportUtils';

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
  const [saleObservacoes, setSaleObservacoes] = useState("");

  type Pagamento = { id: string; forma_pagamento: string; valor: string; numero_parcelas: string; taxa_gateway: string; valor_entrada: string; };
  const newPagamento = (defaultGateway = ""): Pagamento => ({
    id: Math.random().toString(36).slice(2),
    forma_pagamento: defaultGateway,
    valor: "",
    numero_parcelas: "1",
    taxa_gateway: "0",
    valor_entrada: ""
  });
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([newPagamento()]);

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
      const ativos = data.filter((g: any) => g.ativo !== false && g.ativo !== 0);
      setGateways(ativos);
      if (ativos.length > 0) {
        setPagamentos([newPagamento(ativos[0].nome)]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const calcFee = (gatewayName: string, valor: string) => {
    const gw = gateways.find(g => g.nome === gatewayName);
    if (!gw) return "0";
    const v = parseFloat(valor) || 0;
    if (v <= 0) return "0";
    return ((v * (gw.taxa_percentual / 100)) + gw.taxa_fixa).toFixed(2);
  };

  const handlePagamentoChange = (id: string, field: keyof Pagamento, value: string) => {
    setPagamentos(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: value };
      // Recalculate the gateway fee on value or gateway changes (only on the full valor)
      if (field === 'forma_pagamento' || field === 'valor') {
        updated.taxa_gateway = calcFee(
          field === 'forma_pagamento' ? value : p.forma_pagamento,
          field === 'valor' ? value : p.valor
        );
      }
      return updated;
    }));
  };

  const addPagamento = () => {
    setPagamentos(prev => [...prev, newPagamento(gateways[0]?.nome || "")]);
  };

  const removePagamento = (id: string) => {
    setPagamentos(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev);
  };

  const saleTotals = pagamentos.reduce((acc, p) => {
    const v = parseFloat(p.valor) || 0;
    const taxa = parseFloat(p.taxa_gateway) || 0;
    acc.bruto += v;
    acc.liquido += v - taxa;
    return acc;
  }, { bruto: 0, liquido: 0 });

  const handleExportCSV = async () => {
    try {
      const url = selectedProject
        ? `/api/export-leads?projectId=${selectedProject.id_projeto}`
        : '/api/export-leads';
      const res = await fetch(url);
      const data = await res.json();
      exportLeadsToCSV(data);
    } catch (e) {
      console.error('Erro ao exportar:', e);
      alert('Erro ao exportar dados. Tente novamente.');
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
        const defaultGw = gateways[0]?.nome || "PIX";
        const propValue = leadInfo.valor_proposta ? leadInfo.valor_proposta.toString() : "";
        const initialPagamento = {
          id: Math.random().toString(36).slice(2),
          forma_pagamento: defaultGw,
          valor: propValue,
          numero_parcelas: "1",
          taxa_gateway: propValue ? calcFee(defaultGw, propValue) : "0",
          valor_entrada: ""
        };
        setPagamentos([initialPagamento]);
        setSaleObservacoes("");
        setSaleLead(leadInfo);
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
          pagamentos,
          observacoes: saleObservacoes,
          id_sdr: saleLead.id_sdr_responsavel,
          id_closer: saleLead.id_closer_responsavel
        }),
      });

      setIsSaleModalOpen(false);
      setSaleLead(null);
      setSaleObservacoes("");
      setPagamentos([newPagamento(gateways[0]?.nome || "")]);
      fetchLeads();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenEditSale = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/vendas?leadId=${lead.id_lead}`);
      const rows: any[] = await res.json();

      if (rows.length === 0) {
        // No existing rows? Open as a fresh sale
        const defaultGw = gateways[0]?.nome || "PIX";
        setPagamentos([newPagamento(defaultGw)]);
        setSaleObservacoes(lead.observacoes_gerais || "");
      } else {
        // Merge rows that share the same gateway (e.g. "Boleto (Entrada)" + "Boleto (Parcelas)")
        const mergedMap: Record<string, any> = {};
        for (const row of rows) {
          const baseGw = row.forma_pagamento.replace(/ \(Entrada\)| \(Parcelas\)/g, '');
          if (!mergedMap[baseGw]) {
            mergedMap[baseGw] = {
              id: Math.random().toString(36).slice(2),
              forma_pagamento: baseGw,
              valor: 0,
              numero_parcelas: row.numero_parcelas.toString(),
              taxa_gateway: 0,
              valor_entrada: ""
            };
          }
          if (row.forma_pagamento.includes('(Entrada)')) {
            mergedMap[baseGw].valor_entrada = row.valor_bruto.toString();
            mergedMap[baseGw].taxa_gateway += row.taxa_gateway;
          } else {
            mergedMap[baseGw].valor += row.valor_bruto;
            mergedMap[baseGw].numero_parcelas = row.numero_parcelas.toString();
            mergedMap[baseGw].taxa_gateway += row.taxa_gateway;
          }
          if (!row.forma_pagamento.includes('(Entrada)') && !row.forma_pagamento.includes('(Parcelas)')) {
            // Simple row (no entrada)
            mergedMap[baseGw].valor = row.valor_bruto;
            mergedMap[baseGw].taxa_gateway = row.taxa_gateway;
          }
        }
        const reconstructed = Object.values(mergedMap).map((m: any) => ({
          ...m,
          valor: m.valor.toString(),
          taxa_gateway: m.taxa_gateway.toFixed(2)
        }));
        setPagamentos(reconstructed);
        setSaleObservacoes(lead.observacoes_gerais || "");
      }

      setSaleLead(lead);
      setIsSaleModalOpen(true);
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
          <h2 className="text-3xl font-black text-white tracking-tight">Quadro de Leads</h2>
          <p className="text-[#888888] mt-1 text-sm">Arraste os cards para atualizar o status no pipeline.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" size={18} />
            <input
              type="text"
              placeholder="Buscar lead..."
              className="pl-10 pr-4 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-white focus:outline-none w-full"
            />
          </div>
          <button
            onClick={handleExportCSV}
            title="Exportar leads para planilha CSV"
            className="flex-1 md:flex-none justify-center flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-colors"
            style={{ background: '#BEFF00', color: '#0A0A0A', border: '1px solid transparent' }}
          >
            <Download size={16} />
            <span>Exportar</span>
          </button>
          <button
            className="btn-primary flex-1 md:flex-none justify-center flex items-center gap-2 whitespace-nowrap"
            onClick={handleOpenCreate}
          >
            <Plus size={18} />
            <span>Novo</span>
          </button>
        </div>
      </div>

      {/* Kanban Board Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-4 pb-4 px-1 md:px-0">
        {KANBAN_COLUMNS.map((col) => {
          const columnLeads = leads.filter((l) => l.status_atual === col || (col === 'Loss' && l.status_atual === 'Nao prosseguiu'));

          return (
            <div
              key={col}
              className="kanban-col min-w-[320px] w-[320px] flex flex-col h-full"
              onDrop={(e) => handleDrop(e, col)}
              onDragOver={handleDragOver}
            >
              <div className="p-4 border-b border-[#222222] flex justify-between items-center bg-[#1A1A1A]/80 rounded-t-xl">
                <h3 className="font-bold text-white tracking-tight">{col}</h3>
                <span className="text-xs px-2.5 py-1 rounded-full font-black" style={{ background: '#BEFF00', color: '#0A0A0A' }}>
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
                    className="glass-panel p-4 cursor-grab active:cursor-grabbing hover:-translate-y-1 border-[#2A2A2A] hover:border-orange-300 transition-all select-none group relative bg-[#1A1A1A]"
                  >
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(lead); }} className="text-[#888888] hover:text-white px-2 py-1 text-xs bg-[#1A1A1A] rounded shadow-sm border border-[#2A2A2A]">Editar</button>
                    </div>
                    <div className="flex justify-between items-start mb-2 pr-12">
                      <h4 className="font-bold text-white leading-tight">{lead.nome}</h4>
                      {lead.valor_proposta && (
                        <span className="text-emerald-700 font-bold text-sm bg-emerald-100 px-2 rounded-md border border-emerald-200">
                          R$ {lead.valor_proposta}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 mt-3">
                      {lead.telefone && (
                        <div className="flex items-center gap-2 text-xs text-[#666666]">
                          <Phone size={14} className="text-[#888888]" />
                          <span>{lead.telefone}</span>
                        </div>
                      )}
                      {lead.instagram && (
                        <div className="flex items-center gap-2 text-xs text-[#666666]">
                          <Instagram size={14} className="text-[#888888]" />
                          <span>{lead.instagram}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#222222] flex justify-between items-center">
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

                      <div className="flex items-center gap-1 text-[10px] text-[#666666] font-medium">
                        <Clock size={12} />
                        <span>{formatDateBr(lead.data_entrada)}</span>
                      </div>
                      {lead.status_atual === 'Venda' && (
                        <button
                          onClick={(e) => handleOpenEditSale(e, lead)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-orange-400 hover:text-white border border-orange-400/40 px-2 py-0.5 rounded bg-[#1A1A1A]"
                        >Editar Venda</button>
                      )}
                    </div>
                  </div>
                ))}

                {columnLeads.length === 0 && (
                  <div className="h-24 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-[#666666] text-sm font-medium">
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
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 md:p-4 text-left">
          <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4 md:p-6 relative bg-[#1A1A1A] rounded-t-2xl md:rounded-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">{editingLeadId ? "Editar Lead" : "Adicionar Novo Lead"}</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#666666] hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Nome *</label>
                  <input
                    required
                    type="text"
                    className="w-full"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-1">E-mail</label>
                  <input
                    type="email"
                    className="w-full"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Data de Entrada</label>
                  <input
                    type="datetime-local"
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A]"
                    value={formData.data_entrada}
                    onChange={(e) => setFormData({ ...formData, data_entrada: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Telefone</label>
                  <input
                    type="text"
                    className="w-full"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Instagram</label>
                  <input
                    type="text"
                    className="w-full"
                    placeholder="@"
                    value={formData.instagram}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Origem</label>
                  <select
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A]"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-[#222222]">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">SDR Responsável</label>
                  <select
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A]"
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
                  <label className="block text-sm font-medium text-white mb-1">Closer Responsável</label>
                  <select
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A]"
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
                <label className="block text-sm font-medium text-white mb-1">Observações Gerais</label>
                <textarea
                  className="w-full min-h-[100px]"
                  value={formData.observacoes_gerais}
                  onChange={(e) => setFormData({ ...formData, observacoes_gerais: e.target.value })}
                ></textarea>
              </div>

              <div className="flex justify-between items-center mt-8 pt-4 border-t border-[#222222] flex-col-reverse md:flex-row gap-4">
                {editingLeadId ? (
                  <button type="button" onClick={handleDeleteLead} className="w-full md:w-auto px-4 py-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center gap-2">
                    Excluir Lead
                  </button>
                ) : <div className="hidden md:block"></div>}

                <div className="flex gap-3 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 md:flex-none px-4 py-2 text-[#888888] hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 md:flex-none btn-primary justify-center">
                    {editingLeadId ? "Salvar" : "Criar Lead"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Fechamento de Venda */}
      {isSaleModalOpen && saleLead && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-md p-0 md:p-4 text-left">
          <div className="glass-panel w-full max-w-lg p-4 md:p-6 relative border border-orange-400/30 shadow-[0_0_60px_rgba(249,115,22,0.12)] bg-[#141414] rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-5">
              <div>
                <h3 className="text-xl font-bold text-white">Registrar Venda para {saleLead.nome}</h3>
                <p className="text-sm text-[#888888] mt-1">Adicione uma ou mais formas de pagamento para compor o valor total da venda.</p>
              </div>
              <button onClick={() => setIsSaleModalOpen(false)} className="text-[#666666] hover:text-white text-xl ml-4 mt-1">✕</button>
            </div>

            <form onSubmit={handleSaveSale} className="space-y-4">
              {/* Payment Rows */}
              <div className="space-y-3">
                {pagamentos.map((p, idx) => (
                  <div key={p.id} className="p-3 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-[#888888]">Pagamento {idx + 1}</span>
                      {pagamentos.length > 1 && (
                        <button type="button" onClick={() => removePagamento(p.id)} className="text-red-500 hover:text-red-400 text-lg leading-none">🗑</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#888888] mb-1">Forma de Pagamento</label>
                        <select
                          required
                          className="w-full bg-[#111] border border-[#2A2A2A] text-white rounded-lg p-2 text-sm focus:border-orange-500 focus:outline-none"
                          value={p.forma_pagamento}
                          onChange={e => handlePagamentoChange(p.id, 'forma_pagamento', e.target.value)}
                        >
                          {gateways.length === 0
                            ? <option value="PIX">PIX</option>
                            : gateways.map(gw => <option key={gw.id_gateway} value={gw.nome}>{gw.nome}</option>)
                          }
                        </select>
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs text-[#888888] mb-1">Valor Total do Pagamento</label>
                        <div className="flex items-center gap-1 bg-[#111] border border-[#2A2A2A] rounded-lg px-2 overflow-hidden">
                          <span className="text-[#888888] text-sm shrink-0">R$</span>
                          <input
                            required
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0"
                            className="min-w-0 w-full bg-transparent border-none text-white text-sm py-2 focus:outline-none"
                            value={p.valor}
                            onChange={e => handlePagamentoChange(p.id, 'valor', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#888888] mb-1">Parcelas</label>
                        <select
                          className="w-full bg-[#111] border border-[#2A2A2A] text-white rounded-lg p-2 text-sm focus:border-orange-500 focus:outline-none"
                          value={p.numero_parcelas}
                          onChange={e => handlePagamentoChange(p.id, 'numero_parcelas', e.target.value)}
                        >
                          {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1}x</option>)}
                        </select>
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs text-[#888888] mb-1">Taxa Gateway (R$)</label>
                        <div className="flex items-center gap-1 bg-[#111] border border-[#2A2A2A] rounded-lg px-2 overflow-hidden">
                          <span className="text-[#888888] text-sm shrink-0">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="min-w-0 w-full bg-transparent border-none text-[#888888] text-sm py-2 focus:outline-none"
                            value={p.taxa_gateway}
                            onChange={e => handlePagamentoChange(p.id, 'taxa_gateway', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    {/* Entrada field — shown only when gateway accepts down payment */}
                    {gateways.find(gw => gw.nome === p.forma_pagamento)?.tem_entrada && (
                      <div className="pt-3 border-t border-[#2A2A2A]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">Entrada</span>
                          <span className="text-xs text-[#888888]">Valor pago na entrada (à vista)</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 bg-[#111] border border-blue-400/30 rounded-lg px-2 overflow-hidden">
                            <span className="text-blue-400 text-sm shrink-0">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0"
                              className="min-w-0 w-full bg-transparent border-none text-blue-300 text-sm py-2 focus:outline-none"
                              value={p.valor_entrada}
                              onChange={e => handlePagamentoChange(p.id, 'valor_entrada', e.target.value)}
                            />
                          </div>
                          {p.valor_entrada && parseFloat(p.valor) > 0 && (
                            <p className="text-xs text-[#888888] mt-1">
                              Restante a parcelar: <span className="text-white font-medium">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, parseFloat(p.valor) - parseFloat(p.valor_entrada)))}
                              </span> em {p.numero_parcelas}x
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                ))}
              </div>

              {/* Add Payment Button */}
              <button
                type="button"
                onClick={addPagamento}
                className="w-full py-2.5 rounded-xl border border-dashed border-[#3A3A3A] text-[#888888] hover:text-white hover:border-orange-400 transition text-sm flex items-center justify-center gap-2"
              >
                <span className="text-lg">⊕</span> Adicionar Pagamento
              </button>

              {/* Observacoes */}
              <div>
                <label className="block text-sm font-medium text-[#888888] mb-1">Observações sobre a Venda</label>
                <textarea
                  rows={3}
                  placeholder="Ex: Cliente pediu desconto, condição especial de pagamento..."
                  className="w-full bg-[#111] border border-[#2A2A2A] text-white rounded-xl p-3 text-sm focus:border-orange-400 focus:outline-none resize-none"
                  value={saleObservacoes}
                  onChange={e => setSaleObservacoes(e.target.value)}
                />
              </div>

              {/* Totals */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
                  <div className="flex items-center gap-2 text-xs text-[#888888] mb-1">
                    <span>💳</span> Valor Total da Venda
                  </div>
                  <div className="text-base font-black text-white">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saleTotals.bruto)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
                  <div className="flex items-center gap-2 text-xs text-[#888888] mb-1">
                    <span>💵</span> Caixa Gerado (Líquido)
                  </div>
                  <div className="text-base font-black text-orange-400">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saleTotals.liquido)}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-[#222222]">
                <button type="button" onClick={() => setIsSaleModalOpen(false)} className="px-4 py-2 text-[#888888] hover:text-white transition-colors text-sm">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary px-6 py-2 justify-center">
                  Salvar Venda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
