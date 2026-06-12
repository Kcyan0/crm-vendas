import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const limit     = Math.min(parseInt(searchParams.get('limit')  || '50'), 100);
        const offset    = parseInt(searchParams.get('offset') || '0');
        const tipo      = searchParams.get('tipo'); // optional filter

        let query = supabase
            .from('atividades_log')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (projectId) query = (query as any).eq('id_projeto', projectId);
        if (tipo && tipo !== 'todos') query = (query as any).eq('tipo', tipo);

        const { data, error, count } = await query;
        if (error) throw error;

        return NextResponse.json({ data: data || [], total: count || 0 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id_projeto, id_usuario, usuario_nome, tipo, descricao, meta } = body;

        if (!tipo || !descricao) {
            return NextResponse.json({ error: 'tipo e descricao são obrigatórios' }, { status: 400 });
        }

        const { error } = await supabase.from('atividades_log').insert({
            id_projeto:   id_projeto   ?? null,
            id_usuario:   id_usuario   ?? null,
            usuario_nome: usuario_nome ?? 'Sistema',
            tipo,
            descricao,
            meta: meta ?? {},
        });

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
