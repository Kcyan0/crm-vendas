"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { ChevronLeft, ChevronRight, Plus, Loader2, Calendar as CalendarIcon, Link2, Check, RefreshCw, X, Clock, User } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { createClient } from "@/lib/supabase/browser";
import { useSearchParams } from "next/navigation";

type Chamada = {
  id_chamada: number;
  titulo: string;
  data_hora_inicio: string;
  duracao_minutos: number;
  status_chamada: string;
  observacoes: string;
  id_lead: number | null;
  id_sdr: number | null;
  id_closer: number | null;
  id_projeto: number;
  google_event_id: string | null;
  lead?: { nome: string };
  sdr?: { nome: string };
  closer?: { nome: string };
};

type TeamMember = {
  id_usuario: number;
  nome: string;
  tipo: string;
};

type Lead = { id_lead: number; nome: string };

type PendingVenda = {
  id_venda: number;
  id_lead: number;
  forma_pagamento: string;
  valor_bruto: number;
  data_recebimento: string;
  lead?: { nome: string };
};

const STATUS_COLORS: Record<string, string> = {
  agendada: "bg-blue-500",
  realizada: "bg-accent",
  "no-show": "bg-red-500",
  reagendada: "bg-orange-400",
};

const STATUS_LABELS: Record<string, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  "no-show": "No-Show",
  reagendada: "Reagendada",
};

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const WEEKDAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function CalendarContent() {
  const { selectedProject } = useProject();
  const searchParams = useSearchParams();

  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [chamadas, setChamadas] = useState<Chamada[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [filterMemberId, setFilterMemberId] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingVendas, setPendingVendas] = useState<PendingVenda[]>([]);
  // Day overflow popup
  const [dayPopup, setDayPopup] = useState<Date | null>(null);
  const [formData, setFormData] = useState({
    titulo: "",
    data: "",
    hora: "09:00",
    duracao_minutos: "60",
    status_chamada: "agendada",
    id_lead: "",
    id_sdr: "",
    id_closer: "",
    observacoes: "",
  });

  const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

  // Verificar status Google Calendar
  const checkGoogleStatus = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;
    const res = await fetch(`/api/google/status?email=${encodeURIComponent(user.email)}`);
    const data = await res.json();
    setIsGoogleConnected(data.connected);
  }, []);

  const fetchChamadas = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chamadas?projectId=${selectedProject.id_projeto}&month=${month}`);
      const data = await res.json();
      setChamadas(Array.isArray(data) ? data : []);
    } catch (e) {
      setChamadas([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, month]);

  const fetchPendingVendas = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/vendas?pendentes=true&month=${month}&projectId=${selectedProject.id_projeto}`);
      const data = await res.json();
      setPendingVendas(Array.isArray(data) ? data : []);
    } catch { setPendingVendas([]); }
  }, [selectedProject, month]);

  const fetchTeamAndLeads = useCallback(async () => {
    if (!selectedProject) return;
    const [teamRes, leadsRes] = await Promise.all([
      fetch(`/api/users?projectId=${selectedProject.id_projeto}`),
      fetch(`/api/leads?projectId=${selectedProject.id_projeto}`),
    ]);
    setTeam(await teamRes.json());
    const leadsData = await leadsRes.json();
    setLeads(Array.isArray(leadsData) ? leadsData : leadsData?.leads || []);
  }, [selectedProject]);

  useEffect(() => {
    fetchChamadas();
    fetchPendingVendas();
  }, [fetchChamadas, fetchPendingVendas]);

  useEffect(() => {
    fetchTeamAndLeads();
    checkGoogleStatus();
  }, [fetchTeamAndLeads, checkGoogleStatus]);

  // Notificação de retorno do OAuth
  useEffect(() => {
    const googleParam = searchParams.get("google");
    if (googleParam === "connected") {
      setIsGoogleConnected(true);
      window.history.replaceState({}, "", "/calendar");
    }
  }, [searchParams]);

  // Abrir modal pré-preenchido quando vindo do Kanban via ?leadId=X
  useEffect(() => {
    const leadId = searchParams.get("leadId");
    if (!leadId || leads.length === 0) return;
    const t = new Date();
    const d = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    setEditingId(null);
    setFormData(prev => ({ ...prev, titulo: '', data: d, hora: '09:00', duracao_minutos: '60', status_chamada: 'agendada', id_lead: leadId, id_sdr: '', id_closer: '', observacoes: '' }));
    setIsModalOpen(true);
    // Limpa o param da URL sem recarregar
    window.history.replaceState({}, '', '/calendar');
  }, [leads, searchParams]);

  // Gerar grade mensal
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));

    while (days.length % 7 !== 0) days.push(null);
    return days;
  };

  const displayedChamadas = chamadas.filter(c => {
    if (filterMemberId === "all") return true;
    const fId = parseInt(filterMemberId);
    return c.id_closer === fId || c.id_sdr === fId;
  });

  const getChamadasForDay = (day: Date) => {
    return displayedChamadas.filter((c) => {
      if (!c.data_hora_inicio) return false;
      const d = new Date(c.data_hora_inicio);
      return d.getDate() === day.getDate() && d.getMonth() === day.getMonth() && d.getFullYear() === day.getFullYear();
    });
  };
  const getPendingForDay = (day: Date) =>
    pendingVendas.filter(v => {
      if (!v.data_recebimento) return false;
      const d = new Date(v.data_recebimento + 'T12:00:00');
      return d.getDate() === day.getDate() && d.getMonth() === day.getMonth() && d.getFullYear() === day.getFullYear();
    });

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setEditingId(null);
    const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    setFormData({ titulo: "", data: dateStr, hora: "09:00", duracao_minutos: "60", status_chamada: "agendada", id_lead: "", id_sdr: "", id_closer: "", observacoes: "" });
    setIsModalOpen(true);
  };

  const handleEditChamada = (c: Chamada) => {
    setEditingId(c.id_chamada);
    const dt = new Date(c.data_hora_inicio);
    const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const hora = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
    setFormData({
      titulo: c.titulo || "",
      data: dateStr,
      hora,
      duracao_minutos: String(c.duracao_minutos || 60),
      status_chamada: c.status_chamada || "agendada",
      id_lead: String(c.id_lead || ""),
      id_sdr: String(c.id_sdr || ""),
      id_closer: String(c.id_closer || ""),
      observacoes: c.observacoes || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSaving(true);
    try {
      const data_hora_inicio = `${formData.data}T${formData.hora}:00-03:00`;
      const body = {
        id_chamada: editingId,
        titulo: formData.titulo,
        data_hora_inicio,
        duracao_minutos: parseInt(formData.duracao_minutos),
        status_chamada: formData.status_chamada,
        id_lead: formData.id_lead ? parseInt(formData.id_lead) : null,
        id_sdr: formData.id_sdr ? parseInt(formData.id_sdr) : null,
        id_closer: formData.id_closer ? parseInt(formData.id_closer) : null,
        observacoes: formData.observacoes,
        id_projeto: selectedProject.id_projeto,
      };
      await fetch("/api/chamadas", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setIsModalOpen(false);
      fetchChamadas();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId || !confirm("Remover esta chamada?")) return;
    await fetch(`/api/chamadas?id=${editingId}`, { method: "DELETE" });
    setIsModalOpen(false);
    fetchChamadas();
  };

  const handleSync = async () => {
    setGoogleLoading(true);
    await fetch("/api/google/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month }) });
    await fetchChamadas();
    setGoogleLoading(false);
  };

  const days = getDaysInMonth();
  const upcomingChamadas = displayedChamadas.filter(c => new Date(c.data_hora_inicio) >= today).slice(0, 5);

  return (
    <div className="h-full flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Calendário</h2>
          <p className="text-sec mt-1">Agende e gerencie chamadas sincronizadas com o Google Calendar.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <select 
            value={filterMemberId} 
            onChange={(e) => setFilterMemberId(e.target.value)}
            className="bg-surface border border-str text-white text-sm rounded-xl px-3 py-2 outline-none"
          >
            <option value="all">Visão Geral (Todos)</option>
            {team.map(m => (
              <option key={m.id_usuario} value={m.id_usuario}>{m.nome} ({m.tipo})</option>
            ))}
          </select>

          {isGoogleConnected ? (
            <>
              <button
                onClick={handleSync}
                disabled={googleLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-surface border border-str text-accent hover:border-accent transition-all"
              >
                {googleLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Sincronizar
              </button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-accent-12 border border-accent-30 text-accent">
                <Check size={15} />
                Google Conectado
              </div>
            </>
          ) : (
            <a
              href="/api/google/auth"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-surface border border-str text-white hover:border-accent hover:text-accent transition-all"
            >
              <Link2 size={15} />
              Conectar Google Calendar
            </a>
          )}
          <button
            onClick={() => { setEditingId(null); const t = today; const d = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; setFormData({titulo:'',data:d,hora:'09:00',duracao_minutos:'60',status_chamada:'agendada',id_lead:'',id_sdr:'',id_closer:'',observacoes:''}); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-accent text-[#0A0A0A] hover:bg-[#A8E800] transition-all"
          >
            <Plus size={15} />
            Nova Chamada
          </button>
        </div>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* Calendário principal */}
        <div className="flex-1 flex flex-col glass-panel bg-surface p-5">
          {/* Navegação de mês */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 rounded-xl hover:bg-surface-3 text-white transition">
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-xl font-bold text-white">
              {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 rounded-xl hover:bg-surface-3 text-white transition">
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Header dos dias */}
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[11px] font-bold text-muted uppercase py-1">{w}</div>
            ))}
          </div>

          {/* Grade */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 size={30} className="animate-spin text-accent" /></div>
          ) : (
            <div className="grid grid-cols-7 gap-1 flex-1">
              {days.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const dayChamadas = getChamadasForDay(day);
                const isToday = day.toDateString() === today.toDateString();
                return (
                  <div
                    key={idx}
                    onClick={() => handleDayClick(day)}
                    className={`rounded-xl p-2 cursor-pointer transition-all flex flex-col min-h-[80px] border ${isToday ? "border-accent/50 bg-accent-5" : "border-transparent hover:border-str hover:bg-surface-2"}`}
                  >
                    <span className={`text-sm font-bold mb-1 self-end ${isToday ? "text-accent" : "text-sec"}`}>{day.getDate()}</span>
                    <div className="flex flex-col gap-0.5">
                      {dayChamadas.slice(0, 2).map((c) => (
                        <div
                          key={c.id_chamada}
                          onClick={(e) => { e.stopPropagation(); handleEditChamada(c); }}
                          className={`text-[10px] font-bold text-black px-1.5 py-0.5 rounded-md truncate cursor-pointer ${STATUS_COLORS[c.status_chamada] || "bg-blue-500"}`}
                        >
                          {new Date(c.data_hora_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} {c.titulo}
                        </div>
                      ))}
                      {getPendingForDay(day).slice(0, 2).map((v) => (
                        <div
                          key={`pv-${v.id_venda}`}
                          onClick={(e) => e.stopPropagation()}
                          title={`A Receber: ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v.valor_bruto)} via ${v.forma_pagamento}${v.lead ? ` — ${v.lead.nome}` : ''}`}
                          className="text-[10px] font-bold text-[#0A0A0A] px-1.5 py-0.5 rounded-md truncate bg-amber-400 cursor-default"
                        >
                          💰 {v.lead?.nome || 'Lead'} · {new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v.valor_bruto)}
                        </div>
                      ))}
                      {(dayChamadas.length + getPendingForDay(day).length) > 4 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDayPopup(day); }}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-all hover:opacity-80"
                          style={{ background: 'var(--accent)', color: '#0A0A0A' }}
                        >
                          +{dayChamadas.length + getPendingForDay(day).length - 4} mais
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Day overflow popup ─────────────────────────────────────── */}
        {dayPopup && (() => {
          const popupDate = dayPopup;
          const popChamadas = chamadas.filter(c => {
            const d = new Date(c.data_hora_inicio);
            return d.getFullYear() === popupDate.getFullYear() &&
                   d.getMonth() === popupDate.getMonth() &&
                   d.getDate() === popupDate.getDate();
          });
          const popPendentes = getPendingForDay(popupDate);
          const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setDayPopup(null)}
            >
              <div
                className="glass-panel bg-surface rounded-2xl border border-str shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-str">
                  <h3 className="font-bold text-white text-base">
                    {popupDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </h3>
                  <button onClick={() => setDayPopup(null)} className="text-sec hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {/* Events list */}
                <div className="max-h-96 overflow-y-auto p-4 space-y-2">
                  {popChamadas.map(c => (
                    <button
                      key={c.id_chamada}
                      onClick={() => { setDayPopup(null); handleEditChamada(c); }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-black transition-opacity hover:opacity-80 ${STATUS_COLORS[c.status_chamada] || 'bg-blue-500'}`}
                    >
                      <div className="font-bold">
                        {new Date(c.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — {c.titulo}
                      </div>
                      {c.lead && <div className="opacity-70 font-medium mt-0.5">👤 {c.lead.nome}</div>}
                      {c.closer && <div className="opacity-70 font-medium">🎯 {c.closer.nome}</div>}
                    </button>
                  ))}
                  {popPendentes.map(v => (
                    <div
                      key={`pv-${v.id_venda}`}
                      className="px-3 py-2.5 rounded-xl text-xs font-bold text-[#0A0A0A] bg-amber-400"
                    >
                      <div className="font-bold">💰 A Receber — {fmt(v.valor_bruto)}</div>
                      {v.lead && <div className="opacity-70 font-medium mt-0.5">{v.lead.nome}</div>}
                      <div className="opacity-70 font-medium">{v.forma_pagamento}</div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-4 pb-4 pt-2 border-t border-str">
                  <button
                    onClick={() => { setDayPopup(null); handleDayClick(popupDate); }}
                    className="btn-primary w-full justify-center flex items-center gap-2 text-sm"
                  >
                    <Plus size={14} /> Novo Agendamento neste dia
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Sidebar de próximos eventos */}
        <div className="w-72 flex flex-col gap-4">
          <div className="glass-panel bg-surface p-4 flex-1">
            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <CalendarIcon size={16} className="text-accent" />
              Próximas Chamadas
            </h4>
            <div className="flex flex-col gap-3">
              {upcomingChamadas.length === 0 && (
                <p className="text-muted text-sm text-center mt-8">Nenhuma chamada agendada</p>
              )}
              {upcomingChamadas.map((c) => {
                const dt = new Date(c.data_hora_inicio);
                return (
                  <div
                    key={c.id_chamada}
                    onClick={() => handleEditChamada(c)}
                    className="p-3 rounded-xl bg-app border border-str cursor-pointer hover:border-[#3A3A3A] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-white text-sm font-semibold truncate">{c.titulo}</p>
                      <span className={`text-[9px] font-bold text-black px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[c.status_chamada] || "bg-blue-500"}`}>
                        {STATUS_LABELS[c.status_chamada]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 text-sec text-xs">
                      <Clock size={11} />
                      {dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} às {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    {c.lead && (
                      <div className="flex items-center gap-1 mt-1 text-muted text-xs">
                        <User size={11} />
                        {c.lead.nome}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pagamentos Pendentes */}
          {pendingVendas.length > 0 && (
            <div className="glass-panel bg-surface p-4">
              <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-amber-400">💰</span> A Receber
              </h4>
              <div className="flex flex-col gap-2">
                {pendingVendas.slice(0, 5).map(v => (
                  <div key={v.id_venda} className="p-2.5 rounded-xl bg-amber-400/5 border border-amber-400/20">
                    <p className="text-amber-300 text-xs font-semibold truncate">{v.lead?.nome || 'Lead'}</p>
                    <p className="text-white text-sm font-bold">{new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v.valor_bruto)}</p>
                    <p className="text-sec text-[10px] mt-0.5">{v.forma_pagamento} · {new Date(v.data_recebimento + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legenda */}
          <div className="glass-panel bg-surface p-4">
            <h4 className="text-xs font-bold text-sec mb-3 uppercase tracking-wider">Status</h4>
            <div className="flex flex-col gap-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[key]}`} />
                  <span className="text-xs text-sec">{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="text-xs text-sec">Pagamento Pendente</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Chamada */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel bg-surface w-full max-w-lg p-6 relative">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">{editingId ? "Editar Chamada" : "Nova Chamada"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-sec hover:text-white transition"><X size={20} /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-sec uppercase tracking-wider mb-1">Título *</label>
                <input required type="text" className="w-full" placeholder="Ex: Call com lead" value={formData.titulo} onChange={(e) => setFormData({ ...formData, titulo: e.target.value })} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-sec uppercase tracking-wider mb-1">Data *</label>
                  <input required type="date" className="w-full" value={formData.data} onChange={(e) => setFormData({ ...formData, data: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-sec uppercase tracking-wider mb-1">Horário *</label>
                  <input required type="time" className="w-full" value={formData.hora} onChange={(e) => setFormData({ ...formData, hora: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-sec uppercase tracking-wider mb-1">Duração (min)</label>
                  <input type="number" className="w-full" value={formData.duracao_minutos} onChange={(e) => setFormData({ ...formData, duracao_minutos: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-sec uppercase tracking-wider mb-1">Status</label>
                  <select className="w-full bg-surface" value={formData.status_chamada} onChange={(e) => setFormData({ ...formData, status_chamada: e.target.value })}>
                    <option value="agendada">Agendada</option>
                    <option value="realizada">Realizada</option>
                    <option value="no-show">No-Show</option>
                    <option value="reagendada">Reagendada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-sec uppercase tracking-wider mb-1">Lead (opcional)</label>
                <select className="w-full bg-surface" value={formData.id_lead} onChange={(e) => setFormData({ ...formData, id_lead: e.target.value })}>
                  <option value="">— Sem lead —</option>
                  {leads.map((l) => <option key={l.id_lead} value={l.id_lead}>{l.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-sec uppercase tracking-wider mb-1">SDR</label>
                  <select className="w-full bg-surface" value={formData.id_sdr} onChange={(e) => setFormData({ ...formData, id_sdr: e.target.value })}>
                    <option value="">— Nenhum —</option>
                    {team.map((m) => <option key={m.id_usuario} value={m.id_usuario}>{m.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-sec uppercase tracking-wider mb-1">Closer</label>
                  <select className="w-full bg-surface" value={formData.id_closer} onChange={(e) => setFormData({ ...formData, id_closer: e.target.value })}>
                    <option value="">— Nenhum —</option>
                    {team.map((m) => <option key={m.id_usuario} value={m.id_usuario}>{m.nome}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-sec uppercase tracking-wider mb-1">Observações</label>
                <textarea className="w-full h-20 resize-none" placeholder="Detalhes da chamada..." value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} />
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-str">
                {editingId ? (
                  <button type="button" onClick={handleDelete} className="text-sm text-red-400 hover:text-red-300 font-semibold transition">Excluir</button>
                ) : <div />}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sec hover:text-white transition text-sm">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-accent text-[#0A0A0A] font-bold rounded-xl hover:bg-[#A8E800] transition text-sm">
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    {editingId ? "Salvar" : "Criar Chamada"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 size={30} className="animate-spin text-accent" /></div>}>
      <CalendarContent />
    </Suspense>
  );
}
