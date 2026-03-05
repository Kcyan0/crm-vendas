import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        let query = supabase
            .from('leads')
            .select(`
                *,
                sdr:usuarios!id_sdr_responsavel(nome),
                closer:usuarios!id_closer_responsavel(nome),
                oportunidades(valor_proposta, etapa_pipeline)
            `)
            .order('data_entrada', { ascending: false });

        if (projectId) query = query.eq('id_projeto', projectId);

        const { data, error } = await query;
        if (error) throw error;

        // Flatten the joined data to match the expected format
        const leads = (data || []).map((lead: any) => {
            const validOport = lead.oportunidades?.filter((o: any) => o.etapa_pipeline !== 'Loss') || [];
            const maxProposta = validOport.length > 0 ? Math.max(...validOport.map((o: any) => o.valor_proposta || 0)) : null;
            return {
                ...lead,
                sdr_nome: lead.sdr?.nome || null,
                closer_nome: lead.closer?.nome || null,
                valor_proposta: maxProposta,
                sdr: undefined,
                closer: undefined,
                oportunidades: undefined,
            };
        });

        return NextResponse.json(leads);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
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
            const updateData: any = { nome, telefone: telefone || null, instagram: instagram || null, email: email || null, origem: origem || null, id_sdr_responsavel: id_sdr_responsavel || null, id_closer_responsavel: id_closer_responsavel || null, observacoes_gerais: observacoes_gerais || null, id_projeto: id_projeto || null };
            if (data_entrada) updateData.data_entrada = data_entrada;

            const { error } = await supabase.from('leads').update(updateData).eq('id_lead', id_lead);
            if (error) throw error;
            return NextResponse.json({ success: true, id_lead });
        } else {
            if (!status_atual) return NextResponse.json({ error: 'Missing status' }, { status: 400 });
            const { error } = await supabase.from('leads').update({ status_atual }).eq('id_lead', id_lead);
            if (error) throw error;
            return NextResponse.json({ success: true, id_lead, status_atual });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nome, telefone, instagram, email, origem, id_sdr_responsavel, id_closer_responsavel, observacoes_gerais, id_projeto, data_entrada } = body;

        if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
        if (!id_projeto) return NextResponse.json({ error: 'Projeto é obrigatório' }, { status: 400 });

        const insertData: any = { nome, telefone: telefone || null, instagram: instagram || null, email: email || null, origem: origem || null, id_sdr_responsavel: id_sdr_responsavel || null, id_closer_responsavel: id_closer_responsavel || null, observacoes_gerais: observacoes_gerais || null, id_projeto };
        if (data_entrada) insertData.data_entrada = data_entrada;

        const { data, error } = await supabase.from('leads').insert(insertData).select('id_lead').single();
        if (error) throw error;
        return NextResponse.json({ success: true, id_lead: data.id_lead });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id_lead = url.searchParams.get('id');
        if (!id_lead) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });

        await supabase.from('vendas').delete().eq('id_lead', id_lead);
        await supabase.from('oportunidades').delete().eq('id_lead', id_lead);
        const { error } = await supabase.from('leads').delete().eq('id_lead', id_lead);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
