"use client";

import { useState, useEffect } from "react";
import { BellRing, Phone, Instagram, Loader2, X, MessageSquare } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { todayBrasilia, addDaysToDate, toBrasiliaDate } from "@/lib/brasilia";
import { followSituacao, diasDeAtraso, FOLLOW_DEFAULT_DAYS, FOLLOWUPS_CHANGED_EVENT, FollowSituacao } from "@/lib/followUp";

type FollowLead = {
  id_lead: number;
  nome: string;
  telefone: string | null;
  instagram: string | null;
  status_atual: string;
  data_proximo_follow: string | null;
  off_metricas: boolean;
  id_sdr_responsavel: number | null;
  id_closer_responsavel: number | null;
  sdr_nome: string | null;
  closer_nome: string | null;
  total_follows: number;
  ultimo_follow: { data_feito: string; observacao: string | null; usuario_nome: string | null } | null;
};

const RED = '#ef4444';

const SITUACAO_LABEL: Record<FollowSituacao, string> = {
  atrasado: 'Atrasados',
  hoje: 'Para hoje',
  agendado: 'Agendados',
  sem_data: 'Sem data',
};

// "2026-10-28" → "28/10"
const formatDia = (dateStr: string) => {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
};

export default function FollowUpPage() {
  const { selectedProject } = useProject();
  const [leads, setLeads] = useState<FollowLead[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterVendedor, setFilterVendedor] = useState("");

  // Modal "Registrar follow"
  const [followLead, setFollowLead] = useState<FollowLead | null>(null);
  const [observacao, setObservacao] = useState("");
  const [dataProximo, setDataProximo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchLeads = async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/follow-ups?projectId=${selectedProject.id_projeto}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar follow-ups');
      setLeads(data.leads || []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/users?projectId=${selectedProject.id_projeto}`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!selectedProject) {
      setLoading(false);
      return;
    }
    fetchLeads();
    fetchUsers();
  }, [selectedProject]);

  const openFollowModal = (lead: FollowLead) => {
    setFollowLead(lead);
    setObservacao("");
    setDataProximo(addDaysToDate(todayBrasilia(), FOLLOW_DEFAULT_DAYS));
    setSaveError(null);
  };

  const handleSaveFollow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followLead) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_lead: followLead.id_lead, data_proximo: dataProximo || null, observacao }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao registrar follow');
      setFollowLead(null);
      window.dispatchEvent(new Event(FOLLOWUPS_CHANGED_EVENT));
      await fetchLeads();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const hoje = todayBrasilia();
  const vendedores = users
    .filter((u: any) => u.ativo !== false)
    .sort((a: any, b: any) => a.nome.localeCompare(b.nome));

  const visibleLeads = leads.filter(l =>
    !filterVendedor ||
    String(l.id_sdr_responsavel) === filterVendedor ||
    String(l.id_closer_responsavel) === filterVendedor
  );

  const contagem: Record<FollowSituacao, number> = { atrasado: 0, hoje: 0, agendado: 0, sem_data: 0 };
  for (const l of visibleLeads) {
    const s = followSituacao(l.data_proximo_follow, l.status_atual, hoje);
    if (s) contagem[s] += 1;
  }

  const renderProximo = (lead: FollowLead) => {
    const situacao = followSituacao(lead.data_proximo_follow, lead.status_atual, hoje);
    if (!lead.data_proximo_follow || situacao === 'sem_data') {
      return <span className="text-xs font-semibold" style={{ color: 'var(--text-sec)' }}>Sem próximo follow</span>;
    }
    const dia = formatDia(toBrasiliaDate(lead.data_proximo_follow));
    if (situacao === 'atrasado') {
      const dias = diasDeAtraso(lead.data_proximo_follow, hoje);
      return (
        <span className="text-xs font-black px-2 py-1 rounded-md whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.12)', color: RED, border: '1px solid rgba(239,68,68,0.4)' }}>
          Atrasado há {dias} dia{dias > 1 ? 's' : ''} · {dia}
        </span>
      );
    }
    if (situacao === 'hoje') {
      return (
        <span className="text-xs font-black px-2 py-1 rounded-md whitespace-nowrap" style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)' }}>
          Hoje · {dia}
        </span>
      );
    }
    return <span className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--text-pri)' }}>Próximo: {dia}</span>;
  };

  return (
    <div className="pt-4 flex flex-col">
      {/* Header */}
      <div className="mb-6 flex flex-col lg:flex-row justify-between lg:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-pri)' }}>Follow-up</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-sec)' }}>
            Leads em follow-up, com os atrasados primeiro. Registre cada contato e marque o próximo.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <select
            className="appearance-none bg-surface border border-str text-sec text-sm rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-orange-400 w-full"
            value={filterVendedor}
            onChange={e => setFilterVendedor(e.target.value)}
          >
            <option value="">Todos os vendedores</option>
            {vendedores.map((u: any) => (
              <option key={u.id_usuario} value={u.id_usuario}>{u.nome}{u.tipo ? ` (${u.tipo})` : ''}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] opacity-50" style={{ color: 'var(--text-sec)' }}>▼</span>
        </div>
      </div>

      {/* Resumo */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(Object.keys(SITUACAO_LABEL) as FollowSituacao[]).map(s => (
          <div
            key={s}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold"
            style={s === 'atrasado' && contagem.atrasado > 0
              ? { background: 'rgba(239,68,68,0.12)', color: RED, border: '1px solid rgba(239,68,68,0.4)' }
              : { background: 'var(--bg-surface)', color: 'var(--text-sec)', border: '1px solid var(--border-str)' }}
          >
            <span>{SITUACAO_LABEL[s]}</span>
            <span className="font-black" style={{ color: s === 'atrasado' && contagem.atrasado > 0 ? RED : 'var(--text-pri)' }}>{contagem[s]}</span>
          </div>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-sec)' }}>
          <Loader2 size={16} className="animate-spin" /> Carregando follow-ups...
        </div>
      ) : error ? (
        <div className="glass-panel p-5 text-sm" style={{ color: RED }}>{error}</div>
      ) : visibleLeads.length === 0 ? (
        <div className="h-32 border-2 border-dashed border-str rounded-xl flex items-center justify-center text-sm font-medium text-sec">
          Nenhum lead em follow-up{filterVendedor ? ' para este vendedor' : ''}.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleLeads.map(lead => {
            const situacao = followSituacao(lead.data_proximo_follow, lead.status_atual, hoje);
            const atrasado = situacao === 'atrasado';
            return (
              <div
                key={lead.id_lead}
                className={`glass-panel p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-5 ${atrasado ? '' : 'border-str'}`}
                style={atrasado ? { borderColor: 'rgba(239,68,68,0.6)', boxShadow: `inset 3px 0 0 ${RED}` } : undefined}
              >
                {/* Lead */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-white leading-tight truncate">{lead.nome}</h4>
                    {lead.status_atual !== 'Follow-up' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-sec)', border: '1px solid var(--border-str)' }}>
                        {lead.status_atual}
                      </span>
                    )}
                    {lead.off_metricas && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-wide" style={{ background: '#1c1c1c', color: '#888', border: '1px solid #333' }} title="Fora das métricas comerciais">
                        ⊘ OFF
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-sec">
                    {lead.telefone && <span className="flex items-center gap-1.5"><Phone size={12} />{lead.telefone}</span>}
                    {lead.instagram && <span className="flex items-center gap-1.5"><Instagram size={12} />{lead.instagram}</span>}
                    {lead.sdr_nome && <span>SDR: <span className="text-white font-semibold">{lead.sdr_nome}</span></span>}
                    {lead.closer_nome && <span>Closer: <span className="text-white font-semibold">{lead.closer_nome}</span></span>}
                  </div>
                </div>

                {/* Último follow */}
                <div className="md:w-64 min-w-0 text-xs text-sec">
                  {lead.ultimo_follow ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <MessageSquare size={12} />
                        <span>
                          Último: {formatDia(toBrasiliaDate(lead.ultimo_follow.data_feito))}
                          {lead.ultimo_follow.usuario_nome ? ` por ${lead.ultimo_follow.usuario_nome}` : ''}
                          {lead.total_follows > 1 ? ` · ${lead.total_follows} follows` : ''}
                        </span>
                      </div>
                      {lead.ultimo_follow.observacao && (
                        <p className="mt-1 truncate" title={lead.ultimo_follow.observacao}>“{lead.ultimo_follow.observacao}”</p>
                      )}
                    </>
                  ) : (
                    <span>Nenhum follow registrado</span>
                  )}
                </div>

                {/* Próximo + ação */}
                <div className="flex items-center justify-between md:justify-end gap-3 md:w-72">
                  {renderProximo(lead)}
                  <button
                    onClick={() => openFollowModal(lead)}
                    className="text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap transition-all"
                    style={atrasado
                      ? { background: RED, color: '#fff' }
                      : { background: 'var(--accent)', color: 'var(--accent-text)' }}
                  >
                    Registrar follow
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Registrar follow ───────────────────────────────── */}
      {followLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !isSaving && setFollowLead(null)}>
          <div className="modal-surface glass-panel w-full max-w-md p-6 border border-str rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: 'rgba(var(--accent-rgb),0.12)' }}>
                  <BellRing size={18} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Registrar follow</h3>
                  <p className="text-sm text-sec mt-0.5">{followLead.nome}</p>
                </div>
              </div>
              <button onClick={() => setFollowLead(null)} className="text-sec hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveFollow} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-sec mb-1">Como foi o contato? (opcional)</label>
                <textarea
                  rows={3}
                  autoFocus
                  placeholder="Ex: Mandei mensagem no WhatsApp, pediu para falar na sexta."
                  className="w-full bg-app border border-str text-white rounded-xl p-3 text-sm focus:border-orange-400 focus:outline-none resize-none"
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sec mb-1">Próximo follow</label>
                <input
                  type="date"
                  min={hoje}
                  className="w-full bg-app border border-str text-white rounded-lg p-2 text-sm focus:border-orange-500 focus:outline-none"
                  value={dataProximo}
                  onChange={e => setDataProximo(e.target.value)}
                />
                <p className="text-[11px] text-sec mt-1">Se ficar em branco, o próximo follow fica para daqui a {FOLLOW_DEFAULT_DAYS} dias.</p>
              </div>
              {saveError && <p className="text-sm" style={{ color: RED }}>{saveError}</p>}
              <div className="flex justify-end gap-3 pt-2 border-t border-[#222]">
                <button type="button" onClick={() => setFollowLead(null)} className="px-4 py-2 text-sec hover:text-white text-sm">Cancelar</button>
                <button type="submit" disabled={isSaving} className="btn-primary px-6 py-2 text-sm flex items-center gap-2 disabled:opacity-60">
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
