import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const mes = searchParams.get('mes');
        const ano = searchParams.get('ano');

        let query = supabase.from('metas_usuarios').select('*');
        if (userId) query = query.eq('id_usuario', userId);
        if (mes) query = query.eq('mes', mes);
        if (ano) query = query.eq('ano', ano);

        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json(data || []);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id_usuario, mes, ano, meta_faturamento, meta_vendas } = body;
        if (!id_usuario || !mes || !ano) return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });

        const { error } = await supabase
            .from('metas_usuarios')
            .upsert({ id_usuario, mes, ano, meta_faturamento: parseFloat(meta_faturamento) || 0, meta_vendas: parseInt(meta_vendas) || 0 }, { onConflict: 'id_usuario,mes,ano' });

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
