"use client";

import { useState, useEffect } from "react";
import { BellRing, Phone, Instagram, Loader2, X, MessageSquare, AlertTriangle } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { todayBrasilia, addDaysToDate, toBrasiliaDate } from "@/lib/brasilia";
import { followSituacao, followAtencao, FOLLOW_DEFAULT_DAYS, FOLLOWUPS_CHANGED_EVENT, ESQUECIDO_DIAS, FollowSituacao, FollowAtencao } from "@/lib/followUp";

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
  ultimo_contato: string | null;
  ultimo_follow: { data_feito: string; observacao: string | null; usuario_nome: string | null } | null;
};

const RED = '#ef4444';

const plural = (n: number, palavra: string) => `${n} ${palavra}${n === 1 ? '' : 's'}`;

// Quadrados do resumo, na ordem em que aparecem; cada um filtra a lista ao ser clicado
type FiltroResumo = 'critico' | FollowSituacao | 'esquecido';

const RESUMO_LABEL: Record<FiltroResumo, string> = {
  critico: 'Críticos',
  atrasado: 'Atrasados',
  hoje: 'Para hoje',
  agendado: 'Agendados',
  sem_data: 'Sem data',
  esquecido: 'Esquecidos',
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
  const [filtroResumo, setFiltroResumo] = useState<FiltroResumo | null>(null);

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

  const comAtencao = visibleLeads.map(lead => ({
    lead,
    situacao: followSituacao(lead.data_proximo_follow, lead.status_atual, hoje),
    atencao: followAtencao(lead.data_proximo_follow, lead.status_atual, lead.ultimo_contato, hoje),
  }));
  const noFiltro = (x: (typeof comAtencao)[number], filtro: FiltroResumo) =>
    filtro === 'critico' || filtro === 'esquecido' ? x.atencao?.prioridade === filtro : x.situacao === filtro;

  // Contagem antes do filtro do resumo, para os quadrados sempre mostrarem o total do vendedor
  const contagem = Object.fromEntries(
    (Object.keys(RESUMO_LABEL) as FiltroResumo[]).map(f => [f, comAtencao.filter(x => noFiltro(x, f)).length])
  ) as Record<FiltroResumo, number>;

  // Críticos no topo e esquecidos no fim, cada grupo com quem espera há mais tempo primeiro
  const filtrados = filtroResumo ? comAtencao.filter(x => noFiltro(x, filtroResumo)) : comAtencao;
  const porDiasDesc = (a: { atencao: FollowAtencao | null }, b: { atencao: FollowAtencao | null }) =>
    (b.atencao?.dias ?? 0) - (a.atencao?.dias ?? 0);
  const criticos = filtrados.filter(x => x.atencao?.prioridade === 'critico').sort(porDiasDesc);
  const esquecidos = filtrados.filter(x => x.atencao?.prioridade === 'esquecido').sort(porDiasDesc);
  const demais = filtrados.filter(x => !x.atencao?.prioridade);

  const estiloResumo = (f: FiltroResumo): React.CSSProperties => {
    const neutro = { background: 'var(--bg-surface)', color: 'var(--text-sec)', border: '1px solid var(--border-str)' };
    if (f === 'critico' && contagem.critico > 0) return { background: RED, color: '#fff', border: `1px solid ${RED}` };
    if (f === 'atrasado' && contagem.atrasado > 0) return { background: 'rgba(239,68,68,0.12)', color: RED, border: '1px solid rgba(239,68,68,0.4)' };
    if (f === 'esquecido') return { ...neutro, color: 'var(--text-muted)', border: '1px dashed var(--border-str)' };
    return neutro;
  };

  const renderProximo = (lead: FollowLead, atencao: FollowAtencao | null) => {
    const situacao = followSituacao(lead.data_proximo_follow, lead.status_atual, hoje);
    const dia = lead.data_proximo_follow ? formatDia(toBrasiliaDate(lead.data_proximo_follow)) : '';
    if (atencao?.prioridade) {
      const texto = atencao.motivo === 'atraso'
        ? `Atrasado há ${plural(atencao.dias, 'dia')} · ${dia}`
        : `Sem contato há ${plural(atencao.dias, 'dia')}`;
      const estilo = atencao.prioridade === 'critico'
        ? { background: 'rgba(239,68,68,0.12)', color: RED, border: '1px solid rgba(239,68,68,0.4)' }
        : { background: 'var(--bg-surface-2)', color: 'var(--text-sec)', border: '1px solid var(--border-str)' };
      return <span className="text-xs font-black px-2 py-1 rounded-md whitespace-nowrap" style={estilo}>{texto}</span>;
    }
    if (!lead.data_proximo_follow || situacao === 'sem_data') {
      return <span className="text-xs font-semibold" style={{ color: 'var(--text-sec)' }}>Sem próximo follow</span>;
    }
    if (situacao === 'atrasado' && atencao) {
      return (
        <span className="text-xs font-black px-2 py-1 rounded-md whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.12)', color: RED, border: '1px solid rgba(239,68,68,0.4)' }}>
          Atrasado há {plural(atencao.dias, 'dia')} · {dia}
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

  const renderLead = ({ lead, atencao }: { lead: FollowLead; atencao: FollowAtencao | null }) => {
    const situacao = followSituacao(lead.data_proximo_follow, lead.status_atual, hoje);
    const critico = atencao?.prioridade === 'critico';
    const esquecido = atencao?.prioridade === 'esquecido';
    const atrasado = situacao === 'atrasado' && !esquecido;
    // Inline porque .border-str do CSS global vence as classes do Tailwind
    const cardStyle: React.CSSProperties | undefined = critico
      ? {
          borderColor: RED,
          background: 'linear-gradient(rgba(239,68,68,0.07), rgba(239,68,68,0.07)), var(--bg-surface)',
          boxShadow: `inset 4px 0 0 ${RED}, 0 0 0 1px rgba(239,68,68,0.25)`,
        }
      : atrasado
        ? { borderColor: 'rgba(239,68,68,0.6)', boxShadow: `inset 3px 0 0 ${RED}` }
        : esquecido
          ? { opacity: 0.75 }
          : undefined;
    return (
      <div
        key={lead.id_lead}
        className={`glass-panel p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-5 ${critico || atrasado ? '' : 'border-str'}`}
        style={cardStyle}
      >
        {/* Lead */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {critico && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md tracking-wide" style={{ background: RED, color: '#fff' }}>
                <AlertTriangle size={11} />
                CRÍTICO
              </span>
            )}
            {esquecido && (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md tracking-wide" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-sec)', border: '1px dashed var(--border-str)' }}>
                ESQUECIDO
              </span>
            )}
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
          {renderProximo(lead, atencao)}
          <button
            onClick={() => openFollowModal(lead)}
            className="text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap transition-all"
            style={critico || atrasado
              ? { background: RED, color: '#fff' }
              : esquecido
                ? { background: 'var(--bg-surface-2)', color: 'var(--text-pri)', border: '1px solid var(--border-str)' }
                : { background: 'var(--accent)', color: 'var(--accent-text)' }}
          >
            Registrar follow
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="pt-4 flex flex-col">
      {/* Header */}
      <div className="mb-6 flex flex-col lg:flex-row justify-between lg:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-pri)' }}>Follow-up</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-sec)' }}>
            Leads em follow-up, com os críticos primeiro. Registre cada contato e marque o próximo.
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
        {(Object.keys(RESUMO_LABEL) as FiltroResumo[]).map(f => {
          const ativo = filtroResumo === f;
          const estilo = estiloResumo(f);
          const corNumero = f === 'critico' || f === 'atrasado' || f === 'esquecido' ? estilo.color : 'var(--text-pri)';
          return (
            <button
              key={f}
              type="button"
              aria-pressed={ativo}
              disabled={contagem[f] === 0 && !ativo}
              onClick={() => setFiltroResumo(ativo ? null : f)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:brightness-110 disabled:cursor-default disabled:hover:brightness-100"
              style={ativo ? { ...estilo, boxShadow: '0 0 0 2px var(--text-pri)' } : estilo}
              title={ativo ? 'Mostrar todos' : f === 'esquecido' ? `Mais de ${ESQUECIDO_DIAS} dias sem atenção` : `Mostrar só ${RESUMO_LABEL[f].toLowerCase()}`}
            >
              {f === 'critico' && <AlertTriangle size={13} />}
              <span>{RESUMO_LABEL[f]}</span>
              <span className="font-black" style={{ color: corNumero }}>{contagem[f]}</span>
              {ativo && <X size={12} />}
            </button>
          );
        })}
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
      ) : filtrados.length === 0 && filtroResumo ? (
        <div className="h-32 border-2 border-dashed border-str rounded-xl flex flex-col items-center justify-center gap-2 text-sm font-medium text-sec">
          <span>Nenhum lead em &quot;{RESUMO_LABEL[filtroResumo]}&quot;{filterVendedor ? ' para este vendedor' : ''}.</span>
          <button onClick={() => setFiltroResumo(null)} className="text-xs font-bold underline" style={{ color: 'var(--accent)' }}>Mostrar todos</button>
        </div>
      ) : (
        <div className="space-y-7">
          {criticos.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} style={{ color: RED }} />
                <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: RED }}>Críticos · precisam de atenção agora</h3>
              </div>
              <div className="space-y-3">{criticos.map(renderLead)}</div>
            </section>
          )}
          {demais.length > 0 && (
            <section>
              {(criticos.length > 0 || esquecidos.length > 0) && (
                <h3 className="text-sm font-black uppercase tracking-wide mb-3" style={{ color: 'var(--text-sec)' }}>Demais follow-ups</h3>
              )}
              <div className="space-y-3">{demais.map(renderLead)}</div>
            </section>
          )}
          {esquecidos.length > 0 && (
            <section>
              <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: 'var(--text-sec)' }}>Esquecidos</h3>
              <p className="text-xs mb-3 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Mais de {ESQUECIDO_DIAS} dias sem atenção. Retome o contato ou mova para Loss no painel de leads.
              </p>
              <div className="space-y-3">{esquecidos.map(renderLead)}</div>
            </section>
          )}
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
