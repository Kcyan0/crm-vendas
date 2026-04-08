import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const leadId = url.searchParams.get('leadId');
        if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

        const { data, error } = await supabase
            .from('vendas')
            .select('*')
            .eq('id_lead', leadId)
            .order('data_venda', { ascending: true });

        if (error) throw error;
        return NextResponse.json(data || []);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {

    try {
        const body = await request.json();
        const { id_lead, pagamentos, observacoes, id_sdr, id_closer, data_venda } = body;

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

        // Build one or two venda rows per payment method
        const vendasToInsert: any[] = [];
        for (const p of pagamentos) {
            const valorTotal = parseFloat(p.valor) || 0;
            const taxaGw = parseFloat(p.taxa_gateway) || 0;
            const desconto = parseFloat(p.desconto) || 0;
            const entrada = parseFloat(p.valor_entrada) || 0;
            const formaPgto = p.forma_pagamento || 'PIX';
            const parcelas = parseInt(p.numero_parcelas) || 1;

            if (entrada > 0 && entrada < valorTotal) {
                // Down payment row (immediate, 1x)
                const taxaEntrada = taxaGw > 0 ? (entrada / valorTotal) * taxaGw : 0;
                const entradaPagaEmpresa = !!p.entrada_paga_empresa;
                // If company financed the entrada: net = -(entrada) (cost), not +(entrada - taxaEntrada)
                const liquidoEntrada = entradaPagaEmpresa
                    ? -(entrada)
                    : entrada - taxaEntrada;
                vendasToInsert.push({
                    id_oportunidade,
                    id_lead,
                    id_sdr: id_sdr || null,
                    id_closer: id_closer || null,
                    valor_bruto: entrada,
                    desconto_concedido: 0,
                    forma_pagamento: `${formaPgto} (Entrada)`,
                    numero_parcelas: 1,
                    taxa_gateway: parseFloat(taxaEntrada.toFixed(2)),
                    valor_liquido_caixa: parseFloat(liquidoEntrada.toFixed(2)),
                    status_pagamento: 'pago',
                    data_venda: data_venda ? new Date(`${data_venda}T12:00:00.000Z`).toISOString() : new Date().toISOString(),
                    data_recebimento: data_venda ? `${data_venda}` : new Date().toISOString().split('T')[0]
                });
                // Installments row (remainder) — first installment 30 days after today
                const restante = valorTotal - entrada;
                const taxaResto = taxaGw - taxaEntrada;
                const primeiraParcelaDate = new Date();
                primeiraParcelaDate.setDate(primeiraParcelaDate.getDate() + 30);
                vendasToInsert.push({
                    id_oportunidade,
                    id_lead,
                    id_sdr: id_sdr || null,
                    id_closer: id_closer || null,
                    valor_bruto: restante,
                    desconto_concedido: desconto,
                    forma_pagamento: `${formaPgto} (Parcelas)`,
                    numero_parcelas: parcelas,
                    taxa_gateway: parseFloat(taxaResto.toFixed(2)),
                    valor_liquido_caixa: restante - taxaResto - desconto,
                    status_pagamento: 'pago',
                    data_venda: data_venda ? new Date(`${data_venda}T12:00:00.000Z`).toISOString() : new Date().toISOString(),
                    data_recebimento: primeiraParcelaDate.toISOString().split('T')[0]
                });
            } else {
                // Regular row (no entrada)
                const valorLiquido = valorTotal - taxaGw - desconto;
                vendasToInsert.push({
                    id_oportunidade,
                    id_lead,
                    id_sdr: id_sdr || null,
                    id_closer: id_closer || null,
                    valor_bruto: valorTotal,
                    desconto_concedido: desconto,
                    forma_pagamento: formaPgto,
                    numero_parcelas: parcelas,
                    taxa_gateway: taxaGw,
                    valor_liquido_caixa: valorLiquido,
                    status_pagamento: 'pago',
                    data_venda: data_venda ? new Date(`${data_venda}T12:00:00.000Z`).toISOString() : new Date().toISOString(),
                    data_recebimento: data_venda ? `${data_venda}` : new Date().toISOString().split('T')[0]
                });
            }
        }


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
