import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('projetos')
            .select('id_projeto, nome, descricao')
            .eq('ativo', true)
            .order('id_projeto', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ projetos: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nome, descricao } = body;
        if (!nome) return NextResponse.json({ error: 'O nome do projeto é obrigatório' }, { status: 400 });

        const { data, error } = await supabase
            .from('projetos')
            .insert({ nome, descricao: descricao || '' })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, projeto: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id_projeto, nome, descricao } = body;
        if (!id_projeto || !nome) return NextResponse.json({ error: 'ID e Nome são obrigatórios' }, { status: 400 });

        const { error } = await supabase
            .from('projetos')
            .update({ nome, descricao: descricao || '' })
            .eq('id_projeto', id_projeto);

        if (error) throw error;
        return NextResponse.json({ success: true, id_projeto, nome, descricao });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id_projeto = url.searchParams.get('id');
        if (!id_projeto) return NextResponse.json({ error: 'ID do projeto é obrigatório' }, { status: 400 });

        const { error } = await supabase
            .from('projetos')
            .delete()
            .eq('id_projeto', id_projeto);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
