import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('gateways_pagamento')
            .select('*')
            .order('ativo', { ascending: false })
            .order('nome', { ascending: true });

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nome, taxa_percentual, taxa_fixa, ativo, tem_entrada, taxa_entrada_percentual, taxa_entrada_fixa } = body;
        if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });

        const isAtivo = ativo === undefined || ativo === true || String(ativo) === '1';
        const { data, error } = await supabase
            .from('gateways_pagamento')
            .insert({ 
                nome, 
                taxa_percentual: parseFloat(taxa_percentual) || 0, 
                taxa_fixa: parseFloat(taxa_fixa) || 0, 
                ativo: isAtivo, 
                tem_entrada: !!tem_entrada,
                taxa_entrada_percentual: parseFloat(taxa_entrada_percentual) || 0,
                taxa_entrada_fixa: parseFloat(taxa_entrada_fixa) || 0
            })
            .select('id_gateway')
            .single();

        if (error) throw error;
        return NextResponse.json({ id_gateway: data.id_gateway, success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id_gateway, nome, taxa_percentual, taxa_fixa, ativo, tem_entrada, taxa_entrada_percentual, taxa_entrada_fixa } = body;
        if (!id_gateway || !nome) return NextResponse.json({ error: 'ID e Nome são obrigatórios' }, { status: 400 });

        const isAtivo = ativo === undefined || ativo === true || String(ativo) === '1';
        const { error } = await supabase
            .from('gateways_pagamento')
            .update({ 
                nome, 
                taxa_percentual: parseFloat(taxa_percentual) || 0, 
                taxa_fixa: parseFloat(taxa_fixa) || 0, 
                ativo: isAtivo, 
                tem_entrada: !!tem_entrada,
                taxa_entrada_percentual: parseFloat(taxa_entrada_percentual) || 0,
                taxa_entrada_fixa: parseFloat(taxa_entrada_fixa) || 0
            })
            .eq('id_gateway', id_gateway);

        if (error) throw error;
        return NextResponse.json({ success: true, id_gateway });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id_gateway = url.searchParams.get('id');
        if (!id_gateway) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });

        const { error } = await supabase
            .from('gateways_pagamento')
            .delete()
            .eq('id_gateway', id_gateway);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
