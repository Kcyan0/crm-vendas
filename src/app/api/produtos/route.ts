import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId') || searchParams.get('id_projeto');

        // ─── Mode: fetch products linked to specific venda IDs ───────────────
        // Used by edit-sale modal to pre-populate selected products
        const vendaIds = searchParams.getAll('vendaId').map(Number).filter(Boolean);
        if (vendaIds.length > 0) {
            const { data, error } = await supabase
                .from('venda_produtos')
                .select('id_venda, id_produto')
                .in('id_venda', vendaIds);
            if (error) throw error;
            return NextResponse.json(data || []);
        }

        // ─── Default mode: list active products for a project ────────────────
        let query = supabase
            .from('produtos')
            .select('*')
            .eq('ativo', true)
            .order('nome', { ascending: true });

        if (projectId) {
            query = query.eq('id_projeto', projectId);
        }

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
        const { nome, descricao } = body;
        const id_projeto = body.id_projeto ?? body.projectId;

        if (!nome) {
            return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
        }
        if (!id_projeto) {
            return NextResponse.json({ error: 'id_projeto é obrigatório' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('produtos')
            .insert({
                nome,
                descricao: descricao ?? null,
                id_projeto,
                ativo: true
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id_produto, nome, descricao } = body;

        if (!id_produto) {
            return NextResponse.json({ error: 'id_produto é obrigatório' }, { status: 400 });
        }
        if (!nome) {
            return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('produtos')
            .update({
                nome,
                descricao: descricao ?? null
            })
            .eq('id_produto', id_produto)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id') || url.searchParams.get('id_produto');

        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        const { error } = await supabase
            .from('produtos')
            .update({ ativo: false })
            .eq('id_produto', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
