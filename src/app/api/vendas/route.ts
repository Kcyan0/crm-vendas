import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id_lead, pagamentos, observacoes, id_sdr, id_closer } = body;

        if (!id_lead || !pagamentos || pagamentos.length === 0) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Calculate total gross value from all payments
        const totalValorBruto = pagamentos.reduce((sum: number, p: any) => sum + (parseFloat(p.valor) || 0), 0);

        // Check for existing sale / oportunidade for this lead
        const { data: existing } = await supabase
            .from('vendas')
            .select('id_venda, id_oportunidade')
            .eq('id_lead', id_lead);

        let id_oportunidade: number;

        if (existing && existing.length > 0) {
            id_oportunidade = existing[0].id_oportunidade;
            // Delete existing sale rows so we can re-insert with new payment split
            const existingIds = existing.map((v: any) => v.id_venda);
            await supabase.from('vendas').delete().in('id_venda', existingIds);
            // Update oportunidade value
            await supabase.from('oportunidades')
                .update({ valor_proposta: totalValorBruto })
                .eq('id_oportunidade', id_oportunidade);
        } else {
            // Create new oportunidade
            const { data: oport, error: oErr } = await supabase
                .from('oportunidades')
                .insert({
                    id_lead,
                    descricao_oferta: 'Fechamento via Kanban',
                    valor_proposta: totalValorBruto,
                    probabilidade_fechamento: 100,
                    etapa_pipeline: 'Venda'
                })
                .select('id_oportunidade')
                .single();
            if (oErr) throw oErr;
            id_oportunidade = oport!.id_oportunidade;
        }

        // Insert one venda row per payment method
        const vendasToInsert = pagamentos.map((p: any) => {
            const valorBruto = parseFloat(p.valor) || 0;
            const taxaGw = parseFloat(p.taxa_gateway) || 0;
            const desconto = parseFloat(p.desconto) || 0;
            const valorLiquido = valorBruto - taxaGw - desconto;
            return {
                id_oportunidade,
                id_lead,
                id_sdr: id_sdr || null,
                id_closer: id_closer || null,
                valor_bruto: valorBruto,
                desconto_concedido: desconto,
                forma_pagamento: p.forma_pagamento || 'PIX',
                numero_parcelas: parseInt(p.numero_parcelas) || 1,
                taxa_gateway: taxaGw,
                valor_liquido_caixa: valorLiquido,
                status_pagamento: 'pago',
                data_venda: new Date().toISOString(),
                data_recebimento: new Date().toISOString().split('T')[0]
            };
        });

        const { error: vendasErr } = await supabase.from('vendas').insert(vendasToInsert);
        if (vendasErr) throw vendasErr;

        // Update lead status and optionally save observacoes
        const leadUpdate: any = { status_atual: 'Venda' };
        if (observacoes) leadUpdate.observacoes_gerais = observacoes;
        await supabase.from('leads').update(leadUpdate).eq('id_lead', id_lead);

        return NextResponse.json({ success: true, id_oportunidade });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
