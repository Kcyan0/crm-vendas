"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Phone, Instagram, Clock, Download, Paperclip, X, ImageIcon, BellRing, Loader2, ChevronDown, CalendarClock, SlidersHorizontal, Copy, Check } from "lucide-react";
import { useProject } from '@/context/ProjectContext';
import { exportLeadsToCSV, COLUNAS_CSV_LEADS } from '@/lib/exportUtils';
import { MOTIVOS_LOSS, MOTIVO_LOSS_OUTRO, validarMotivoLoss } from '@/lib/motivosLoss';
import { todayBrasilia, nowBrasiliaLocal, dbDateToBrasiliaLocal } from '@/lib/brasilia';
import { createClient as createBrowserClient } from '@/lib/supabase/browser';
import { followSituacao, diasDeAtraso } from '@/lib/followUp';
import { lerCacheLeads, salvarCacheLeads } from '@/lib/leadsCache';
import { useAoVivo } from '@/lib/useAoVivo';

type Lead = {
  id_lead: number;
  nome: string;
  telefone: string;
  instagram: string;
  email: string;
  origem: string;
  observacoes_gerais?: string; // não vem na lista; é buscada ao abrir o lead (carregarObservacoes)
  status_atual: string;
  sdr_nome: string;
  closer_nome: string;
  id_sdr_responsavel: number | null;
  id_closer_responsavel: number | null;
  valor_proposta: number | null;
  data_entrada: string;
  tem_pendente?: boolean;
  valor_pendente?: number;
  formas_pagamento?: string[];
  produtos_ids?: number[];
  off_metricas?: boolean;
  data_proximo_follow?: string | null;
  data_call?: string | null;
  // Remarcado sem nova data ("A definir"); data_call continua com a call anterior
  call_a_definir?: boolean;
  // Motivo do Loss (pedido ao mover para Loss); quem marcou é id_usuario
  motivo_loss?: string | null;
  detalhe_loss?: string | null;
  id_usuario_loss?: number | null;
  data_loss?: string | null;
};


// data_call é gravada com o fuso de Brasília; o input datetime-local trabalha com "YYYY-MM-DDTHH:mm"
const callParaBanco = (local: string): string | null => local ? `${local}:00-03:00` : null;

// Remarcado sem data da próxima call: marcado como "A definir", ou sem data nenhuma
const callADefinir = (l: Pick<Lead, 'status_atual' | 'data_call' | 'call_a_definir'>) =>
  l.status_atual === 'Remarcado' && (l.call_a_definir === true || !l.data_call);

// Nome do arquivo exportado conforme o período
const nomePeriodo = (inicio: string, fim: string) =>
  inicio && fim ? `${inicio}_a_${fim}` : inicio ? `desde_${inicio}` : fim ? `ate_${fim}` : todayBrasilia();

// Exportar personalizado: filtros próprios, sem mexer nos do quadro. Lista vazia = sem restrição
type FiltrosExport = {
  inicio: string; fim: string;
  sdrs: number[]; closers: number[]; status: string[]; produtos: number[]; formas: string[];
  off: 'todos' | 'off' | 'metricas'; motivos: string[]; colunas: string[];
};
const filtrosExportIniciais = (inicio: string, fim: string): FiltrosExport => ({
  inicio, fim, sdrs: [], closers: [], status: [], produtos: [], formas: [], off: 'todos', motivos: [],
  colunas: COLUNAS_CSV_LEADS.map(c => c.key),
});
const SEM_MOTIVO_LOSS = 'Não informado';
const passaExportPersonalizado = (l: Lead, f: FiltrosExport) => {
  // Mesmos status que o quadro mostra; "Nao prosseguiu" fica na coluna Loss
  const status = l.status_atual === 'Nao prosseguiu' ? 'Loss' : l.status_atual;
  if (!KANBAN_COLUMNS.includes(status)) return false;
  if (f.sdrs.length > 0 && !f.sdrs.includes(l.id_sdr_responsavel ?? -1)) return false;
  if (f.closers.length > 0 && !f.closers.includes(l.id_closer_responsavel ?? -1)) return false;
  if (f.status.length > 0 && !f.status.includes(status)) return false;
  if (f.produtos.length > 0 && !f.produtos.some(p => (l.produtos_ids || []).includes(p))) return false;
  if (f.formas.length > 0 && !f.formas.some(fp => (l.formas_pagamento || []).includes(fp))) return false;
  if (f.off === 'off' && !l.off_metricas) return false;
  if (f.off === 'metricas' && l.off_metricas) return false;
  // Motivo do Loss só existe nos leads em Loss
  if (f.motivos.length > 0 && (l.status_atual !== 'Loss' || !f.motivos.includes(l.motivo_loss || SEM_MOTIVO_LOSS))) return false;
  return true;
};

// Chip de filtro (ligado/desligado) nas cores do tema
const estiloChip = (ativo: boolean) => ({
  background: ativo ? 'var(--accent)' : 'var(--bg-app)',
  color: ativo ? 'var(--accent-text)' : 'var(--text-sec)',
  border: `1px solid ${ativo ? 'var(--accent)' : 'var(--border-str)'}`,
});

// Cards desenhados por coluna antes do "Ver mais": desenhar os 1000+ leads de uma vez pesa no navegador
const CARDS_POR_COLUNA = 50;

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
  const { selectedProject, userName, isLoading: carregandoProjeto } = useProject();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  // loading: só a primeira carga troca a tela; depois o quadro fica visível e refreshing mostra um aviso discreto
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const leadsRequestRef = useRef(0);
  const buscandoLeadsRef = useRef(false);
  // Quantos cards cada coluna mostra (cresce com "Ver mais") e leads movidos nesta visita, que vão para o topo
  const [limitePorColuna, setLimitePorColuna] = useState<Record<string, number>>({});
  const [movidosAgora, setMovidosAgora] = useState<number[]>([]);
  const marcarMovido = (id_lead: number) =>
    setMovidosAgora(prev => [id_lead, ...prev.filter(id => id !== id_lead)]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  // Kanban filter state
  const [filterSdr, setFilterSdr] = useState("");
  const [filterCloser, setFilterCloser] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  // Payment method filter (multi-select)
  const [filterFormas, setFilterFormas] = useState<string[]>([]);
  // Product filter (multi-select)
  const [filterProdutos, setFilterProdutos] = useState<number[]>([]);
  // Off métricas: todos, só os OFF ou só os que contam nas métricas
  const [filterOff, setFilterOff] = useState<'todos' | 'off' | 'metricas'>('todos');
  // Painel "Filtros" (SDR, Closer, Off métricas, Pagamento e Produto num botão só)
  const [showFiltros, setShowFiltros] = useState(false);
  const filtrosAtivos = [filterSdr, filterCloser, filterFormas.length > 0, filterProdutos.length > 0, filterOff !== 'todos'].filter(Boolean).length;
  // Esc fecha o painel de filtros
  useEffect(() => {
    if (!showFiltros) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowFiltros(false); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [showFiltros]);
  const limparFiltros = () => {
    setFilterSdr("");
    setFilterCloser("");
    setFilterFormas([]);
    setFilterProdutos([]);
    setFilterOff('todos');
  };

  // Export menu state
  const [showExportMenu, setShowExportMenu] = useState(false);
  // Copiar nomes no topo da coluna: a coluna copiada mostra ✓ por 2 segundos
  const [colunaCopiada, setColunaCopiada] = useState<string | null>(null);
  const copiadoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Exportar personalizado: leads do período escolhido no modal (null = carregando)
  const [showExportCustom, setShowExportCustom] = useState(false);
  const [expFiltros, setExpFiltros] = useState<FiltrosExport>(() => filtrosExportIniciais("", ""));
  const [expLeads, setExpLeads] = useState<Lead[] | null>(null);
  const [expErro, setExpErro] = useState(false);
  const [expBaixando, setExpBaixando] = useState(false);
  const expRequestRef = useRef(0);
  // Off métricas state (separate from formData to avoid reset conflicts)
  const [offMetricas, setOffMetricas] = useState(false);
  // Refund modal state
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundLeadId, setRefundLeadId] = useState<number | null>(null);
  const [refundMotivo, setRefundMotivo] = useState("");
  // Remarcar: pede a nova data da call; a data de entrada do lead não muda
  const [remarcarLead, setRemarcarLead] = useState<Lead | null>(null);
  const [remarcarData, setRemarcarData] = useState("");
  const [remarcarSalvando, setRemarcarSalvando] = useState(false);
  // Loss: pede o motivo (lista fixa + detalhe); cancelar deixa o lead onde estava
  const [lossLead, setLossLead] = useState<Lead | null>(null);
  const [lossMotivo, setLossMotivo] = useState("");
  const [lossDetalhe, setLossDetalhe] = useState("");
  const [lossSalvando, setLossSalvando] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    instagram: "",
    email: "",
    origem: "",
    id_sdr_responsavel: "",
    id_closer_responsavel: "",
    observacoes_gerais: "",
    data_entrada: "",
    data_call: ""
  });

  // Sales Modal State
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [saleLead, setSaleLead] = useState<Lead | null>(null);
  const [saleObservacoes, setSaleObservacoes] = useState("");
  const [showCaixaBreakdown, setShowCaixaBreakdown] = useState(false);
  const [saleDate, setSaleDate] = useState(() => todayBrasilia());
  // Comprovante upload state
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [comprovantePreview, setComprovantePreview] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Detail panel state
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [detailVendas, setDetailVendas] = useState<any[]>([]);
  const [detailCaixaOpen, setDetailCaixaOpen] = useState(false);
  const [detailStatusSaving, setDetailStatusSaving] = useState(false);
  const [briefingExpanded, setBriefingExpanded] = useState(false);

  type Pagamento = { id: string; forma_pagamento: string; valor: string; numero_parcelas: string; taxa_gateway: string; taxa_entrada: string; valor_entrada: string; entrada_paga_empresa: boolean; status_pagamento: string; data_recebimento_custom: string; };
  const newPagamento = (defaultGateway = ""): Pagamento => ({
    id: Math.random().toString(36).slice(2),
    forma_pagamento: defaultGateway,
    valor: "",
    numero_parcelas: "1",
    taxa_gateway: "0",
    taxa_entrada: "0",
    valor_entrada: "",
    entrada_paga_empresa: false,
    status_pagamento: "pago",
    data_recebimento_custom: ""
  });
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([newPagamento()]);

  const [gateways, setGateways] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [selectedProdutos, setSelectedProdutos] = useState<number[]>([]);


  useEffect(() => {
    if (!selectedProject) return;
    fetchUsers();
    fetchGateways();
    fetchProdutos();
  }, [selectedProject]);

  // Enquanto o projeto carrega, segue em "Carregando leads..." (antes mostrava o quadro vazio);
  // só para de carregar sem projeto quando não existe projeto nenhum
  useEffect(() => {
    if (!selectedProject && !carregandoProjeto) setLoading(false);
  }, [selectedProject, carregandoProjeto]);


  // Abre na hora com a cópia da última visita; a busca do efeito seguinte atualiza em segundo plano
  useEffect(() => {
    if (!selectedProject) return;
    const cache = lerCacheLeads<Lead>(selectedProject.id_projeto);
    if (cache) {
      setLeads(cache);
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject) fetchLeads();
  }, [selectedProject, startDate, endDate]);

  const fetchGateways = async (skipReset = false) => {
    try {
      const projectParam = selectedProject?.id_projeto
        ? `?projectId=${selectedProject.id_projeto}`
        : '';
      const res = await fetch(`/api/gateways${projectParam}`);
      const data = await res.json();
      const ativos = data.filter((g: any) => g.ativo !== false && g.ativo !== 0);
      setGateways(ativos);
      // Only reset pagamentos if not called from inside the sale modal flow
      if (!skipReset && ativos.length > 0) {
        setPagamentos([newPagamento(ativos[0].nome)]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProdutos = async () => {
    if (!selectedProject?.id_projeto) return;
    try {
      const res = await fetch(`/api/produtos?projectId=${selectedProject.id_projeto}`);
      const data = await res.json();
      setProdutos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };


  // gwList: optional override — pass fresh gateways when the React state may be stale
  const calcFee = (gatewayName: string, valor: string, entradaStr?: string, gwList?: any[]) => {
    const list = gwList ?? gateways;
    const gw = list.find((g: any) => g.nome === gatewayName);
    if (!gw) return { total: "0", entrada: "0" };
    let v = parseFloat(valor) || 0;
    let entrada = parseFloat(entradaStr || "0") || 0;
    if (v <= 0) return { total: "0", entrada: "0" };
    
    let taxaTotal = 0;
    let taxaEntradaCalc = 0;

    if (entrada > 0 && entrada < v && gw.tem_entrada) {
        taxaEntradaCalc = (entrada * ((gw.taxa_entrada_percentual ?? 0) / 100)) + (gw.taxa_entrada_fixa ?? 0);
        const taxaResto = ((v - entrada) * ((gw.taxa_percentual ?? 0) / 100)) + (gw.taxa_fixa ?? 0);
        taxaTotal = taxaEntradaCalc + taxaResto;
    } else {
        taxaTotal = (v * ((gw.taxa_percentual ?? 0) / 100)) + (gw.taxa_fixa ?? 0);
    }
    // Safety cap: taxa can never exceed the total value
    taxaTotal = Math.min(taxaTotal, v);
    return { total: taxaTotal.toFixed(2), entrada: taxaEntradaCalc.toFixed(2) };
  };

  const handlePagamentoChange = (id: string, field: keyof Pagamento, value: string | boolean) => {
    setPagamentos(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: value };
      if ((field === 'forma_pagamento' || field === 'valor' || field === 'valor_entrada') && typeof value === 'string') {
        const gwName = field === 'forma_pagamento' ? value : p.forma_pagamento;
        const valorBase = field === 'valor' ? value : p.valor;
        const entradaVal = field === 'valor_entrada' ? value : p.valor_entrada;
        const fees = calcFee(gwName, valorBase, entradaVal);
        updated.taxa_gateway = fees.total;
        updated.taxa_entrada = fees.entrada;
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
    const entrada = parseFloat(p.valor_entrada) || 0;
    const descEntrada = p.entrada_paga_empresa ? entrada : 0;
    acc.bruto += v;
    acc.liquido += v - taxa - descEntrada;
    return acc;
  }, { bruto: 0, liquido: 0 });

  // Filtros do quadro, fora a data (o período já vem na busca dos leads)
  const passaFiltros = (l: Lead) => {
    if (filterSdr && String(l.id_sdr_responsavel) !== filterSdr) return false;
    if (filterCloser && String(l.id_closer_responsavel) !== filterCloser) return false;
    if (filterFormas.length > 0) {
      const leadFormas = l.formas_pagamento || [];
      if (!filterFormas.some(f => leadFormas.includes(f))) return false;
    }
    if (filterProdutos.length > 0) {
      const leadProdutos = l.produtos_ids || [];
      if (!filterProdutos.some(pid => leadProdutos.includes(pid))) return false;
    }
    if (filterOff === 'off' && !l.off_metricas) return false;
    if (filterOff === 'metricas' && l.off_metricas) return false;
    if (searchTerm && !l.nome.toLowerCase().includes(searchTerm.toLowerCase()) && !l.telefone?.includes(searchTerm)) return false;
    return true;
  };

  // Copia os nomes de uma coluna, um por linha, na ordem do quadro (inclui os escondidos pelo "Ver mais")
  const copiarNomesDaColuna = async (col: string, nomes: string[]) => {
    const texto = nomes.join('\n');
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Navegador sem acesso à área de transferência: copia por um campo escondido
      const campo = document.createElement('textarea');
      campo.value = texto;
      campo.setAttribute('readonly', '');
      campo.style.position = 'fixed';
      campo.style.opacity = '0';
      document.body.appendChild(campo);
      campo.select();
      const copiou = document.execCommand('copy');
      document.body.removeChild(campo);
      if (!copiou) {
        alert('Não foi possível copiar os nomes.');
        return;
      }
    }
    setColunaCopiada(col);
    if (copiadoTimerRef.current) clearTimeout(copiadoTimerRef.current);
    copiadoTimerRef.current = setTimeout(() => setColunaCopiada(null), 2000);
  };

  // Exporta só os leads que o quadro está mostrando: mesmo período de entrada e mesmos filtros
  const handleExportCSV = async () => {
    if (refreshing) {
      alert('Aguarde os leads do período carregarem e tente de novo.');
      return;
    }
    const visiveis = new Set(
      leads
        .filter(l => (KANBAN_COLUMNS.includes(l.status_atual) || l.status_atual === 'Nao prosseguiu') && passaFiltros(l))
        .map(l => l.id_lead)
    );
    if (visiveis.size === 0) {
      alert('Nenhum lead para exportar com esses filtros.');
      return;
    }
    try {
      const query = new URLSearchParams();
      if (selectedProject?.id_projeto) query.set('projectId', selectedProject.id_projeto.toString());
      if (startDate) query.set('startDate', startDate);
      if (endDate) query.set('endDate', endDate);
      const res = await fetch(`/api/export-leads?${query.toString()}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) throw new Error(data?.error || 'Resposta inválida');
      // As observações só vêm pela exportação; o que entra no arquivo é o que está no quadro
      exportLeadsToCSV(data.filter((l: { id_lead: number }) => visiveis.has(l.id_lead)), `leads_${nomePeriodo(startDate, endDate)}.csv`);
    } catch (e) {
      console.error('Erro ao exportar:', e);
      alert('Erro ao exportar dados. Tente novamente.');
    }
  };

  // Exportar personalizado: no mesmo período do quadro usa os leads já carregados; noutro, busca os do período
  const expUsaQuadro = expFiltros.inicio === startDate && expFiltros.fim === endDate;
  const expBase: Lead[] | null = expUsaQuadro ? (refreshing ? null : leads) : expLeads;
  const expSelecionados = expBase ? expBase.filter(l => passaExportPersonalizado(l, expFiltros)) : [];

  useEffect(() => {
    if (!showExportCustom || expUsaQuadro || !selectedProject) return;
    const requestId = ++expRequestRef.current;
    setExpLeads(null);
    setExpErro(false);
    // Espera a data terminar de ser digitada antes de buscar
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ projectId: String(selectedProject.id_projeto) });
        if (expFiltros.inicio) query.set('startDate', expFiltros.inicio);
        if (expFiltros.fim) query.set('endDate', expFiltros.fim);
        const res = await fetch(`/api/leads?${query.toString()}`);
        const data = await res.json();
        if (requestId !== expRequestRef.current) return;
        if (!res.ok || !Array.isArray(data)) throw new Error(data?.error || `HTTP ${res.status}`);
        setExpLeads(data);
      } catch (e) {
        console.error('Erro ao carregar leads do export personalizado:', e);
        if (requestId === expRequestRef.current) setExpErro(true);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [showExportCustom, expUsaQuadro, expFiltros.inicio, expFiltros.fim, selectedProject]);

  const abrirExportPersonalizado = () => {
    setExpFiltros(filtrosExportIniciais(startDate, endDate));
    setExpErro(false);
    setShowExportCustom(true);
  };

  // Mesma rota e mesmo formato do Exportar CSV; só entram os leads que passam nos filtros do modal
  const handleExportPersonalizado = async () => {
    if (!expBase || expBaixando) return;
    const ids = new Set(expSelecionados.map(l => l.id_lead));
    if (ids.size === 0 || expFiltros.colunas.length === 0) return;
    setExpBaixando(true);
    try {
      const query = new URLSearchParams();
      if (selectedProject?.id_projeto) query.set('projectId', selectedProject.id_projeto.toString());
      if (expFiltros.inicio) query.set('startDate', expFiltros.inicio);
      if (expFiltros.fim) query.set('endDate', expFiltros.fim);
      const res = await fetch(`/api/export-leads?${query.toString()}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) throw new Error(data?.error || 'Resposta inválida');
      exportLeadsToCSV(
        data.filter((l: { id_lead: number }) => ids.has(l.id_lead)),
        `leads_personalizado_${nomePeriodo(expFiltros.inicio, expFiltros.fim)}.csv`,
        expFiltros.colunas,
      );
      setShowExportCustom(false);
    } catch (e) {
      console.error('Erro ao exportar:', e);
      alert('Erro ao exportar dados. Tente novamente.');
    } finally {
      setExpBaixando(false);
    }
  };

  // Activity log helper
  const logActivity = async (id_lead: number, acao: string) => {
    try {
      await fetch('/api/lead-historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_lead, acao })
      });
    } catch (e) { console.error('log failed', e); }
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

  // silencioso: atualização por aviso de outra pessoa (tempo real), sem o "Atualizando..." no título
  const fetchLeads = async (silencioso = false) => {
    // Se outra busca começar antes desta terminar (ex.: troca de data), a resposta antiga é descartada
    const requestId = ++leadsRequestRef.current;
    buscandoLeadsRef.current = true;
    try {
      if (!silencioso) setRefreshing(true);
      const query = new URLSearchParams();
      if (selectedProject?.id_projeto) query.set('projectId', selectedProject.id_projeto.toString());
      if (startDate) query.set('startDate', startDate);
      if (endDate) query.set('endDate', endDate);
      const res = await fetch(`/api/leads?${query.toString()}`);
      const data = await res.json();
      if (requestId !== leadsRequestRef.current) return;
      if (Array.isArray(data)) {
        setLeads(data);
        // Só a lista sem filtro de data é a que o painel mostra ao abrir
        if (selectedProject && !startDate && !endDate) salvarCacheLeads(selectedProject.id_projeto, data);
      } else {
        console.error('Erro ao carregar leads', data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (requestId === leadsRequestRef.current) {
        buscandoLeadsRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Tempo real: quando alguém salva um lead, venda ou follow neste projeto, o quadro se atualiza sozinho.
  // Espera soltar o card se a pessoa estiver arrastando um.
  const arrastandoRef = useRef(false);
  useAoVivo(['leads', 'vendas', 'follow-ups'], selectedProject?.id_projeto, () => fetchLeads(true), () => arrastandoRef.current);

  // Uma busca que começou antes de uma alteração pode trazer o lead como era: busca de novo
  const rebuscarSeEmAndamento = () => {
    if (buscandoLeadsRef.current) fetchLeads();
  };

  const abrirRemarcar = (lead: Lead) => {
    setRemarcarLead(lead);
    setRemarcarData("");
  };

  const handleSaveRemarcar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarcarLead || !remarcarData || remarcarSalvando) return;
    const lead = remarcarLead;
    const dataCall = callParaBanco(remarcarData);
    setRemarcarSalvando(true);
    try {
      // Só status e data da call: a data de entrada continua a mesma
      const res = await fetch("/api/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_lead: lead.id_lead, status_atual: "Remarcado", data_call: dataCall, usuario_nome: userName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Erro ao remarcar: ${err.error || `HTTP ${res.status}`}`);
        return;
      }
      setLeads(prev => prev.map(l => l.id_lead === lead.id_lead ? { ...l, status_atual: "Remarcado", data_call: dataCall, call_a_definir: false } : l));
      setDetailLead(prev => prev && prev.id_lead === lead.id_lead ? { ...prev, status_atual: "Remarcado", data_call: dataCall, call_a_definir: false } : prev);
      marcarMovido(lead.id_lead);
      setRemarcarLead(null);
      rebuscarSeEmAndamento();
      await logActivity(lead.id_lead, `Status alterado para "Remarcado" (call em ${formatCallBr(dataCall)})`);
    } catch (err) {
      console.error(err);
      alert("Erro ao remarcar. Tente de novo.");
    } finally {
      setRemarcarSalvando(false);
    }
  };

  // Remarcado sem nova data: a call anterior fica guardada em data_call e o card mostra "Data a definir"
  const handleRemarcarADefinir = async () => {
    if (!remarcarLead || remarcarSalvando) return;
    const lead = remarcarLead;
    setRemarcarSalvando(true);
    try {
      const res = await fetch("/api/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_lead: lead.id_lead, status_atual: "Remarcado", call_a_definir: true, usuario_nome: userName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Erro ao remarcar: ${err.error || `HTTP ${res.status}`}`);
        return;
      }
      setLeads(prev => prev.map(l => l.id_lead === lead.id_lead ? { ...l, status_atual: "Remarcado", call_a_definir: true } : l));
      setDetailLead(prev => prev && prev.id_lead === lead.id_lead ? { ...prev, status_atual: "Remarcado", call_a_definir: true } : prev);
      marcarMovido(lead.id_lead);
      setRemarcarLead(null);
      rebuscarSeEmAndamento();
      await logActivity(lead.id_lead, `Status alterado para "Remarcado" (data da call a definir${lead.data_call ? `; call anterior em ${formatCallBr(lead.data_call)}` : ''})`);
    } catch (err) {
      console.error(err);
      alert("Erro ao remarcar. Tente de novo.");
    } finally {
      setRemarcarSalvando(false);
    }
  };

  const abrirLoss = (lead: Lead) => {
    setLossLead(lead);
    setLossMotivo("");
    setLossDetalhe("");
  };

  const handleSaveLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lossLead || lossSalvando) return;
    const erro = validarMotivoLoss(lossMotivo, lossDetalhe);
    if (erro) { alert(erro); return; }
    const lead = lossLead;
    setLossSalvando(true);
    try {
      const res = await fetch("/api/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_lead: lead.id_lead, status_atual: "Loss", motivo_loss: lossMotivo, detalhe_loss: lossDetalhe, usuario_nome: userName }),
      });
      const salvo = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Erro ao mover para Loss: ${salvo.error || `HTTP ${res.status}`}`);
        return;
      }
      const dadosLoss = {
        status_atual: "Loss",
        motivo_loss: salvo.motivo_loss ?? lossMotivo,
        detalhe_loss: salvo.detalhe_loss ?? (lossDetalhe.trim() || null),
        id_usuario_loss: salvo.id_usuario_loss ?? null,
        data_loss: salvo.data_loss ?? new Date().toISOString(),
      };
      setLeads(prev => prev.map(l => l.id_lead === lead.id_lead ? { ...l, ...dadosLoss } : l));
      setDetailLead(prev => prev && prev.id_lead === lead.id_lead ? { ...prev, ...dadosLoss } : prev);
      marcarMovido(lead.id_lead);
      setLossLead(null);
      rebuscarSeEmAndamento();
      await logActivity(lead.id_lead, `Status alterado para "Loss" — motivo: "${dadosLoss.motivo_loss}"${dadosLoss.detalhe_loss ? ` (${dadosLoss.detalhe_loss})` : ""}`);
    } catch (err) {
      console.error(err);
      alert("Erro ao mover para Loss. Tente de novo.");
    } finally {
      setLossSalvando(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, id_lead: number) => {
    arrastandoRef.current = true;
    e.dataTransfer.setData("id_lead", id_lead.toString());
  };

  const handleDrop = async (e: React.DragEvent, status_novo: string) => {
    arrastandoRef.current = false;
    e.preventDefault();
    const id_lead = parseInt(e.dataTransfer.getData("id_lead"));

    if (!id_lead) return;

    // Intercept when dropping on "Venda"
    if (status_novo === "Venda") {
      const leadInfo = leads.find((l) => l.id_lead === id_lead);
      if (leadInfo) {
        if (leadInfo.status_atual === 'Venda') {
          // Lead already in Venda — open the edit-sale flow
          handleOpenEditSale({ stopPropagation: () => {} } as any, leadInfo);
        } else {
          // Check if this lead already has vendas in DB (e.g. moved from No-show back to Venda)
          const existingCheck = await fetch(`/api/vendas?leadId=${leadInfo.id_lead}`);
          const existingRows = await existingCheck.json();
          if (Array.isArray(existingRows) && existingRows.length > 0) {
            // Has prior vendas — open edit flow so user can review/update
            handleOpenEditSale({ stopPropagation: () => {} } as any, leadInfo);
          } else {
          // Always fetch fresh project-scoped gateways so calcFee gets the current rates.
          // Using gateways state would risk stale/empty data from a previous render.
          const projectParam = selectedProject?.id_projeto ? `?projectId=${selectedProject.id_projeto}` : '';
          const freshGws: any[] = await fetch(`/api/gateways${projectParam}`)
            .then(r => r.json())
            .then((d: any[]) => d.filter((g: any) => g.ativo !== false && g.ativo !== 0));
          setGateways(freshGws); // update state so modal uses fresh rates too
          const defaultGw = freshGws[0]?.nome || "PIX";
          const propValue = leadInfo.valor_proposta ? leadInfo.valor_proposta.toString() : "";
          // Pass freshGws directly — React state update above won't be visible yet in this closure
          const initialFeeCalc = propValue ? calcFee(defaultGw, propValue, undefined, freshGws) : { total: "0", entrada: "0" };
          const initialPagamento = {
            id: Math.random().toString(36).slice(2),
            forma_pagamento: defaultGw,
            valor: propValue,
            numero_parcelas: "1",
            taxa_gateway: initialFeeCalc.total,
            taxa_entrada: initialFeeCalc.entrada,
            valor_entrada: "",
            entrada_paga_empresa: false,
            status_pagamento: "pago",
            data_recebimento_custom: ""
          };
          setPagamentos([initialPagamento]);
          setSaleObservacoes("");
          setSaleLead(leadInfo);
          setIsSaleModalOpen(true);
          } // end else (no existing vendas)
        }
      }
      return;
    }

    // Intercept when dropping on "Reembolsado"
    if (status_novo === "Reembolsado") {
      setRefundLeadId(id_lead);
      setRefundMotivo("");
      setIsRefundModalOpen(true);
      return;
    }

    // Remarcado: pede a nova data da call antes de mover
    if (status_novo === "Remarcado") {
      const leadInfo = leads.find((l) => l.id_lead === id_lead);
      if (leadInfo) abrirRemarcar(leadInfo);
      return;
    }

    // Loss: pede o motivo antes de mover (solto na própria coluna Loss, nada muda)
    if (status_novo === "Loss") {
      const leadInfo = leads.find((l) => l.id_lead === id_lead);
      if (leadInfo && leadInfo.status_atual !== "Loss") abrirLoss(leadInfo);
      return;
    }

    // Optimistic Update for standard columns
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id_lead === id_lead ? { ...lead, status_atual: status_novo } : lead
      )
    );
    marcarMovido(id_lead);

    // Persist to DB + log activity
    try {
      await fetch("/api/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_lead, status_atual: status_novo, usuario_nome: userName }),
      });
      await logActivity(id_lead, `Status alterado para "${status_novo}"`);
      rebuscarSeEmAndamento();
    } catch (err) {
      console.error("Failed to update status", err);
      fetchLeads();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessário para permitir o drop
  };

  const handleOpenCreate = () => {
    setEditingLeadId(null);
    setOffMetricas(false);
    setFormData({
      nome: "", telefone: "", instagram: "", email: "", origem: "", id_sdr_responsavel: "", id_closer_responsavel: "", observacoes_gerais: "",
      data_entrada: nowBrasiliaLocal(),
      data_call: ""
    });
    setIsModalOpen(true);
  };

  // As observações não vêm na lista de leads (são o grosso do peso); busca só quando o lead é aberto
  const carregarObservacoes = async (lead: Lead): Promise<string> => {
    if (lead.observacoes_gerais !== undefined) return lead.observacoes_gerais || "";
    const res = await fetch(`/api/leads?id=${lead.id_lead}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.observacoes_gerais || "";
  };

  const handleOpenEdit = async (lead: Lead) => {
    let observacoes: string;
    try {
      observacoes = await carregarObservacoes(lead);
    } catch (err) {
      // Sem as observações carregadas, salvar o formulário apagaria as do banco
      console.error(err);
      alert('Não foi possível abrir o lead para edição. Tente de novo.');
      return;
    }
    setEditingLeadId(lead.id_lead);
    setOffMetricas(lead.off_metricas ?? false);

    const dEntrada = lead.data_entrada ? new Date(lead.data_entrada) : new Date();
    // data_entrada fica gravada com a hora de Brasília como foi digitada (o card mostra assim, sem converter fuso).
    // Converter aqui abria o formulário 3h antes e cada edição salva puxava a entrada para trás
    const dataEntradaLocal = lead.data_entrada
      ? lead.data_entrada.replace(' ', 'T').slice(0, 16)
      : nowBrasiliaLocal();

    setFormData({
      nome: lead.nome || "",
      telefone: lead.telefone || "",
      instagram: lead.instagram || "",
      email: lead.email || "",
      origem: lead.origem || "",
      id_sdr_responsavel: lead.id_sdr_responsavel?.toString() || "",
      id_closer_responsavel: lead.id_closer_responsavel?.toString() || "",
      observacoes_gerais: observacoes,
      data_entrada: dataEntradaLocal,
      // Remarcado a definir: o campo abre vazio para a nova data; a call anterior aparece embaixo dele
      data_call: lead.data_call && !callADefinir(lead) ? dbDateToBrasiliaLocal(lead.data_call) : ""
    });
    setIsModalOpen(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || isSavingLead) return;

    setIsSavingLead(true);
    try {
      const isEdit = editingLeadId !== null;
      const method = isEdit ? "PUT" : "POST";
      const sdrId = formData.id_sdr_responsavel ? parseInt(formData.id_sdr_responsavel) : null;
      const closerId = formData.id_closer_responsavel ? parseInt(formData.id_closer_responsavel) : null;
      // Remarcado a definir: campo vazio mantém a call anterior; preenchido vira a nova call e tira o "a definir"
      const leadEditado = isEdit ? leads.find(l => l.id_lead === editingLeadId) : undefined;
      const esperandoData = !!leadEditado && callADefinir(leadEditado);
      const manterCallAnterior = esperandoData && !formData.data_call;
      const novaCall = manterCallAnterior ? undefined : callParaBanco(formData.data_call);

      const res = await fetch("/api/leads", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          id_lead: editingLeadId,
          is_full_update: isEdit ? true : undefined,
          id_sdr_responsavel: sdrId,
          id_closer_responsavel: closerId,
          id_projeto: selectedProject.id_projeto,
          usuario_nome: userName,
          off_metricas: offMetricas,
          data_call: novaCall,
          ...(esperandoData && !manterCallAnterior ? { call_a_definir: false } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Erro ao salvar lead: ${err.error || `HTTP ${res.status}`}`);
        return;
      }
      if (isEdit) {
        // Atualiza o card na hora; a busca em segundo plano traz o resto (datas, vendas)
        const nomeUsuario = (id: number | null) => users.find(u => u.id_usuario === id)?.nome ?? "";
        setLeads(prev => prev.map(l => l.id_lead === editingLeadId ? {
          ...l,
          nome: formData.nome,
          telefone: formData.telefone,
          instagram: formData.instagram,
          email: formData.email,
          origem: formData.origem,
          observacoes_gerais: formData.observacoes_gerais,
          id_sdr_responsavel: sdrId,
          id_closer_responsavel: closerId,
          sdr_nome: nomeUsuario(sdrId),
          closer_nome: nomeUsuario(closerId),
          off_metricas: offMetricas,
          ...(manterCallAnterior ? {} : { data_call: novaCall, call_a_definir: false }),
        } : l));
      }
      setIsModalOpen(false);
      setFormData({
        nome: "", telefone: "", instagram: "", email: "", origem: "", id_sdr_responsavel: "", id_closer_responsavel: "", observacoes_gerais: "", data_entrada: "", data_call: ""
      });
      fetchLeads();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingLead(false);
    }
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleLead) return;

    const currentLeadId = saleLead.id_lead;
    const currentLead = leads.find(l => l.id_lead === currentLeadId);
    const isEdit = currentLead?.status_atual === 'Venda';

    try {
      const res = await fetch("/api/vendas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_lead: saleLead.id_lead,
          pagamentos,
          observacoes: saleObservacoes,
          id_sdr: saleLead.id_sdr_responsavel,
          id_closer: saleLead.id_closer_responsavel,
          data_venda: saleDate,
          closer_nome: userName,
          id_produtos: selectedProdutos,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const saleData = await res.json();

      // ── Upload comprovante se houver ───────────────────────────────────
      if (comprovanteFile && saleData.id_oportunidade) {
        try {
          const supabase = createBrowserClient();
          const ext = comprovanteFile.name.split('.').pop();
          const path = `${saleLead.id_lead}/${saleData.id_oportunidade}_${Date.now()}.${ext}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('comprovantes')
            .upload(path, comprovanteFile, { upsert: true });

          if (!uploadError && uploadData) {
            const { data: { publicUrl } } = supabase.storage
              .from('comprovantes')
              .getPublicUrl(path);

            // Salvar URL na oportunidade
            await supabase
              .from('oportunidades')
              .update({ comprovante_url: publicUrl })
              .eq('id_oportunidade', saleData.id_oportunidade);
          }
        } catch (uploadErr) {
          console.warn('Comprovante upload falhou (venda salva normalmente):', uploadErr);
        }
      }

      await logActivity(currentLeadId, isEdit ? 'Venda editada' : 'Venda registrada');
      setIsSaleModalOpen(false);
      setSaleLead(null);
      setSaleObservacoes("");
      setShowCaixaBreakdown(false);
      setPagamentos([newPagamento(gateways[0]?.nome || "")]);
      setSaleDate(todayBrasilia());
      setComprovanteFile(null);
      setComprovantePreview(null);
      setSelectedProdutos([]);
      // Card vai para Venda na hora; a busca em segundo plano traz valores e formas de pagamento
      setLeads(prev => prev.map(l => l.id_lead === currentLeadId ? { ...l, status_atual: 'Venda' } : l));
      marcarMovido(currentLeadId);
      fetchLeads();

    } catch (err: any) {
      console.error('Sale save error:', err);
      alert(`Erro ao salvar venda: ${err.message || err}`);
    }
  };
  const handleOpenEditSale = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    try {
      const [res, observacoes] = await Promise.all([
        fetch(`/api/vendas?leadId=${lead.id_lead}`),
        carregarObservacoes(lead),
      ]);
      const rows: any[] = await res.json();

      if (rows.length === 0) {
        // No existing rows? Open as a fresh sale
        const defaultGw = gateways[0]?.nome || "PIX";
        setPagamentos([newPagamento(defaultGw)]);
        setSaleObservacoes(observacoes);
        setSaleDate(todayBrasilia());
      } else {
        // Reconstruct pagamentos from DB rows.
        // Rules:
        //  - Rows with "(Entrada)" or "(Parcelas)" suffix belong to the same split
        //    payment and must be merged by gateway name.
        //  - Plain rows (no suffix) are independent payments — even two PIX rows
        //    must stay separate. Key them by id_venda to avoid collapsing.
        const splitMap: Record<string, any> = {};
        const plainList: any[] = [];

        for (const row of rows) {
          const isSplit = row.forma_pagamento.includes('(Entrada)') || row.forma_pagamento.includes('(Parcelas)');
          const baseGw = row.forma_pagamento.replace(/ \(Entrada\)| \(Parcelas\)/g, '');

          if (isSplit) {
            if (!splitMap[baseGw]) {
              splitMap[baseGw] = {
                id: Math.random().toString(36).slice(2),
                forma_pagamento: baseGw,
                valor: 0,
                numero_parcelas: '1',
                taxa_gateway: 0,
                taxa_entrada: '0',
                valor_entrada: '',
                entrada_paga_empresa: false,
                status_pagamento: row.status_pagamento || 'pago',
                data_recebimento_custom: ''
              };
            }
            if (row.forma_pagamento.includes('(Entrada)')) {
              splitMap[baseGw].valor += parseFloat(row.valor_bruto) || 0;
              splitMap[baseGw].valor_entrada = (parseFloat(row.valor_bruto) || 0).toString();
              splitMap[baseGw].taxa_gateway += parseFloat(row.taxa_gateway) || 0;
              splitMap[baseGw].taxa_entrada = (parseFloat(row.taxa_gateway) || 0).toFixed(2);
              splitMap[baseGw].entrada_paga_empresa = parseFloat(row.valor_liquido_caixa) < 0;
            } else {
              // (Parcelas) row
              splitMap[baseGw].valor += parseFloat(row.valor_bruto) || 0;
              splitMap[baseGw].numero_parcelas = row.numero_parcelas.toString();
              splitMap[baseGw].taxa_gateway += parseFloat(row.taxa_gateway) || 0;
              splitMap[baseGw].status_pagamento = row.status_pagamento || 'pago';
              // pre-fill date for both pago and pendente
              if (row.data_recebimento) {
                splitMap[baseGw].data_recebimento_custom = row.data_recebimento;
              }
            }
          } else {
            // Plain independent row — never merge, even if same gateway
            plainList.push({
              id: Math.random().toString(36).slice(2),
              forma_pagamento: baseGw,
              valor: (parseFloat(row.valor_bruto) || 0).toString(),
              numero_parcelas: (row.numero_parcelas || 1).toString(),
              taxa_gateway: (parseFloat(row.taxa_gateway) || 0).toFixed(2),
              taxa_entrada: '0',
              valor_entrada: '',
              entrada_paga_empresa: false,
              status_pagamento: row.status_pagamento || 'pago',
              // pre-fill date for both pago and pendente
              data_recebimento_custom: row.data_recebimento ? row.data_recebimento : ''
            });
          }
        }
        const reconstructed = [
          ...Object.values(splitMap).map((m: any) => ({
            ...m,
            valor: m.valor.toString(),
            taxa_gateway: typeof m.taxa_gateway === 'number' ? m.taxa_gateway.toFixed(2) : m.taxa_gateway
          })),
          ...plainList
        ];

        setPagamentos(reconstructed);
        setSaleObservacoes(observacoes);
        
        const fallbackToday = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
        const existingDate = rows[0]?.data_venda ? rows[0].data_venda.substring(0, 10) : fallbackToday;
        setSaleDate(existingDate);

        // ─── Load previously saved products ───────────────────────────────
        try {
          const vendaIds = rows.map((r: any) => r.id_venda).filter(Boolean);
          if (vendaIds.length > 0) {
            // Fetch via query string — one param per id to avoid long URLs
            const params = vendaIds.map((id: number) => `vendaId=${id}`).join('&');
            const vpRes = await fetch(`/api/produtos?${params}`);
            const vpData = await vpRes.json();
            // vpData is an array of { id_produto } from venda_produtos
            const existingProdIds: number[] = Array.isArray(vpData)
              ? [...new Set(vpData.map((vp: any) => vp.id_produto))]
              : [];
            setSelectedProdutos(existingProdIds);
          } else {
            setSelectedProdutos([]);
          }
        } catch {
          setSelectedProdutos([]);
        }
      }

      setSaleLead(lead);
      // Refresh gateways before opening (skipReset=true to preserve reconstructed pagamentos)
      await fetchGateways(true);
      setIsSaleModalOpen(true);
    } catch (err) {
      console.error(err);
      alert('Não foi possível abrir a venda. Tente de novo.');
    }
  };


  const handleSaveRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundLeadId) return;
    const motivo = refundMotivo.trim() || 'Sem motivo informado';
    try {
      await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_lead: refundLeadId, status_atual: 'Reembolsado', motivo_reembolso: motivo, usuario_nome: userName })
      });
      await logActivity(refundLeadId, `Reembolsado — motivo: "${motivo}"`);
      setLeads(prev => prev.map(l => l.id_lead === refundLeadId ? { ...l, status_atual: 'Reembolsado' } : l));
      marcarMovido(refundLeadId);
      rebuscarSeEmAndamento();
      setIsRefundModalOpen(false);
      setRefundLeadId(null);
      setRefundMotivo('');
    } catch (err) { console.error(err); }
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

  // data_call vem do banco em UTC; mostra no horário de Brasília
  const formatCallBr = (dStr: string | null | undefined) => dStr ? formatDateBr(dbDateToBrasiliaLocal(dStr)) : "Sem data";

  const handleDeleteLead = async () => {
    if (!editingLeadId) return;
    if (!confirm('Deseja realmente excluir permanentemente este Lead?')) return;
    try {
      const res = await fetch(`/api/leads?id=${editingLeadId}`, { method: 'DELETE' });
      if (!res.ok) { alert('Erro ao excluir lead.'); return; }
      setIsModalOpen(false);
      setLeads(prev => prev.filter(l => l.id_lead !== editingLeadId));
      rebuscarSeEmAndamento();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenDetail = async (lead: Lead) => {
    setDetailLead(lead);
    setDetailCaixaOpen(false);
    setBriefingExpanded(false);
    setIsDetailOpen(true);
    if (lead.observacoes_gerais === undefined) {
      carregarObservacoes(lead)
        .then(obs => setDetailLead(prev => prev?.id_lead === lead.id_lead ? { ...prev, observacoes_gerais: obs } : prev))
        .catch(err => console.error('Erro ao carregar observações', err));
    }
    if (lead.status_atual === 'Venda') {
      try {
        const res = await fetch(`/api/vendas?leadId=${lead.id_lead}`);
        const rows = await res.json();
        setDetailVendas(Array.isArray(rows) ? rows : []);
      } catch { setDetailVendas([]); }
    } else {
      setDetailVendas([]);
    }
  };

  const handleDetailStatusChange = async (newStatus: string) => {
    if (!detailLead) return;
    if (newStatus === 'Venda') {
      setIsDetailOpen(false);
      handleOpenEditSale({ stopPropagation: () => {} } as any, detailLead);
      return;
    }
    if (newStatus === 'Reembolsado') {
      setRefundLeadId(detailLead.id_lead);
      setRefundMotivo('');
      setIsRefundModalOpen(true);
      return;
    }
    if (newStatus === 'Remarcado') {
      abrirRemarcar(detailLead);
      return;
    }
    if (newStatus === 'Loss') {
      abrirLoss(detailLead);
      return;
    }
    setDetailStatusSaving(true);
    try {
      await fetch('/api/leads', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_lead: detailLead.id_lead, status_atual: newStatus, usuario_nome: userName }) });
      setDetailLead(prev => prev ? { ...prev, status_atual: newStatus } : prev);
      setLeads(prev => prev.map(l => l.id_lead === detailLead.id_lead ? { ...l, status_atual: newStatus } : l));
      marcarMovido(detailLead.id_lead);
      rebuscarSeEmAndamento();
      await logActivity(detailLead.id_lead, `Status alterado para "${newStatus}"`);
    } catch (err) { console.error(err); }
    finally { setDetailStatusSaving(false); }
  };

  const handleDetailDelete = async () => {
    if (!detailLead) return;
    if (!confirm('Deseja realmente excluir permanentemente este Lead?')) return;
    try {
      const res = await fetch(`/api/leads?id=${detailLead.id_lead}`, { method: 'DELETE' });
      if (!res.ok) { alert('Erro ao excluir lead.'); return; }
      setIsDetailOpen(false);
      setLeads(prev => prev.filter(l => l.id_lead !== detailLead.id_lead));
      rebuscarSeEmAndamento();
    } catch (err) { console.error(err); }
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
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Quadro de Leads</h2>
          <p className="text-sec mt-1 text-sm flex items-center gap-2">
            Arraste os cards para atualizar o status no pipeline.
            {refreshing && (
              <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={12} className="animate-spin" />
                Atualizando...
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sec pointer-events-none" size={18} />
            <input
              type="text"
              placeholder="Buscar lead..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="campo-com-icone pr-4 py-2 bg-surface border border-str rounded-xl text-white focus:outline-none w-full"
            />
          </div>
          {/* No celular a caixa ocupa a linha e as datas ficam uma embaixo da outra, com "De" e "Até":
              o iPhone escreve "27 de nov. de 2026" e lado a lado não cabia */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1 bg-surface border border-str rounded-xl px-1.5 w-full sm:w-auto">
            <label className="flex items-center min-w-0">
              <span className="sm:hidden text-xs font-bold text-muted w-9 shrink-0 pl-1.5">De</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="campo-limpo text-sm text-sec p-2 min-w-0 flex-1 sm:flex-none" title="Data Inicial" />
            </label>
            <span className="text-sec hidden sm:inline">–</span>
            <label className="flex items-center min-w-0 border-t border-str sm:border-t-0">
              <span className="sm:hidden text-xs font-bold text-muted w-9 shrink-0 pl-1.5">Até</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="campo-limpo text-sm text-sec p-2 min-w-0 flex-1 sm:flex-none" title="Data Final" />
            </label>
          </div>
          {/* ─── Export dropdown ──────────────────────────────────── */}
          {/* Botões de ação à direita; só o "Novo" fica na cor de destaque */}
          <div className="relative sm:ml-auto">
            <button
              onClick={() => setShowExportMenu(v => !v)}
              title="Opções de exportação"
              className="bg-surface border border-str text-sm rounded-xl px-3 py-2 flex items-center gap-2 whitespace-nowrap transition-colors"
              style={{ color: 'var(--text-pri)' }}
            >
              <Download size={15} style={{ color: 'var(--accent)' }} />
              <span>Exportar</span>
              <span className="text-[10px] opacity-60 ml-0.5" style={{ transform: showExportMenu ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
            </button>

            {showExportMenu && (
              <div
                className="absolute top-full left-0 mt-1 z-30 rounded-xl overflow-hidden shadow-xl border border-str"
                style={{ background: 'var(--bg-surface)', minWidth: '160px' }}
              >
                <button
                  onClick={() => { setShowExportMenu(false); handleExportCSV(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors hover:bg-white/5 text-left"
                  style={{ color: 'var(--text-pri)' }}
                >
                  <Download size={14} style={{ color: 'var(--accent)' }} />
                  Exportar CSV
                </button>
                <div style={{ height: '1px', background: 'var(--border-str)' }} />
                <button
                  onClick={() => { setShowExportMenu(false); abrirExportPersonalizado(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors hover:bg-white/5 text-left whitespace-nowrap"
                  style={{ color: 'var(--text-pri)' }}
                >
                  <SlidersHorizontal size={14} style={{ color: 'var(--accent)' }} />
                  Exportar personalizado
                </button>
              </div>
            )}
          </div>

          {/* Click-outside overlay for export menu */}
          {showExportMenu && (
            <div className="fixed inset-0 z-20" onClick={() => setShowExportMenu(false)} />
          )}
          {/* ─── Filtros: SDR, Closer, Off métricas, Pagamento e Produto num botão só ─── */}
          {(() => {
            const allFormas = Array.from(
              new Set(leads.flatMap(l => l.formas_pagamento || []))
            ).sort();
            const leadsNoQuadro = leads.filter(l =>
              (KANBAN_COLUMNS.includes(l.status_atual) || l.status_atual === 'Nao prosseguiu') && passaFiltros(l)
            ).length;
            const chip = estiloChip;
            const seletor = "appearance-none bg-app border border-str text-sm rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-[var(--accent)] w-full";
            const rotulo = "block text-[11px] font-bold uppercase tracking-wide mb-1.5";
            return (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFiltros(v => !v)}
                  aria-expanded={showFiltros}
                  aria-haspopup="dialog"
                  className="bg-surface border border-str text-sec text-sm rounded-xl px-3 py-2 flex items-center gap-2 whitespace-nowrap transition-colors"
                  style={filtrosAtivos > 0 ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
                >
                  <SlidersHorizontal size={15} />
                  <span className="font-medium">Filtros{filtrosAtivos > 0 ? ` · ${filtrosAtivos}` : ''}</span>
                  <span className="text-[10px] opacity-50" style={{ transform: showFiltros ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
                </button>

                {showFiltros && (
                  <>
                    {/* Fora do painel fecha; no celular escurece o fundo */}
                    <div className="fixed inset-0 z-20 bg-black/40 md:bg-transparent" onClick={() => setShowFiltros(false)} />
                    <div
                      role="dialog"
                      aria-label="Filtros do quadro"
                      className="fixed inset-x-3 bottom-3 z-30 md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-80 max-h-[75vh] overflow-y-auto rounded-2xl border border-str shadow-xl p-4 space-y-4"
                      style={{ background: 'var(--bg-surface)' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold" style={{ color: 'var(--text-pri)' }}>Filtros</span>
                        <button
                          type="button"
                          onClick={limparFiltros}
                          disabled={filtrosAtivos === 0}
                          className="text-xs font-bold px-2.5 py-1 rounded-lg transition-opacity disabled:opacity-40"
                          style={{ color: 'var(--text-sec)', border: '1px solid var(--border-str)', background: 'var(--bg-app)' }}
                        >
                          Limpar filtros
                        </button>
                      </div>

                      <div>
                        <label htmlFor="filtro_sdr" className={rotulo} style={{ color: 'var(--text-sec)' }}>SDR</label>
                        <div className="relative">
                          <select id="filtro_sdr" className={seletor} style={{ color: 'var(--text-pri)' }} value={filterSdr} onChange={e => setFilterSdr(e.target.value)}>
                            <option value="">Todos SDRs</option>
                            {users.filter((u: any) => u.tipo === 'SDR' || u.tipo === 'ADM').map((u: any) => (
                              <option key={u.id_usuario} value={u.id_usuario}>{u.nome}</option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] opacity-50" style={{ color: 'var(--text-sec)' }}>▼</span>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="filtro_closer" className={rotulo} style={{ color: 'var(--text-sec)' }}>Closer</label>
                        <div className="relative">
                          <select id="filtro_closer" className={seletor} style={{ color: 'var(--text-pri)' }} value={filterCloser} onChange={e => setFilterCloser(e.target.value)}>
                            <option value="">Todos Closers</option>
                            {users.filter((u: any) => u.tipo === 'CLOSER' || u.tipo === 'ADM').map((u: any) => (
                              <option key={u.id_usuario} value={u.id_usuario}>{u.nome}</option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] opacity-50" style={{ color: 'var(--text-sec)' }}>▼</span>
                        </div>
                      </div>

                      <fieldset>
                        <legend className={rotulo} style={{ color: 'var(--text-sec)' }}>Off métricas</legend>
                        <div className="grid grid-cols-3 gap-1.5">
                          {([['todos', 'Todos'], ['off', 'Só OFF'], ['metricas', 'Só nas métricas']] as const).map(([valor, texto]) => (
                            <button
                              key={valor}
                              type="button"
                              aria-pressed={filterOff === valor}
                              onClick={() => setFilterOff(valor)}
                              className="px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-150 leading-tight"
                              style={chip(filterOff === valor)}
                            >
                              {texto}
                            </button>
                          ))}
                        </div>
                      </fieldset>

                      {allFormas.length > 0 && (
                        <fieldset>
                          <legend className={rotulo} style={{ color: 'var(--text-sec)' }}>Pagamento</legend>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {allFormas.map(forma => {
                              const isActive = filterFormas.includes(forma);
                              return (
                                <button
                                  key={forma}
                                  type="button"
                                  aria-pressed={isActive}
                                  onClick={() => setFilterFormas(prev => isActive ? prev.filter(f => f !== forma) : [...prev, forma])}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-150 whitespace-nowrap"
                                  style={chip(isActive)}
                                >
                                  {forma}
                                  {isActive && <span className="ml-0.5 opacity-70 text-[10px]">✕</span>}
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>
                      )}

                      {produtos.length > 0 && (
                        <fieldset>
                          <legend className={rotulo} style={{ color: 'var(--text-sec)' }}>Produto</legend>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {produtos.map((p: any) => {
                              const isActive = filterProdutos.includes(p.id_produto);
                              return (
                                <button
                                  key={p.id_produto}
                                  type="button"
                                  aria-pressed={isActive}
                                  onClick={() => setFilterProdutos(prev => isActive ? prev.filter(id => id !== p.id_produto) : [...prev, p.id_produto])}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-150 whitespace-nowrap"
                                  style={chip(isActive)}
                                >
                                  {p.nome}
                                  {isActive && <span className="ml-0.5 opacity-70 text-[10px]">✕</span>}
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-str">
                        <span className="text-xs" style={{ color: 'var(--text-sec)' }}>{leadsNoQuadro} {leadsNoQuadro === 1 ? 'lead' : 'leads'} no quadro</span>
                        <button
                          type="button"
                          onClick={() => setShowFiltros(false)}
                          className="px-4 py-1.5 rounded-xl text-sm font-bold"
                          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

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
          const filteredLeads = leads.filter((l) =>
            (l.status_atual === col || (col === 'Loss' && l.status_atual === 'Nao prosseguiu')) && passaFiltros(l)
          );
          // Movidos nesta visita no topo (o último primeiro), para não caírem depois do limite da coluna
          const movidos = movidosAgora
            .map(id => filteredLeads.find(l => l.id_lead === id))
            .filter((l): l is Lead => !!l);
          const columnLeads = movidos.length > 0
            ? [...movidos, ...filteredLeads.filter(l => !movidosAgora.includes(l.id_lead))]
            : filteredLeads;
          const limite = limitePorColuna[col] ?? CARDS_POR_COLUNA;
          const restantes = columnLeads.length - limite;
          const copiada = colunaCopiada === col;

          return (
            <div
              key={col}
              className="kanban-col min-w-[320px] w-[320px] flex flex-col h-full"
              onDrop={(e) => handleDrop(e, col)}
              onDragOver={handleDragOver}
            >
              <div className="p-4 border-b border-[#222222] flex justify-between items-center bg-surface/80 rounded-t-xl">
                <h3 className="font-bold text-white tracking-tight">{col}</h3>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copiarNomesDaColuna(col, columnLeads.map(l => l.nome))}
                    disabled={columnLeads.length === 0}
                    title={copiada ? 'Copiado' : 'Copiar nomes'}
                    aria-label={copiada ? `Nomes de ${col} copiados` : `Copiar nomes de ${col}`}
                    className={`copiar-nomes flex items-center gap-1 h-7 px-1.5 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-30 disabled:cursor-default${copiada ? ' copiado' : ''}`}
                  >
                    {copiada ? <><Check size={14} strokeWidth={3} />Copiado</> : <Copy size={14} />}
                  </button>
                  <span className="text-xs px-2.5 py-1 rounded-full font-black" style={{ background: 'var(--accent)', color: '#0A0A0A' }}>
                    {columnLeads.length}
                  </span>
                </div>
              </div>

              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                {columnLeads.slice(0, limite).map((lead) => {
                  const followAtrasado = followSituacao(lead.data_proximo_follow, lead.status_atual) === 'atrasado';
                  return (
                  <div
                    key={lead.id_lead}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id_lead)}
                    onDragEnd={() => { arrastandoRef.current = false; }}
                    onDoubleClick={() => handleOpenDetail(lead)}
                    className={`glass-panel p-4 cursor-grab active:cursor-grabbing hover:-translate-y-1 ${followAtrasado ? '' : 'border-str'} hover:border-orange-300 transition-all select-none group relative bg-surface`}
                    style={followAtrasado ? { borderColor: 'rgba(239,68,68,0.6)', boxShadow: 'inset 3px 0 0 #ef4444' } : undefined}
                  >
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenDetail(lead); }}
                        className="text-sec hover:text-white px-2 py-1 text-xs bg-surface rounded shadow-sm border border-str"
                      >Ver</button>
                      {!['Venda', 'Loss', 'Reembolsado'].includes(lead.status_atual) && lead.status_atual !== 'Nao prosseguiu' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/calendar?leadId=${lead.id_lead}`); }}
                          className="text-sec hover:text-accent px-2 py-1 text-xs bg-surface rounded shadow-sm border border-str whitespace-nowrap"
                          title="Adicionar à agenda"
                        >📅</button>
                      )}
                    </div>
                    <div className="flex justify-between items-start mb-2 pr-12">
                      <h4 className="font-bold text-white leading-tight">{lead.nome}</h4>
                      {lead.valor_proposta && ['Venda', 'Reembolsado'].includes(lead.status_atual) && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-700 font-bold text-sm bg-emerald-100 px-2 rounded-md border border-emerald-200">
                            R$ {lead.valor_proposta}
                          </span>
                          {lead.tem_pendente && (
                            <span
                              className="w-2 h-2 rounded-full bg-orange-400 animate-pulse shrink-0"
                              title={`Pagamento pendente: R$ ${(lead.valor_pendente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 mt-3">
                      {lead.telefone && (
                        <div className="flex items-center gap-2 text-xs text-sec">
                          <Phone size={14} className="text-sec" />
                          <span>{lead.telefone}</span>
                        </div>
                      )}
                      {lead.instagram && (
                        <div className="flex items-center gap-2 text-xs text-sec">
                          <Instagram size={14} className="text-sec" />
                          <span>{lead.instagram}</span>
                        </div>
                      )}
                    </div>

                    {followAtrasado && lead.data_proximo_follow && (() => {
                      const dias = diasDeAtraso(lead.data_proximo_follow);
                      return (
                        <div
                          className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-md"
                          style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}
                        >
                          <BellRing size={11} />
                          Follow atrasado há {dias} dia{dias > 1 ? 's' : ''}
                        </div>
                      );
                    })()}

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

                      <div className="flex items-center gap-1.5">
                        {lead.off_metricas && (
                          <span
                            className="text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-wide"
                            // Cores do tema: o cinza fixo de antes sumia no card escuro
                            style={{ background: 'var(--bg-surface-3)', color: 'var(--text-pri)', border: '1px dashed var(--text-sec)' }}
                            title="Fora das métricas comerciais"
                          >
                            ⊘ OFF
                          </span>
                        )}
                        {/* Uma data só: a da call; sem call, a de entrada (a de entrada fica no detalhe).
                            Remarcado sem nova data: selo "Data a definir" no lugar da data */}
                        {callADefinir(lead) ? (
                          <div
                            className="selo-a-definir inline-flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-md"
                            title={lead.data_call ? `Call anterior: ${formatCallBr(lead.data_call)}` : 'Sem data da próxima call'}
                          >
                            <CalendarClock size={11} />
                            Data a definir
                          </div>
                        ) : lead.data_call ? (
                          <div
                            className="flex items-center gap-1 text-[10px] font-bold"
                            style={{ color: ['Venda', 'Loss', 'Reembolsado', 'Nao prosseguiu'].includes(lead.status_atual) ? 'var(--text-sec)' : '#f59e0b' }}
                            title="Data da call"
                          >
                            <CalendarClock size={12} />
                            <span>{formatCallBr(lead.data_call)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-sec font-medium" title="Data de entrada">
                            <Clock size={12} />
                            <span>{formatDateBr(lead.data_entrada)}</span>
                          </div>
                        )}
                      </div>

                      {lead.status_atual === 'Venda' && (
                        <button
                          onClick={(e) => handleOpenEditSale(e, lead)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-orange-400 hover:text-white border border-orange-400/40 px-2 py-0.5 rounded bg-surface"
                        >Editar Venda</button>
                      )}
                    </div>
                  </div>
                  );
                })}

                {restantes > 0 && (
                  <div className="pt-1 pb-2 flex flex-col items-center gap-1.5">
                    <button
                      onClick={() => setLimitePorColuna(prev => ({ ...prev, [col]: limite + CARDS_POR_COLUNA }))}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border border-str bg-surface text-sec hover:text-white transition-colors"
                    >
                      <ChevronDown size={14} />
                      Ver mais {Math.min(CARDS_POR_COLUNA, restantes)}
                    </button>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      Mostrando {limite} de {columnLeads.length}
                    </span>
                  </div>
                )}

                {columnLeads.length === 0 && (
                  <div className="h-24 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-sec text-sm font-medium">
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
          <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4 md:p-6 relative bg-surface rounded-t-2xl md:rounded-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">{editingLeadId ? "Editar Lead" : "Adicionar Novo Lead"}</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-sec hover:text-white"
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
                    className="w-full bg-surface border border-str"
                    value={formData.data_entrada}
                    onChange={(e) => setFormData({ ...formData, data_entrada: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Data da Call</label>
                  <input
                    type="datetime-local"
                    className="w-full bg-surface border border-str"
                    value={formData.data_call}
                    onChange={(e) => setFormData({ ...formData, data_call: e.target.value })}
                  />
                  {(() => {
                    const leadEditado = editingLeadId !== null ? leads.find(l => l.id_lead === editingLeadId) : undefined;
                    if (!leadEditado || !callADefinir(leadEditado)) return null;
                    return (
                      <p className="text-xs mt-1.5" style={{ color: '#d97706' }}>
                        Data a definir{leadEditado.data_call ? ` · call anterior em ${formatCallBr(leadEditado.data_call)}` : ''}. Preencha quando tiver a nova data.
                      </p>
                    );
                  })()}
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
                    className="w-full bg-surface border border-str"
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
                    className="w-full bg-surface border border-str"
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
                    className="w-full bg-surface border border-str"
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

              {/* Off Métricas toggle */}
              <button
                type="button"
                onClick={() => setOffMetricas(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 text-left"
                style={{
                  background: offMetricas ? 'rgba(245,158,11,0.08)' : 'var(--bg-surface)',
                  borderColor: offMetricas ? '#f59e0b' : 'var(--border-str)',
                }}
              >
                <div>
                  <p className="text-sm font-bold" style={{ color: offMetricas ? '#f59e0b' : 'var(--text-sec)' }}>
                    ⊘ Off Métricas
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-sec)' }}>
                    {offMetricas
                      ? 'Ativado — fora da conversão, funil e ranking do time'
                      : 'Desativado — lead entra nas métricas normalmente'}
                  </p>
                </div>
                <div
                  className="w-10 h-5 rounded-full flex items-center transition-all duration-200 shrink-0 ml-4"
                  style={{ background: offMetricas ? '#f59e0b' : '#333', padding: '2px' }}
                >
                  <div
                    className="w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200"
                    style={{ transform: offMetricas ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </div>
              </button>

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
                    className="flex-1 md:flex-none px-4 py-2 text-sec hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingLead}
                    className="flex-1 md:flex-none btn-primary justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSavingLead ? "Salvando..." : (editingLeadId ? "Salvar" : "Criar Lead")}
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
          <div className="modal-surface glass-panel w-full max-w-lg p-4 md:p-6 relative border border-orange-400/30 shadow-[0_0_60px_rgba(249,115,22,0.12)] rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-5">
              <div>
                <h3 className="text-xl font-bold text-white">Registrar Venda para {saleLead.nome}</h3>
                <p className="text-sm text-sec mt-1">Adicione uma ou mais formas de pagamento para compor o valor total da venda.</p>
              </div>
              <button onClick={() => setIsSaleModalOpen(false)} className="text-sec hover:text-white text-xl ml-4 mt-1">✕</button>
            </div>

            <form onSubmit={handleSaveSale} className="space-y-4">
              {/* Data da Venda */}
              <div>
                <label className="block text-xs text-sec mb-1 font-bold uppercase">Data da Venda</label>
                <input type="date" required value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="w-full sm:w-1/2 bg-surface border border-str text-white rounded-xl p-2 text-sm focus:border-orange-500 focus:outline-none" />
              </div>

              {/* Produtos */}
              {produtos.length > 0 && (
                <div>
                  <label className="block text-xs text-sec mb-2 font-bold uppercase">Produtos Vendidos</label>
                  <div className="flex flex-wrap gap-2">
                    {produtos.map((p: any) => {
                      const selected = selectedProdutos.includes(p.id_produto);
                      return (
                        <button
                          key={p.id_produto}
                          type="button"
                          onClick={() => setSelectedProdutos(prev =>
                            selected ? prev.filter(id => id !== p.id_produto) : [...prev, p.id_produto]
                          )}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                          style={{
                            background: selected ? 'rgba(var(--accent-rgb), 0.15)' : 'var(--bg-app)',
                            borderColor: selected ? 'var(--accent)' : 'var(--border-str)',
                            color: selected ? 'var(--accent)' : 'var(--text-sec)',
                          }}
                        >
                          {selected ? '✓ ' : ''}{p.nome}
                        </button>
                      );
                    })}
                  </div>
                  {selectedProdutos.length === 0 && (
                    <p className="text-[10px] text-sec mt-1 opacity-60">Nenhum produto selecionado (opcional)</p>
                  )}
                </div>
              )}

              {/* Payment Rows */}
              <div className="space-y-3">
                {pagamentos.map((p, idx) => (
                  <div key={p.id} className="p-3 rounded-xl border border-str bg-surface space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-sec">Pagamento {idx + 1}</span>
                      {pagamentos.length > 1 && (
                        <button type="button" onClick={() => removePagamento(p.id)} className="text-red-500 hover:text-red-400 text-lg leading-none">🗑</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-sec mb-1">Forma de Pagamento</label>
                        <select
                          required
                          className="w-full bg-app border border-str text-white rounded-lg p-2 text-sm focus:border-orange-500 focus:outline-none"
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
                        <label className="block text-xs text-sec mb-1">Valor Total do Pagamento</label>
                        <div className="flex items-center gap-1 bg-app border border-str rounded-lg px-2 overflow-hidden">
                          <span className="text-sec text-sm shrink-0">R$</span>
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
                        <label className="block text-xs text-sec mb-1">Parcelas</label>
                        <select
                          className="w-full bg-app border border-str text-white rounded-lg p-2 text-sm focus:border-orange-500 focus:outline-none"
                          value={p.numero_parcelas}
                          onChange={e => handlePagamentoChange(p.id, 'numero_parcelas', e.target.value)}
                        >
                          {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1}x</option>)}
                        </select>
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs text-sec mb-1">Taxa Gateway (R$)</label>
                        <div className="flex items-center gap-1 bg-app border border-str rounded-lg px-2 overflow-hidden">
                          <span className="text-sec text-sm shrink-0">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            readOnly
                            tabIndex={-1}
                            className="min-w-0 w-full bg-transparent border-none text-sec text-sm py-2 focus:outline-none cursor-not-allowed"
                            value={parseFloat(p.taxa_gateway) > parseFloat(p.valor) ? (parseFloat(p.valor) || 0).toFixed(2) : p.taxa_gateway}
                            title="Calculado automaticamente com base na taxa do gateway"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Entrada field — shown only when gateway accepts down payment */}
                    {gateways.find(gw => gw.nome === p.forma_pagamento)?.tem_entrada && (
                      <div className="pt-3 border-t border-str">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">Entrada</span>
                          <span className="text-xs text-sec">Valor pago na entrada (à vista)</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 bg-app border border-blue-400/30 rounded-lg px-2 overflow-hidden">
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
                            <p className="text-xs text-sec mt-1">
                              Restante a parcelar: <span className="text-white font-medium">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, parseFloat(p.valor) - parseFloat(p.valor_entrada)))}
                              </span> em {p.numero_parcelas}x
                            </p>
                          )}
                          {/* Entrada paga pela empresa toggle */}
                          {p.valor_entrada && parseFloat(p.valor_entrada) > 0 && (
                            <label className="flex items-center gap-2 mt-3 cursor-pointer select-none group">
                              <div
                                onClick={() => handlePagamentoChange(p.id, 'entrada_paga_empresa', !p.entrada_paga_empresa as any)}
                                className={`relative w-9 h-5 rounded-full transition-colors ${p.entrada_paga_empresa ? 'bg-orange-500' : 'bg-surface-3'}`}
                              >
                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${p.entrada_paga_empresa ? 'translate-x-4' : 'translate-x-0'}`} />
                              </div>
                              <div>
                                <span className="text-xs font-medium text-white">Entrada paga pela empresa</span>
                                <p className="text-[10px] text-sec mt-0.5">A empresa financia a entrada — valor será <span className="text-orange-400">descontado</span> do caixa</p>
                              </div>
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Status do Pagamento — Pago / Pendente */}
                    <div className="pt-3 border-t border-str mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-sec">Status do recebimento:</span>
                        <div className="flex rounded-lg overflow-hidden border border-str text-xs">
                          <button
                            type="button"
                            onClick={() => handlePagamentoChange(p.id, 'status_pagamento', 'pago')}
                            className={`px-3 py-1 font-semibold transition-colors ${p.status_pagamento === 'pago' ? 'bg-accent text-[#0A0A0A]' : 'bg-app text-sec hover:text-white'}`}
                          >&#10003; Pago</button>
                          <button
                            type="button"
                            onClick={() => handlePagamentoChange(p.id, 'status_pagamento', 'pendente')}
                            className={`px-3 py-1 font-semibold transition-colors ${p.status_pagamento === 'pendente' ? 'bg-amber-500 text-[#0A0A0A]' : 'bg-app text-sec hover:text-white'}`}
                          >&#9203; Pendente</button>
                        </div>
                      </div>

                      {/* Pago — data real de recebimento, nunca futura (dinheiro que ainda vai entrar é Pendente) */}
                      {p.status_pagamento === 'pago' && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-[10px] text-sec">Data de recebimento:</span>
                          <input
                            type="date"
                            max={todayBrasilia()}
                            className="bg-app border border-emerald-500/40 text-emerald-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-400"
                            value={p.data_recebimento_custom}
                            onChange={e => handlePagamentoChange(p.id, 'data_recebimento_custom', e.target.value)}
                          />
                          <span className="text-[10px] text-emerald-400/70">dia em que o dinheiro entrou</span>
                        </div>
                      )}

                      {/* Pendente — data prevista (nao entra no caixa) */}
                      {p.status_pagamento === 'pendente' && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-[10px] text-sec">Previsao de recebimento:</span>
                          <input
                            type="date"
                            className="bg-app border border-amber-500/40 text-amber-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400"
                            value={p.data_recebimento_custom}
                            min={(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })()}
                            onChange={e => handlePagamentoChange(p.id, 'data_recebimento_custom', e.target.value)}
                          />
                          <span className="text-[10px] text-amber-400/70">nao entra no caixa ainda</span>
                        </div>
                      )}
                    </div>
                  </div>

                ))}
              </div>

              {/* Add Payment Button */}
              <button
                type="button"
                onClick={addPagamento}
                className="w-full py-2.5 rounded-xl border border-dashed border-[#3A3A3A] text-sec hover:text-white hover:border-orange-400 transition text-sm flex items-center justify-center gap-2"
              >
                <span className="text-lg">⊕</span> Adicionar Pagamento
              </button>

              {/* Observacoes */}
              <div>
                <label className="block text-sm font-medium text-sec mb-1">Observações sobre a Venda</label>
                <textarea
                  rows={3}
                  placeholder="Ex: Cliente pediu desconto, condição especial de pagamento..."
                  className="w-full bg-app border border-str text-white rounded-xl p-3 text-sm focus:border-orange-400 focus:outline-none resize-none"
                  value={saleObservacoes}
                  onChange={e => setSaleObservacoes(e.target.value)}
                />
              </div>

              {/* Totals */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-surface border border-str">
                  <div className="flex items-center gap-2 text-xs text-sec mb-1">
                    <span>💳</span> Valor Total da Venda
                  </div>
                  <div className="text-base font-black text-white">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saleTotals.bruto)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-str">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-xs text-sec">
                      <span>💵</span> Caixa Gerado (Líquido)
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCaixaBreakdown(v => !v)}
                      title="Ver cálculo detalhado"
                      className="w-4 h-4 rounded-full bg-surface-3 text-sec hover:bg-orange-400/20 hover:text-orange-400 flex items-center justify-center text-[9px] font-black transition-colors"
                    >?</button>
                  </div>
                  <div className="text-base font-black text-orange-400">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saleTotals.liquido)}
                  </div>
                </div>
              </div>

              {/* Caixa Breakdown Panel */}
              {showCaixaBreakdown && (
                <div className="rounded-xl bg-app border border-orange-400/20 p-4 text-sm space-y-3">
                  <div className="mb-2">
                    <p className="font-bold text-white text-sm">Cálculo do Caixa Gerado</p>
                    <p className="text-sec text-xs mt-0.5">Demonstrativo de como o valor líquido foi calculado.</p>
                  </div>
                  {pagamentos.map((p, idx) => {
                    const v = parseFloat(p.valor) || 0;
                    const taxaTotal = parseFloat(p.taxa_gateway) || 0;
                    const taxaEnt = parseFloat(p.taxa_entrada) || 0;
                    const entrada = parseFloat(p.valor_entrada) || 0;
                    const parcelas = parseInt(p.numero_parcelas) || 1;
                    const gw = gateways.find((g: any) => g.nome === p.forma_pagamento);
                    const taxaPct = gw?.taxa_percentual || 0;
                    const taxaFixed = gw?.taxa_fixa || 0;
                    const txPEntrada = gw?.taxa_entrada_percentual || 0;
                    const txFEntrada = gw?.taxa_entrada_fixa || 0;
                    const temEntrada = entrada > 0;
                    const isEmpresa = p.entrada_paga_empresa;
                    const subtotal = v - taxaTotal - (isEmpresa ? entrada : 0);
                    const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
                    return (
                      <div key={p.id} className="pb-3 border-b border-white/5 last:border-0">
                        <p className="text-[10px] font-bold text-orange-300 uppercase tracking-wider mb-2">{p.forma_pagamento}{parcelas > 1 ? ` (${parcelas}x)` : ''}</p>
                        <div className="space-y-1">
                          {temEntrada ? (
                            <>
                              {isEmpresa && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-sec">(-) Entrada Paga pela Empresa</span>
                                  <span className="text-red-400">-{fmt(entrada)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-xs">
                                <span className="text-sec">(+) Valor Bruto da Entrada</span>
                                <span className="text-[#bbb]">{fmt(entrada)}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-sec">(-) Taxa da Entrada ({txPEntrada > 0 || txFEntrada > 0 ? `${txPEntrada.toFixed(2)}%${txFEntrada > 0 ? ` + R$${txFEntrada}` : ''}` : '0%'})</span>
                                <span className="text-red-400">-{fmt(taxaEnt)}</span>
                              </div>
                              <div className="pt-2"></div>
                              <div className="flex justify-between text-xs">
                                <span className="text-sec">(+) {parcelas > 1 ? 'Valor Bruto Parcelado' : 'Parcela Única Bruta'}</span>
                                <span className="text-[#bbb]">{fmt(v - entrada)}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-sec">(-) Taxa ({taxaPct > 0 || taxaFixed > 0 ? `${taxaPct.toFixed(2)}%${taxaFixed > 0 ? ` + R$${taxaFixed}` : ''}` : '0%'})</span>
                                <span className="text-red-400">-{fmt(taxaTotal - taxaEnt)}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between text-xs">
                                <span className="text-sec">(+) {parcelas > 1 ? 'Valor Bruto Parcelado' : 'Parcela Única Bruta'}</span>
                                <span className="text-[#bbb]">{fmt(v)}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-sec">(-) Taxa ({taxaPct > 0 || taxaFixed > 0 ? `${taxaPct.toFixed(2)}%${taxaFixed > 0 ? ` + R$${taxaFixed}` : ''}` : '0%'})</span>
                                <span className="text-red-400">-{fmt(taxaTotal)}</span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between text-xs font-bold pt-1 border-t border-white/5">
                            <span className="text-white">Subtotal</span>
                            <span className={subtotal < 0 ? 'text-red-400' : 'text-orange-300'}>{fmt(subtotal)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between font-black text-sm pt-1">
                    <span className="text-white">Total Caixa Gerado</span>
                    <span className="text-orange-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saleTotals.liquido)}</span>
                  </div>
                </div>
              )}

              {/* ── Comprovante de Pagamento ─────────────────────── */}
              <div>
                <label className="block text-xs text-sec mb-2 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip size={11} />
                  Comprovante de Pagamento
                  <span className="text-[10px] font-normal opacity-50 normal-case tracking-normal">(opcional)</span>
                </label>

                {comprovantePreview ? (
                  // Preview da imagem selecionada
                  <div className="relative rounded-xl overflow-hidden border border-orange-400/30 group">
                    <img
                      src={comprovantePreview}
                      alt="Preview do comprovante"
                      className="w-full max-h-48 object-contain bg-black/40"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => { setComprovanteFile(null); setComprovantePreview(null); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background: 'rgba(239,68,68,0.85)', color: '#fff' }}
                      >
                        <X size={12} /> Remover
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-md" style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--text-sec)' }}>
                      {comprovanteFile?.name}
                    </div>
                  </div>
                ) : (
                  // Zona de drop
                  <label
                    className="flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 py-6"
                    style={{
                      borderColor: isDraggingOver ? 'var(--accent)' : 'var(--border-str)',
                      background: isDraggingOver ? 'rgba(var(--accent-rgb),0.06)' : 'var(--bg-surface)',
                    }}
                    onDragOver={ev => { ev.preventDefault(); setIsDraggingOver(true); }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={ev => {
                      ev.preventDefault();
                      setIsDraggingOver(false);
                      const file = ev.dataTransfer.files?.[0];
                      if (file && file.type.startsWith('image/')) {
                        setComprovanteFile(file);
                        setComprovantePreview(URL.createObjectURL(file));
                      }
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={ev => {
                        const file = ev.target.files?.[0];
                        if (file) {
                          setComprovanteFile(file);
                          setComprovantePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(var(--accent-rgb),0.1)' }}>
                      <ImageIcon size={20} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-pri)' }}>Clique ou arraste a imagem</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-sec)' }}>PNG, JPG, WEBP — até 5MB</p>
                    </div>
                  </label>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-str">
                <button type="button" onClick={() => { setIsSaleModalOpen(false); setComprovanteFile(null); setComprovantePreview(null); }} className="px-4 py-2 text-sec hover:text-white transition-colors text-sm">
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

      {/* Refund reason modal */}
      {isRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="modal-surface glass-panel w-full max-w-md p-6 border border-red-400/30 rounded-2xl shadow-[0_0_60px_rgba(239,68,68,0.12)]">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h3 className="text-xl font-bold text-white">Registrar Reembolso</h3>
                <p className="text-sm text-sec mt-1">Informe o motivo para o registro histórico.</p>
              </div>
              <button onClick={() => setIsRefundModalOpen(false)} className="text-sec hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={handleSaveRefund} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-sec mb-1">Motivo do Reembolso</label>
                <textarea
                  rows={4}
                  required
                  autoFocus
                  placeholder="Ex: Cliente desistiu por problema financeiro, produto não atendeu expectativas..."
                  className="w-full bg-app border border-str text-white rounded-xl p-3 text-sm focus:border-red-400 focus:outline-none resize-none"
                  value={refundMotivo}
                  onChange={e => setRefundMotivo(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-[#222]">
                <button type="button" onClick={() => setIsRefundModalOpen(false)} className="px-4 py-2 text-sec hover:text-white text-sm">Cancelar</button>
                <button type="submit" className="px-6 py-2 rounded-xl font-bold text-sm" style={{ background: '#ef4444', color: '#fff' }}>Confirmar Reembolso</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remarcar: nova data da call */}
      {remarcarLead && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="modal-surface glass-panel w-full max-w-md p-6 border border-amber-400/30 rounded-2xl shadow-[0_0_60px_rgba(245,158,11,0.12)]">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h3 className="text-xl font-bold text-white">Remarcar call</h3>
                <p className="text-sm text-sec mt-1">{remarcarLead.nome}</p>
              </div>
              <button onClick={() => setRemarcarLead(null)} className="text-sec hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={handleSaveRemarcar} className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-sec"><Clock size={14}/> Data de entrada</span>
                <span className="text-white font-medium">{formatDateBr(remarcarLead.data_entrada)} <span className="text-sec font-normal">(não muda)</span></span>
              </div>
              {remarcarLead.data_call && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-sec"><CalendarClock size={14}/> Call anterior</span>
                  <span className="text-white font-medium">{formatCallBr(remarcarLead.data_call)}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-sec mb-1">Nova data da call</label>
                <input
                  type="datetime-local"
                  required
                  autoFocus
                  className="w-full bg-app border border-str text-white rounded-xl p-3 text-sm focus:border-amber-400 focus:outline-none"
                  value={remarcarData}
                  onChange={e => setRemarcarData(e.target.value)}
                />
              </div>
              <p className="text-xs text-sec">
                Ainda sem data? Use <b>A definir</b>: o lead vai para Remarcado com o selo &quot;Data a definir&quot;{remarcarLead.data_call ? ' e a call anterior fica guardada' : ''}.
              </p>
              <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-[#222]">
                <button type="button" onClick={() => setRemarcarLead(null)} className="px-4 py-2 text-sec hover:text-white text-sm">Cancelar</button>
                <button
                  type="button"
                  onClick={handleRemarcarADefinir}
                  disabled={remarcarSalvando}
                  className="selo-a-definir px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-60"
                >
                  A definir
                </button>
                <button type="submit" disabled={remarcarSalvando} className="px-6 py-2 rounded-xl font-bold text-sm disabled:opacity-60" style={{ background: '#f59e0b', color: '#000' }}>
                  {remarcarSalvando ? 'Salvando...' : 'Remarcar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loss: motivo obrigatório (lista fixa + detalhe) */}
      {lossLead && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="modal-surface glass-panel w-full max-w-md p-6 border border-red-500/30 rounded-2xl shadow-[0_0_60px_rgba(220,38,38,0.12)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h3 className="text-xl font-bold text-white">Motivo do Loss</h3>
                <p className="text-sm text-sec mt-1">{lossLead.nome}</p>
              </div>
              <button type="button" onClick={() => setLossLead(null)} className="text-sec hover:text-white text-xl" aria-label="Cancelar">✕</button>
            </div>
            <form onSubmit={handleSaveLoss} className="space-y-4">
              <fieldset>
                <legend className="block text-sm font-medium text-sec mb-2">Por que a venda não aconteceu?</legend>
                <div className="space-y-2">
                  {MOTIVOS_LOSS.map(motivo => (
                    <label
                      key={motivo}
                      className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition"
                      style={{
                        borderColor: lossMotivo === motivo ? '#dc2626' : 'var(--border-str, rgba(255,255,255,0.1))',
                        background: lossMotivo === motivo ? 'rgba(220,38,38,0.10)' : 'transparent',
                      }}
                    >
                      <input
                        type="radio"
                        name="motivo_loss"
                        value={motivo}
                        required
                        checked={lossMotivo === motivo}
                        onChange={() => setLossMotivo(motivo)}
                        className="accent-red-600"
                      />
                      <span className="text-white">{motivo}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="detalhe_loss" className="block text-sm font-medium text-sec mb-1">
                  Detalhe {lossMotivo === MOTIVO_LOSS_OUTRO ? <span className="text-red-400">(obrigatório)</span> : <span className="font-normal">(opcional)</span>}
                </label>
                <textarea
                  id="detalhe_loss"
                  rows={3}
                  required={lossMotivo === MOTIVO_LOSS_OUTRO}
                  placeholder="O que o lead disse, objeção, contexto..."
                  className="w-full bg-app border border-str text-white rounded-xl p-3 text-sm focus:border-red-500 focus:outline-none resize-none"
                  value={lossDetalhe}
                  onChange={e => setLossDetalhe(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-[#222]">
                <button type="button" onClick={() => setLossLead(null)} className="px-4 py-2 text-sec hover:text-white text-sm">Cancelar</button>
                <button type="submit" disabled={lossSalvando} className="px-6 py-2 rounded-xl font-bold text-sm disabled:opacity-60" style={{ background: '#dc2626', color: '#fff' }}>
                  {lossSalvando ? 'Salvando...' : 'Mover para Loss'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Lead Detail Panel ───────────────────────────────────── */}
      {isDetailOpen && detailLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsDetailOpen(false)}>
          <div className="modal-surface relative w-full max-w-sm border border-str rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between p-5 pb-4 border-b border-str">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-black font-black text-lg shrink-0">
                  {detailLead.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-black text-white text-base leading-tight">{detailLead.nome}</h3>
                  <p className="text-sec text-xs mt-0.5">Detalhes do Lead</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setIsDetailOpen(false); handleOpenEdit(detailLead); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-white border border-[#333] transition"
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  Editar Lead
                </button>
                <button onClick={() => setIsDetailOpen(false)} className="text-muted hover:text-white text-lg leading-none">✕</button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
            {/* Info rows */}
            <div className="p-5 space-y-3 border-b border-str">
              {detailLead.telefone && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sec text-sm"><Phone size={14}/> Telefone</div>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">{detailLead.telefone}</span>
                    <button onClick={() => navigator.clipboard.writeText(detailLead.telefone)} className="text-muted hover:text-white transition" title="Copiar">
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    </button>
                    <a href={`https://wa.me/55${detailLead.telefone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-green-500 hover:text-green-400 transition" title="WhatsApp">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.15.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.57-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </a>
                  </div>
                </div>
              )}
              {detailLead.instagram && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sec text-sm"><Instagram size={14}/> Instagram</div>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">@{detailLead.instagram.replace('@','')}</span>
                    <button onClick={() => navigator.clipboard.writeText(detailLead.instagram)} className="text-muted hover:text-white transition" title="Copiar">
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    </button>
                    <a href={`https://instagram.com/${detailLead.instagram.replace('@','')}`} target="_blank" rel="noreferrer" className="text-pink-500 hover:text-pink-400 transition" title="Instagram">
                      <Instagram size={14}/>
                    </a>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sec text-sm"><Clock size={14}/> Entrada</div>
                <span className="text-white text-sm font-medium">{formatDateBr(detailLead.data_entrada)}</span>
              </div>
              {callADefinir(detailLead) ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sec text-sm"><CalendarClock size={14}/> Call</div>
                    <span
                      className="selo-a-definir inline-flex items-center gap-1.5 text-[11px] font-black px-2 py-1 rounded-md"
                    >
                      Data a definir
                    </span>
                  </div>
                  {detailLead.data_call && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sec text-sm"><CalendarClock size={14}/> Call anterior</div>
                      <span className="text-sm font-medium text-sec">{formatCallBr(detailLead.data_call)}</span>
                    </div>
                  )}
                </>
              ) : detailLead.data_call && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sec text-sm"><CalendarClock size={14}/> Call</div>
                  <span className="text-sm font-bold" style={{ color: '#f59e0b' }}>{formatCallBr(detailLead.data_call)}</span>
                </div>
              )}
              {detailLead.status_atual === 'Loss' && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sec text-sm shrink-0"><X size={14}/> Motivo do Loss</div>
                    <span className="text-sm font-bold text-right" style={{ color: detailLead.motivo_loss ? '#f87171' : 'var(--text-sec)' }}>
                      {detailLead.motivo_loss || 'Não informado'}
                    </span>
                  </div>
                  {detailLead.detalhe_loss && (
                    <p className="text-white text-sm mt-2 whitespace-pre-wrap break-words">{detailLead.detalhe_loss}</p>
                  )}
                  {detailLead.data_loss && (
                    <p className="text-sec text-xs mt-1.5">
                      {[users.find(u => u.id_usuario === detailLead.id_usuario_loss)?.nome, formatCallBr(detailLead.data_loss)].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              )}
              {detailLead.closer_nome && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sec text-sm">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    Closer
                  </div>
                  <span className="text-white font-bold text-sm uppercase">{detailLead.closer_nome}</span>
                </div>
              )}
              {detailLead.sdr_nome && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sec text-sm">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                    SDR
                  </div>
                  <span className="text-white font-bold text-sm uppercase">{detailLead.sdr_nome}</span>
                </div>
              )}
            </div>

            {/* Briefing */}
            {detailLead.observacoes_gerais === undefined && (
              <div className="px-5 py-3 border-b border-str flex items-center gap-2 text-xs text-sec">
                <Loader2 size={12} className="animate-spin" /> Carregando briefing...
              </div>
            )}
            {detailLead.observacoes_gerais && (
              <div className="px-5 py-4 border-b border-str">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sec text-sm">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    Briefing
                  </div>
                  <button
                    onClick={() => setBriefingExpanded(v => !v)}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-sec hover:text-white border border-[#333] transition flex items-center gap-1"
                  >
                    {briefingExpanded ? 'Recolher' : 'Expandir'}
                    <svg className={`w-2.5 h-2.5 transition-transform ${briefingExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                  </button>
                </div>
                <p className={`text-[#aaa] text-xs leading-relaxed whitespace-pre-line ${briefingExpanded ? '' : 'line-clamp-4'}`}>
                  {detailLead.observacoes_gerais}
                </p>
              </div>
            )}

            {/* Venda info */}
            {detailLead.status_atual === 'Venda' && (
              <div className="px-5 py-4 border-b border-str">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sec text-sm">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    Informações da Venda
                  </div>
                  <button
                    onClick={() => { setIsDetailOpen(false); handleOpenEditSale({ stopPropagation: () => {} } as any, detailLead); }}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-[#aaa] hover:text-white border border-[#333] transition"
                  >
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    Editar
                  </button>
                </div>
                {(() => {
                  const totalBruto = detailVendas.reduce((s, v) => s + (parseFloat(v.valor_bruto) || 0), 0);
                  const totalLiquido = detailVendas.reduce((s, v) => s + (parseFloat(v.valor_liquido_caixa) || 0), 0);
                  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
                  return (
                    <div className="bg-app rounded-xl border border-[#222] overflow-hidden">
                      <div className="flex justify-between items-center px-4 py-2.5 border-b border-[#222]">
                        <span className="text-sec text-xs font-medium">Valor Total da Venda</span>
                        <span className="text-accent font-black text-sm">{fmt(totalBruto)}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sec text-xs font-medium">Caixa Gerado</span>
                          <button onClick={() => setDetailCaixaOpen(v => !v)} className="w-4 h-4 rounded-full bg-surface-2 text-sec hover:text-orange-400 hover:bg-orange-400/10 text-[9px] font-black flex items-center justify-center transition">?</button>
                        </div>
                        <span className="text-orange-400 font-black text-sm">{fmt(totalLiquido)}</span>
                      </div>
                      {detailCaixaOpen && (
                        <div className="px-4 pb-3 border-t border-[#222] space-y-2 pt-3">
                          {detailVendas.map((v, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-sec">{v.forma_pagamento}</span>
                              <div className="text-right">
                                <span className="text-orange-300">{fmt(parseFloat(v.valor_liquido_caixa) || 0)}</span>
                                <span className="text-muted ml-1">(-{fmt(parseFloat(v.taxa_gateway) || 0)} taxa)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Comprovante thumbnail */}
                {detailVendas.some(v => v.comprovante_url) && (() => {
                  const url = detailVendas.find(v => v.comprovante_url)?.comprovante_url;
                  return (
                    <div className="rounded-xl overflow-hidden border border-str mt-4">
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#222]">
                        <Paperclip size={13} style={{ color: 'var(--accent)' }} />
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-sec)' }}>Comprovante</span>
                      </div>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="block group relative">
                        <img
                          src={url}
                          alt="Comprovante de pagamento"
                          className="w-full max-h-52 object-contain bg-black/40 transition-opacity group-hover:opacity-80"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
                            Abrir em tela cheia ↗
                          </span>
                        </div>
                      </a>
                    </div>
                  );
                })()}
              </div>
            )}

            </div>{/* end scrollable content */}

            {/* Footer: status + actions */}
            <div className="p-5 flex items-center gap-3 border-t border-str shrink-0">
              <select
                value={detailLead.status_atual}
                onChange={e => handleDetailStatusChange(e.target.value)}
                disabled={detailStatusSaving}
                className="flex-1 bg-surface border border-str text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-accent"
              >
                {KANBAN_COLUMNS.map(col => <option key={col} value={col}>{col === 'Loss' ? 'Loss' : col}</option>)}
              </select>
              <button onClick={handleDetailDelete} className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-red-900/20 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition" title="Excluir Lead">
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
              <button onClick={() => setIsDetailOpen(false)} className="px-4 h-9 rounded-xl bg-surface hover:bg-surface-2 text-white border border-str text-sm font-medium transition">Fechar</button>
            </div>
          </div>
        </div>
      )}


      {/* ─── Exportar personalizado: filtros próprios, sem mexer nos do quadro ─── */}
      {showExportCustom && (() => {
        const f = expFiltros;
        const alterar = (parcial: Partial<FiltrosExport>) => setExpFiltros(prev => ({ ...prev, ...parcial }));
        const alternar = <T,>(lista: T[], valor: T) => lista.includes(valor) ? lista.filter(v => v !== valor) : [...lista, valor];
        // Pelo tipo e por quem aparece nos leads do período (há admin como closer)
        const sdrsNosLeads = new Set((expBase || []).map(l => l.id_sdr_responsavel));
        const closersNosLeads = new Set((expBase || []).map(l => l.id_closer_responsavel));
        const usuarios = users as { id_usuario: number; nome: string; tipo: string }[];
        const sdrs = usuarios.filter(u => u.tipo === 'SDR' || sdrsNosLeads.has(u.id_usuario));
        const closers = usuarios.filter(u => u.tipo === 'CLOSER' || closersNosLeads.has(u.id_usuario));
        const formas = Array.from(new Set((expBase || []).flatMap(l => l.formas_pagamento || []))).sort();
        const total = expSelecionados.length;
        const podeBaixar = !!expBase && total > 0 && f.colunas.length > 0 && !expBaixando;
        const rotulo = "block text-[11px] font-bold uppercase tracking-wide mb-1.5";
        const chipCls = "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-150 whitespace-nowrap";
        // Atualiza a partir do valor mais recente: dois cliques seguidos não se sobrescrevem
        const grupoChips = (titulo: string, campo: 'sdrs' | 'closers' | 'status' | 'produtos' | 'formas' | 'motivos', opcoes: { valor: string | number; texto: string }[]) => {
          const escolhidos = f[campo] as (string | number)[];
          return (
          <fieldset>
            <legend className={rotulo} style={{ color: 'var(--text-sec)' }}>
              {titulo}{escolhidos.length > 0 ? ` · ${escolhidos.length}` : ''}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {opcoes.map(o => {
                const ativo = escolhidos.includes(o.valor);
                return (
                  <button key={String(o.valor)} type="button" aria-pressed={ativo} onClick={() => setExpFiltros(prev => ({ ...prev, [campo]: alternar(prev[campo] as (string | number)[], o.valor) }))} className={chipCls} style={estiloChip(ativo)}>
                    {o.texto}
                  </button>
                );
              })}
            </div>
          </fieldset>
          );
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/70 backdrop-blur-md p-3 sm:p-4"
            onClick={() => setShowExportCustom(false)}
          >
            <div
              role="dialog"
              aria-label="Exportar personalizado"
              className="modal-surface glass-panel w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl border border-str shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-str">
                <div>
                  <h3 className="text-lg font-bold text-white">Exportar personalizado</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-sec)' }}>
                    Escolha os leads e as colunas. Os filtros do quadro não mudam.
                  </p>
                </div>
                <button onClick={() => setShowExportCustom(false)} className="text-sec hover:text-white transition-colors text-xl">✕</button>
              </div>

              <div className="px-5 py-4 space-y-4 overflow-y-auto">
                <div>
                  <span className={rotulo} style={{ color: 'var(--text-sec)' }}>Período</span>
                  {/* No celular uma data embaixo da outra (lado a lado o "27 de nov. de 2026" do iPhone não cabia) */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      type="date"
                      aria-label="Data inicial"
                      value={f.inicio}
                      onChange={e => alterar({ inicio: e.target.value })}
                      className="flex-1 min-w-0 bg-app border border-str text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
                      style={{ color: 'var(--text-pri)' }}
                    />
                    <span className="hidden sm:inline" style={{ color: 'var(--text-sec)' }}>a</span>
                    <input
                      type="date"
                      aria-label="Data final"
                      value={f.fim}
                      onChange={e => alterar({ fim: e.target.value })}
                      className="flex-1 min-w-0 bg-app border border-str text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
                      style={{ color: 'var(--text-pri)' }}
                    />
                  </div>
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-sec)' }}>
                    Pela data da call; lead sem call, pela data de entrada. Sem datas, todos os leads.
                  </p>
                </div>

                {sdrs.length > 0 && grupoChips('SDRs', 'sdrs', sdrs.map(u => ({ valor: u.id_usuario, texto: u.nome })))}
                {closers.length > 0 && grupoChips('Closers', 'closers', closers.map(u => ({ valor: u.id_usuario, texto: u.nome })))}
                {grupoChips('Status', 'status', KANBAN_COLUMNS.map(c => ({ valor: c, texto: c })))}
                {produtos.length > 0 && grupoChips('Produto', 'produtos', (produtos as { id_produto: number; nome: string }[]).map(p => ({ valor: p.id_produto, texto: p.nome })))}
                {formas.length > 0 && grupoChips('Pagamento', 'formas', formas.map(fp => ({ valor: fp, texto: fp })))}

                <fieldset>
                  <legend className={rotulo} style={{ color: 'var(--text-sec)' }}>Off métricas</legend>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([['todos', 'Todos'], ['off', 'Só OFF'], ['metricas', 'Só nas métricas']] as const).map(([valor, texto]) => (
                      <button key={valor} type="button" aria-pressed={f.off === valor} onClick={() => alterar({ off: valor })} className="px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-150 leading-tight" style={estiloChip(f.off === valor)}>
                        {texto}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {grupoChips('Motivo do Loss', 'motivos', [...MOTIVOS_LOSS, SEM_MOTIVO_LOSS].map(m => ({ valor: m, texto: m })))}

                <fieldset aria-label="Colunas do arquivo">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-sec)' }}>
                      Colunas · {f.colunas.length} de {COLUNAS_CSV_LEADS.length}
                    </span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => alterar({ colunas: COLUNAS_CSV_LEADS.map(c => c.key) })} className="text-[11px] font-bold" style={{ color: 'var(--accent)' }}>Todas</button>
                      <button type="button" onClick={() => alterar({ colunas: [] })} className="text-[11px] font-bold" style={{ color: 'var(--text-sec)' }}>Nenhuma</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {COLUNAS_CSV_LEADS.map(c => (
                      <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-pri)' }}>
                        <input
                          type="checkbox"
                          checked={f.colunas.includes(c.key)}
                          // Mantém a ordem do arquivo, seja qual for a ordem dos cliques
                          onChange={() => setExpFiltros(prev => ({ ...prev, colunas: COLUNAS_CSV_LEADS.map(x => x.key).filter(k => k === c.key ? !prev.colunas.includes(k) : prev.colunas.includes(k)) }))}
                          className="accent-[var(--accent)]"
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-str">
                <span className="text-sm font-bold" style={{ color: expErro ? '#ef4444' : 'var(--text-pri)' }} aria-live="polite">
                  {expErro ? 'Erro ao carregar os leads do período'
                    : !expBase ? 'Carregando leads...'
                    : `${total} ${total === 1 ? 'lead será exportado' : 'leads serão exportados'}`}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={() => setExpFiltros(filtrosExportIniciais(f.inicio, f.fim))} className="px-3 py-2 text-sm font-medium transition-colors" style={{ color: 'var(--text-sec)' }}>
                    Limpar filtros
                  </button>
                  <button
                    onClick={handleExportPersonalizado}
                    disabled={!podeBaixar}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                    style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                  >
                    {expBaixando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    Baixar CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
