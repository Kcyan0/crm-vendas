import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
    try {
        const gateways = await sql`SELECT * FROM gateways_pagamento ORDER BY ativo DESC, nome ASC`;
        return NextResponse.json(gateways);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nome, taxa_percentual, taxa_fixa, ativo } = body;

        if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });

        const isAtivo = ativo === undefined || ativo === true || String(ativo) === '1';
        const [gateway] = await sql`
            INSERT INTO gateways_pagamento (nome, taxa_percentual, taxa_fixa, ativo)
            VALUES (${nome}, ${parseFloat(taxa_percentual) || 0}, ${parseFloat(taxa_fixa) || 0}, ${isAtivo})
            RETURNING id_gateway
        `;

        return NextResponse.json({ id_gateway: gateway.id_gateway, success: true });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id_gateway, nome, taxa_percentual, taxa_fixa, ativo } = body;

        if (!id_gateway || !nome) return NextResponse.json({ error: 'ID e Nome são obrigatórios' }, { status: 400 });

        const isAtivo = ativo === undefined || ativo === true || String(ativo) === '1';
        await sql`
            UPDATE gateways_pagamento
            SET nome = ${nome}, taxa_percentual = ${parseFloat(taxa_percentual) || 0}, taxa_fixa = ${parseFloat(taxa_fixa) || 0}, ativo = ${isAtivo}
            WHERE id_gateway = ${id_gateway}
        `;

        return NextResponse.json({ success: true, id_gateway });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id_gateway = url.searchParams.get('id');

        if (!id_gateway) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });

        await sql`DELETE FROM gateways_pagamento WHERE id_gateway = ${id_gateway}`;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
