import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
    try {
        const projetos = await sql`SELECT id_projeto, nome FROM projetos WHERE ativo = true ORDER BY id_projeto ASC`;
        return NextResponse.json({ projetos });
    } catch (error) {
        console.error("API Projetos GET Error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nome, descricao } = body;

        if (!nome) return NextResponse.json({ error: 'O nome do projeto é obrigatório' }, { status: 400 });

        const [projeto] = await sql`
            INSERT INTO projetos (nome, descricao) VALUES (${nome}, ${descricao || ''})
            RETURNING id_projeto, nome, descricao
        `;

        return NextResponse.json({ success: true, projeto });
    } catch (error: any) {
        console.error("API Projetos POST Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id_projeto, nome, descricao } = body;

        if (!id_projeto || !nome) return NextResponse.json({ error: 'ID e Nome são obrigatórios' }, { status: 400 });

        await sql`UPDATE projetos SET nome = ${nome}, descricao = ${descricao || ''} WHERE id_projeto = ${id_projeto}`;

        return NextResponse.json({ success: true, id_projeto, nome, descricao });
    } catch (error: any) {
        console.error("API Projetos PUT Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id_projeto = url.searchParams.get('id');

        if (!id_projeto) return NextResponse.json({ error: 'ID do projeto é obrigatório' }, { status: 400 });

        await sql`DELETE FROM projetos WHERE id_projeto = ${id_projeto}`;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("API Projetos DELETE Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
