import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET() {
    try {
        const { data: vendas, error } = await supabase.from('vendas').select('*');
        if (error) throw error;

        let updatedCount = 0;
        let diffs = [];
        for (const v of vendas) {
            const bruto = parseFloat(v.valor_bruto) || 0;
            const taxa = parseFloat(v.taxa_gateway) || 0;
            const desc = parseFloat(v.desconto_concedido) || 0;

            const correto = bruto - taxa - desc;

            if (Math.abs((parseFloat(v.valor_liquido_caixa) || 0) - correto) > 0.01) {
                await supabase.from('vendas').update({ valor_liquido_caixa: correto }).eq('id_venda', v.id_venda);
                updatedCount++;
                diffs.push({id: v.id_venda, old: v.valor_liquido_caixa, new: correto});
            }
        }

        return NextResponse.json({ success: true, updatedCount, diffs });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
