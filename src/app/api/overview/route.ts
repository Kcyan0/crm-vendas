import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { fetchAll } from '@/lib/fetchAll';
import { caixaInPeriod } from '@/lib/financial';
import { todayBrasilia } from '@/lib/brasilia';

// Mesmas regras da Dashboard (/api/metrics), projeto a projeto:
// - receita: pago + pendente, pela data da venda
// - caixa: dinheiro recebido no período (data_recebimento), inclusive de vendas de meses anteriores
// - leads OFF entram em receita e caixa, mas ficam fora de leads, conversão, chargeback e ticket médio
// - leads (conversão e chargeback): pela data da call; sem call, pela data de entrada
type LeadRow = { id_lead: number; id_projeto: number; status_atual: string; off_metricas: boolean | null; data_entrada: string | null; data_call: string | null };
type VendaRow = {
    id_venda: number; id_oportunidade: number | null; id_lead: number;
    valor_bruto: string | number | null; valor_liquido_caixa: string | number | null; numero_parcelas: number | null;
    data_venda: string; data_recebimento: string | null; status_pagamento: string;
};

const VENDA_SELECT = 'id_venda, id_oportunidade, id_lead, valor_bruto, valor_liquido_caixa, numero_parcelas, data_venda, data_recebimento, status_pagamento';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const hoje = todayBrasilia();
        const [ano, mes] = hoje.split('-').map(Number);
        const firstDay = `${hoje.slice(0, 7)}-01`;
        const lastDay = `${hoje.slice(0, 7)}-${String(new Date(Date.UTC(ano, mes, 0)).getUTCDate()).padStart(2, '0')}`;
        const startDate = searchParams.get('startDate') || firstDay;
        const endDate = searchParams.get('endDate') || lastDay;

        // Limites do período no fuso de Brasília, iguais aos da Dashboard
        const inicio = `${startDate}T03:00:00.000Z`;
        const fimDate = new Date(`${endDate}T03:00:00.000Z`);
        fimDate.setUTCDate(fimDate.getUTCDate() + 1);
        const fim = fimDate.toISOString();
        // Parcelas de vendas de até 24 meses atrás ainda podem cair no período
        const caixaDesde = new Date(`${startDate}T00:00:00Z`);
        caixaDesde.setUTCFullYear(caixaDesde.getUTCFullYear() - 2);
        const caixaStartBoundary = caixaDesde.toISOString().split('T')[0];

        // Get the logged-in user's projects
        const supabaseAuth = await createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const { data: userRows } = await supabase
            .from('usuarios')
            .select('id_projeto')
            .eq('email', user.email.toLowerCase());
        const projectIds = [...new Set((userRows || []).map((r: { id_projeto: number | null }) => r.id_projeto).filter(Boolean))];

        let projectsInfo: { id_projeto: number; nome: string }[] = [];
        if (projectIds.length > 0) {
            const { data: projs } = await supabase
                .from('projetos')
                .select('id_projeto, nome')
                .in('id_projeto', projectIds)
                .eq('ativo', true);
            projectsInfo = projs || [];
        }
        if (projectsInfo.length === 0) {
            return NextResponse.json({
                totalReceita: 0, totalCaixa: 0, totalVendas: 0, totalLeads: 0, totalConversao: 0, totalTicket: 0,
                byProject: [], period: { startDate, endDate },
            });
        }
        const pids = projectsInfo.map(p => p.id_projeto);

        // Tudo paginado: o Supabase corta em 1000 linhas sem avisar
        const [leads, vendasFat, caixaComData, caixaSemData] = await Promise.all([
            fetchAll(supabase.from('leads').select('id_lead, id_projeto, status_atual, off_metricas, data_entrada, data_call').in('id_projeto', pids).order('id_lead', { ascending: true })) as Promise<LeadRow[]>,
            fetchAll(supabase.from('vendas').select(VENDA_SELECT).in('status_pagamento', ['pago', 'pendente']).gte('data_venda', inicio).lt('data_venda', fim).order('id_venda', { ascending: true })) as Promise<VendaRow[]>,
            fetchAll(supabase.from('vendas').select(VENDA_SELECT).eq('status_pagamento', 'pago').gte('data_recebimento', caixaStartBoundary).lte('data_recebimento', endDate).order('id_venda', { ascending: true })) as Promise<VendaRow[]>,
            // Sem data de recebimento: o caixa usa a data da venda
            fetchAll(supabase.from('vendas').select(VENDA_SELECT).eq('status_pagamento', 'pago').is('data_recebimento', null).gte('data_venda', inicio).lt('data_venda', fim).order('id_venda', { ascending: true })) as Promise<VendaRow[]>,
        ]);

        const porProjeto: Record<number, { receita: number; caixa: number; vendas: Set<string>; ticketPorVenda: Record<string, number>; leads: number; reembolsados: number }> = {};
        for (const pid of pids) porProjeto[pid] = { receita: 0, caixa: 0, vendas: new Set(), ticketPorVenda: {}, leads: 0, reembolsados: 0 };

        // Receita e caixa contam leads OFF; Reembolsado e Loss ficam de fora
        const projetoDoLead: Record<number, number> = {};
        const foraDasMetricas: Record<number, boolean> = {};
        const inicioMs = new Date(inicio).getTime();
        const fimMs = new Date(fim).getTime();
        const noPeriodo = (d: string | null) => {
            if (!d) return false;
            const t = new Date(d).getTime();
            return t >= inicioMs && t < fimMs;
        };
        for (const l of leads) {
            if (l.status_atual !== 'Reembolsado' && l.status_atual !== 'Loss') projetoDoLead[l.id_lead] = l.id_projeto;
            foraDasMetricas[l.id_lead] = l.off_metricas !== false;
            if (foraDasMetricas[l.id_lead]) continue;
            // Base de conversão e chargeback: call no período (lead sem call conta pela entrada)
            if (!noPeriodo(l.data_call || l.data_entrada)) continue;
            if (l.status_atual !== 'No-show') porProjeto[l.id_projeto].leads++; // No-show não penaliza a conversão
            if (l.status_atual === 'Reembolsado') porProjeto[l.id_projeto].reembolsados++;
        }

        // Uma venda por oportunidade
        for (const v of vendasFat) {
            const pid = projetoDoLead[v.id_lead];
            if (pid === undefined) continue;
            const p = porProjeto[pid];
            const chave = String(v.id_oportunidade ?? v.id_lead);
            const valor = parseFloat(String(v.valor_bruto)) || 0;
            p.receita += valor;
            p.vendas.add(chave);
            // Ticket médio: só pago e sem leads OFF
            if (v.status_pagamento === 'pago' && !foraDasMetricas[v.id_lead]) p.ticketPorVenda[chave] = (p.ticketPorVenda[chave] || 0) + valor;
        }

        for (const v of [...caixaComData, ...caixaSemData]) {
            const pid = projetoDoLead[v.id_lead];
            if (pid !== undefined) porProjeto[pid].caixa += caixaInPeriod(v, startDate, endDate);
        }

        const projectMetrics = [];
        let totalReceita = 0, totalCaixa = 0, totalVendas = 0, totalLeads = 0, totalTicketReceita = 0, totalTicketVendas = 0;
        for (const proj of projectsInfo) {
            const p = porProjeto[proj.id_projeto];
            const vendasCount = p.vendas.size;
            const ticketValores = Object.values(p.ticketPorVenda);
            const ticketReceita = ticketValores.reduce((s, x) => s + x, 0);

            projectMetrics.push({
                id_projeto: proj.id_projeto,
                nome: proj.nome,
                receita: p.receita,
                caixa: p.caixa,
                vendas: vendasCount,
                leads: p.leads,
                conversao: p.leads > 0 ? parseFloat(((vendasCount / p.leads) * 100).toFixed(1)) : 0,
                chargebackRate: (vendasCount + p.reembolsados) > 0
                    ? parseFloat(((p.reembolsados / (vendasCount + p.reembolsados)) * 100).toFixed(1))
                    : 0,
                ticketFaturamento: ticketValores.length > 0 ? ticketReceita / ticketValores.length : 0,
                ticketCaixa: vendasCount > 0 ? p.caixa / vendasCount : 0,
            });

            totalReceita += p.receita;
            totalCaixa += p.caixa;
            totalVendas += vendasCount;
            totalLeads += p.leads;
            totalTicketReceita += ticketReceita;
            totalTicketVendas += ticketValores.length;
        }

        return NextResponse.json({
            totalReceita,
            totalCaixa,
            totalVendas,
            totalLeads,
            totalConversao: totalLeads > 0 ? parseFloat(((totalVendas / totalLeads) * 100).toFixed(1)) : 0,
            totalTicket: totalTicketVendas > 0 ? totalTicketReceita / totalTicketVendas : 0,
            byProject: projectMetrics,
            period: { startDate, endDate },
        });
    } catch (error: any) {
        console.error('[overview]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
