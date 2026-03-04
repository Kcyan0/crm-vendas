import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        let query;
        if (projectId) {
            query = await sql`SELECT id_usuario, nome, email, tipo, ativo, salario_fixo_mensal, percentual_comissao_sdr, percentual_comissao_closer, id_projeto FROM usuarios WHERE id_projeto = ${projectId}`;
        } else {
            query = await sql`SELECT id_usuario, nome, email, tipo, ativo, salario_fixo_mensal, percentual_comissao_sdr, percentual_comissao_closer, id_projeto FROM usuarios`;
        }

        return NextResponse.json(query);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nome, email, tipo, salario, pctSdr, pctCloser, id_projeto } = body;

        if (!id_projeto) return NextResponse.json({ error: 'Projeto é obrigatório' }, { status: 400 });

        const [user] = await sql`
            INSERT INTO usuarios (nome, email, tipo, salario_fixo_mensal, percentual_comissao_sdr, percentual_comissao_closer, id_projeto)
            VALUES (${nome}, ${email}, ${tipo}, ${salario || 0}, ${pctSdr || 0}, ${pctCloser || 0}, ${id_projeto})
            RETURNING id_usuario
        `;

        return NextResponse.json({ id: user.id_usuario, ...body });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id_usuario, nome, email, tipo, ativo, salario, pctSdr, pctCloser, id_projeto } = body;

        if (!id_usuario) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        if (!id_projeto) return NextResponse.json({ error: 'Projeto é obrigatório' }, { status: 400 });

        const isAtivo = ativo === undefined || ativo === true || String(ativo) === '1';

        await sql`
            UPDATE usuarios
            SET nome = ${nome}, email = ${email}, tipo = ${tipo}, ativo = ${isAtivo},
                salario_fixo_mensal = ${salario || 0}, percentual_comissao_sdr = ${pctSdr || 0},
                percentual_comissao_closer = ${pctCloser || 0}, id_projeto = ${id_projeto}
            WHERE id_usuario = ${id_usuario}
        `;

        return NextResponse.json({ success: true, id_usuario });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id_usuario = url.searchParams.get('id');

        if (!id_usuario) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });

        await sql`DELETE FROM usuarios WHERE id_usuario = ${id_usuario}`;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
