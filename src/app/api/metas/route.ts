import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const mes = searchParams.get('mes');
        const ano = searchParams.get('ano');
        const projectId = searchParams.get('projectId');

        // If projectId provided, fetch all users of that project and their goals
        if (projectId && mes && ano) {
            let usersQuery = supabase
                .from('usuarios')
                .select('id_usuario, nome, tipo')
                .eq('ativo', true)
                .in('tipo', ['SDR', 'CLOSER'])
                .eq('id_projeto', projectId);
            const { data: users } = await usersQuery;

            const { data: metas } = await supabase
                .from('metas_usuarios')
                .select('*')
                .eq('mes', mes)
                .eq('ano', ano);

            const result = (users || []).map((u: any) => {
                const meta = (metas || []).find((m: any) => m.id_usuario === u.id_usuario);
                return {
                    id_usuario: u.id_usuario,
                    nome: u.nome,
                    tipo: u.tipo,
                    meta_faturamento: meta?.meta_faturamento || 0,
                    meta_caixa: meta?.meta_caixa || 0,
                    meta_vendas: meta?.meta_vendas || 0,
                };
            });

            return NextResponse.json(result);
        }

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
        const { id_usuario, mes, ano, meta_faturamento, meta_caixa, meta_vendas } = body;
        if (!id_usuario || !mes || !ano) return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });

        const { error } = await supabase
            .from('metas_usuarios')
            .upsert(
                {
                    id_usuario,
                    mes,
                    ano,
                    meta_faturamento: parseFloat(meta_faturamento) || 0,
                    meta_caixa: parseFloat(meta_caixa) || 0,
                    meta_vendas: parseInt(meta_vendas) || 0,
                },
                { onConflict: 'id_usuario,mes,ano' }
            );

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
