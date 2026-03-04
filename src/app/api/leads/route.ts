import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        let leads;
        if (projectId) {
            leads = await sql`
                SELECT 
                    l.*,
                    s.nome as sdr_nome,
                    c.nome as closer_nome,
                    MAX(o.valor_proposta) as valor_proposta
                FROM leads l
                LEFT JOIN usuarios s ON l.id_sdr_responsavel = s.id_usuario
                LEFT JOIN usuarios c ON l.id_closer_responsavel = c.id_usuario
                LEFT JOIN oportunidades o ON l.id_lead = o.id_lead AND o.etapa_pipeline != 'Loss'
                WHERE l.id_projeto = ${projectId}
                GROUP BY l.id_lead, s.nome, c.nome
                ORDER BY l.data_entrada DESC
            `;
        } else {
            leads = await sql`
                SELECT 
                    l.*,
                    s.nome as sdr_nome,
                    c.nome as closer_nome,
                    MAX(o.valor_proposta) as valor_proposta
                FROM leads l
                LEFT JOIN usuarios s ON l.id_sdr_responsavel = s.id_usuario
                LEFT JOIN usuarios c ON l.id_closer_responsavel = c.id_usuario
                LEFT JOIN oportunidades o ON l.id_lead = o.id_lead AND o.etapa_pipeline != 'Loss'
                GROUP BY l.id_lead, s.nome, c.nome
                ORDER BY l.data_entrada DESC
            `;
        }

        return NextResponse.json(leads);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const {
            id_lead, status_atual, nome, telefone, instagram, email, origem,
            id_sdr_responsavel, id_closer_responsavel, observacoes_gerais, id_projeto, is_full_update, data_entrada
        } = body;

        if (!id_lead) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

        if (is_full_update) {
            await sql`
                UPDATE leads 
                SET nome = ${nome}, telefone = ${telefone || null}, instagram = ${instagram || null},
                    email = ${email || null}, origem = ${origem || null},
                    id_sdr_responsavel = ${id_sdr_responsavel || null},
                    id_closer_responsavel = ${id_closer_responsavel || null},
                    observacoes_gerais = ${observacoes_gerais || null},
                    id_projeto = ${id_projeto || null},
                    data_entrada = COALESCE(${data_entrada || null}::timestamptz, data_entrada)
                WHERE id_lead = ${id_lead}
            `;
            return NextResponse.json({ success: true, id_lead });
        } else {
            if (!status_atual) return NextResponse.json({ error: 'Missing status' }, { status: 400 });
            await sql`UPDATE leads SET status_atual = ${status_atual} WHERE id_lead = ${id_lead}`;
            return NextResponse.json({ success: true, id_lead, status_atual });
        }
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nome, telefone, instagram, email, origem, id_sdr_responsavel, id_closer_responsavel, observacoes_gerais, id_projeto, data_entrada } = body;

        if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
        if (!id_projeto) return NextResponse.json({ error: 'Projeto é obrigatório' }, { status: 400 });

        const [lead] = await sql`
            INSERT INTO leads (nome, telefone, instagram, email, origem, id_sdr_responsavel, id_closer_responsavel, observacoes_gerais, id_projeto, data_entrada)
            VALUES (
                ${nome}, ${telefone || null}, ${instagram || null}, ${email || null}, ${origem || null},
                ${id_sdr_responsavel || null}, ${id_closer_responsavel || null}, ${observacoes_gerais || null},
                ${id_projeto}, COALESCE(${data_entrada || null}::timestamptz, NOW())
            )
            RETURNING id_lead
        `;

        return NextResponse.json({ success: true, id_lead: lead.id_lead });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id_lead = url.searchParams.get('id');

        if (!id_lead) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });

        // Cascade delete related records
        await sql`DELETE FROM vendas WHERE id_lead = ${id_lead}`;
        await sql`DELETE FROM oportunidades WHERE id_lead = ${id_lead}`;
        await sql`DELETE FROM leads WHERE id_lead = ${id_lead}`;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
