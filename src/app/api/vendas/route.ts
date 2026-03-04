import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            id_lead, valor_bruto, desconto_concedido, forma_pagamento, numero_parcelas, taxa_gateway,
            id_sdr, id_closer
        } = body;

        if (!id_lead || valor_bruto === undefined) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

        // Check for existing sale
        const existing = await sql`SELECT id_venda, id_oportunidade FROM vendas WHERE id_lead = ${id_lead} LIMIT 1`;

        if (existing.length > 0) {
            const { id_venda, id_oportunidade } = existing[0];

            // Update Oportunidade
            await sql`UPDATE oportunidades SET valor_proposta = ${parseFloat(valor_bruto)} WHERE id_oportunidade = ${id_oportunidade}`;

            // Update Venda
            await sql`
                UPDATE vendas 
                SET id_sdr = ${id_sdr || null}, id_closer = ${id_closer || null}, 
                    valor_bruto = ${parseFloat(valor_bruto)}, desconto_concedido = ${parseFloat(desconto_concedido) || 0},
                    forma_pagamento = ${forma_pagamento || 'PIX'}, numero_parcelas = ${parseInt(numero_parcelas) || 1},
                    taxa_gateway = ${parseFloat(taxa_gateway) || 0}, data_venda = NOW()
                WHERE id_venda = ${id_venda}
            `;

            // Update Lead Status
            await sql`UPDATE leads SET status_atual = 'Venda' WHERE id_lead = ${id_lead}`;

            return NextResponse.json({ success: true, id_venda, id_oportunidade });
        } else {
            // 1. Create Oportunidade
            const [oport] = await sql`
                INSERT INTO oportunidades (id_lead, descricao_oferta, valor_proposta, probabilidade_fechamento, etapa_pipeline)
                VALUES (${id_lead}, 'Fechamento via Kanban', ${parseFloat(valor_bruto)}, 100, 'Venda')
                RETURNING id_oportunidade
            `;

            // 2. Create Venda
            const valorLiquido = parseFloat(valor_bruto) * (1 - (parseFloat(taxa_gateway) || 0) / 100) - (parseFloat(desconto_concedido) || 0);
            const [venda] = await sql`
                INSERT INTO vendas (id_oportunidade, id_lead, id_sdr, id_closer, valor_bruto, desconto_concedido, forma_pagamento, numero_parcelas, taxa_gateway, valor_liquido_caixa, status_pagamento, data_recebimento)
                VALUES (
                    ${oport.id_oportunidade}, ${id_lead}, ${id_sdr || null}, ${id_closer || null},
                    ${parseFloat(valor_bruto)}, ${parseFloat(desconto_concedido) || 0}, ${forma_pagamento || 'PIX'},
                    ${parseInt(numero_parcelas) || 1}, ${parseFloat(taxa_gateway) || 0}, ${valorLiquido},
                    'pago', CURRENT_DATE
                )
                RETURNING id_venda
            `;

            // 3. Update Lead Status
            await sql`UPDATE leads SET status_atual = 'Venda' WHERE id_lead = ${id_lead}`;

            return NextResponse.json({ success: true, id_venda: venda.id_venda, id_oportunidade: oport.id_oportunidade });
        }

    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
