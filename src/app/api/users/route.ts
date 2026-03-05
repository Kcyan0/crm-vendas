import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        let query = supabase
            .from('usuarios')
            .select('id_usuario, nome, email, tipo, ativo, salario_fixo_mensal, percentual_comissao_sdr, percentual_comissao_closer, id_projeto');

        if (projectId) query = query.eq('id_projeto', projectId);

        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nome, email, tipo, salario, pctSdr, pctCloser, id_projeto } = body;
        if (!id_projeto) return NextResponse.json({ error: 'Projeto é obrigatório' }, { status: 400 });

        const { data, error } = await supabase
            .from('usuarios')
            .insert({ nome, email, tipo, salario_fixo_mensal: salario || 0, percentual_comissao_sdr: pctSdr || 0, percentual_comissao_closer: pctCloser || 0, id_projeto })
            .select('id_usuario')
            .single();

        if (error) throw error;
        return NextResponse.json({ id: data.id_usuario, ...body });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id_usuario, nome, email, tipo, ativo, salario, pctSdr, pctCloser, id_projeto } = body;
        if (!id_usuario) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        if (!id_projeto) return NextResponse.json({ error: 'Projeto é obrigatório' }, { status: 400 });

        const isAtivo = ativo === undefined || ativo === true || String(ativo) === '1';
        const { error } = await supabase
            .from('usuarios')
            .update({ nome, email, tipo, ativo: isAtivo, salario_fixo_mensal: salario || 0, percentual_comissao_sdr: pctSdr || 0, percentual_comissao_closer: pctCloser || 0, id_projeto })
            .eq('id_usuario', id_usuario);

        if (error) throw error;
        return NextResponse.json({ success: true, id_usuario });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id_usuario = url.searchParams.get('id');
        if (!id_usuario) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });

        const { error } = await supabase.from('usuarios').delete().eq('id_usuario', id_usuario);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
