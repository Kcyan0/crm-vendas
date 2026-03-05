import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id_lead, valor_bruto, desconto_concedido, forma_pagamento, numero_parcelas, taxa_gateway, id_sdr, id_closer } = body;

        if (!id_lead || valor_bruto === undefined) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

        // Check for existing sale
        const { data: existing } = await supabase
            .from('vendas')
            .select('id_venda, id_oportunidade')
            .eq('id_lead', id_lead)
            .limit(1)
            .maybeSingle();

        const valorBruto = parseFloat(valor_bruto);
        const desconto = parseFloat(desconto_concedido) || 0;
        const taxaGw = parseFloat(taxa_gateway) || 0;
        const parcelas = parseInt(numero_parcelas) || 1;
        const valorLiquido = valorBruto * (1 - taxaGw / 100) - desconto;

        if (existing) {
            await supabase.from('oportunidades').update({ valor_proposta: valorBruto }).eq('id_oportunidade', existing.id_oportunidade);
            await supabase.from('vendas').update({ id_sdr: id_sdr || null, id_closer: id_closer || null, valor_bruto: valorBruto, desconto_concedido: desconto, forma_pagamento: forma_pagamento || 'PIX', numero_parcelas: parcelas, taxa_gateway: taxaGw, data_venda: new Date().toISOString() }).eq('id_venda', existing.id_venda);
            await supabase.from('leads').update({ status_atual: 'Venda' }).eq('id_lead', id_lead);
            return NextResponse.json({ success: true, id_venda: existing.id_venda, id_oportunidade: existing.id_oportunidade });
        } else {
            const { data: oport } = await supabase.from('oportunidades').insert({ id_lead, descricao_oferta: 'Fechamento via Kanban', valor_proposta: valorBruto, probabilidade_fechamento: 100, etapa_pipeline: 'Venda' }).select('id_oportunidade').single();
            const { data: venda } = await supabase.from('vendas').insert({ id_oportunidade: oport!.id_oportunidade, id_lead, id_sdr: id_sdr || null, id_closer: id_closer || null, valor_bruto: valorBruto, desconto_concedido: desconto, forma_pagamento: forma_pagamento || 'PIX', numero_parcelas: parcelas, taxa_gateway: taxaGw, valor_liquido_caixa: valorLiquido, status_pagamento: 'pago', data_recebimento: new Date().toISOString().split('T')[0] }).select('id_venda').single();
            await supabase.from('leads').update({ status_atual: 'Venda' }).eq('id_lead', id_lead);
            return NextResponse.json({ success: true, id_venda: venda!.id_venda, id_oportunidade: oport!.id_oportunidade });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
