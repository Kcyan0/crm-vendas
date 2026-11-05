import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { fetchAll } from '@/lib/fetchAll';
import { dataDeReferenciaLocal, filtroCallOuEntrada } from '@/lib/periodoLead';
import { dbDateToBrasiliaLocal } from '@/lib/brasilia';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        let query = supabase
            .from('leads')
            .select(`
                *,
                sdr:usuarios!id_sdr_responsavel(nome),
                closer:usuarios!id_closer_responsavel(nome),
                oportunidades(valor_proposta, etapa_pipeline),
                vendas(
                    id_venda,
                    valor_bruto,
                    desconto_concedido,
                    valor_liquido_caixa,
                    forma_pagamento,
                    numero_parcelas,
                    taxa_gateway,
                    status_pagamento,
                    data_venda
                )
            `)
            .order('data_entrada', { ascending: false });

        if (projectId) query = query.eq('id_projeto', projectId);
        // Mesmo período do quadro de leads: data da call; sem call, data de entrada
        if (startDate || endDate) query = query.or(filtroCallOuEntrada(startDate, endDate, {
            gte: startDate ? `${startDate}T00:00:00` : undefined,
            lte: endDate ? `${endDate}T23:59:59` : undefined,
        }));

        // Paginado: sem isso o Supabase corta em 1000 leads
        const data = await fetchAll(query.order('id_lead', { ascending: false }));
        // Mesma ordem do quadro: data da call (ou entrada sem call), mais recentes primeiro
        data.sort((a, b) => dataDeReferenciaLocal(b).localeCompare(dataDeReferenciaLocal(a)) || b.id_lead - a.id_lead);

        const leads = (data || []).map((lead: any) => {
            const validOport = lead.oportunidades?.filter((o: any) => o.etapa_pipeline !== 'Loss') || [];
            const maxProposta = validOport.length > 0
                ? Math.max(...validOport.map((o: any) => o.valor_proposta || 0))
                : null;
            const venda = lead.vendas?.[0] || null;

            return {
                id_lead: lead.id_lead,
                nome: lead.nome,
                telefone: lead.telefone,
                instagram: lead.instagram,
                email: lead.email,
                origem: lead.origem,
                status_atual: lead.status_atual,
                sdr_nome: lead.sdr?.nome || null,
                closer_nome: lead.closer?.nome || null,
                valor_proposta: maxProposta,
                observacoes_gerais: lead.observacoes_gerais,
                data_entrada: lead.data_entrada,
                // data_call é um instante: vai no horário de Brasília
                data_call: lead.data_call ? dbDateToBrasiliaLocal(lead.data_call).replace('T', ' ') : null,
                // dados de venda se existir
                valor_bruto: venda?.valor_bruto || null,
                desconto_concedido: venda?.desconto_concedido || null,
                valor_liquido_caixa: venda?.valor_liquido_caixa || null,
                forma_pagamento: venda?.forma_pagamento || null,
                numero_parcelas: venda?.numero_parcelas || null,
                status_pagamento: venda?.status_pagamento || null,
                data_venda: venda?.data_venda || null,
            };
        });

        return NextResponse.json(leads);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
