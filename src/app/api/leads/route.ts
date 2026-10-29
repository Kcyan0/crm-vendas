import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { logActivity } from '@/lib/logger';
import { fetchAll } from '@/lib/fetchAll';

// Lotes de 200 ids para a URL do .in() não ficar gigante; os lotes rodam em paralelo
async function fetchInBatches(ids: number[], buildQuery: (ids: number[]) => Parameters<typeof fetchAll>[0]) {
    const batches: number[][] = [];
    for (let i = 0; i < ids.length; i += 200) batches.push(ids.slice(i, i + 200));
    const results = await Promise.all(batches.map(batch => fetchAll(buildQuery(batch))));
    return results.flat();
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // ?id=X → só as observações de um lead (a lista não traz, ver abaixo)
        const leadId = searchParams.get('id');
        if (leadId) {
            const { data, error } = await supabase
                .from('leads')
                .select('id_lead, observacoes_gerais')
                .eq('id_lead', leadId)
                .single();
            if (error) throw error;
            return NextResponse.json(data);
        }

        // Sem observacoes_gerais: são ~80% do peso da lista e só aparecem ao abrir um lead
        let query = supabase
            .from('leads')
            .select(`
                id_lead, nome, telefone, instagram, email, origem, status_atual,
                id_sdr_responsavel, id_closer_responsavel, id_projeto, data_entrada,
                motivo_reembolso, off_metricas, data_proximo_follow, data_call,
                sdr:usuarios!id_sdr_responsavel(nome),
                closer:usuarios!id_closer_responsavel(nome),
                oportunidades(valor_proposta, etapa_pipeline)
            `)
            .order('data_entrada', { ascending: false });

        if (projectId) query = query.eq('id_projeto', projectId);
        if (startDate) query = query.gte('data_entrada', `${startDate}T00:00:00`);
        if (endDate) query = query.lte('data_entrada', `${endDate}T23:59:59`);

        // Paginado: sem isso o Supabase corta em 1000 leads e os mais antigos somem
        const data = await fetchAll(query.order('id_lead', { ascending: false }));

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

        // ─── Vendas dos leads: uma consulta só, em lotes paralelos ────────────
        const allLeadIds = leads.map((l: any) => l.id_lead);
        const allVendas = await fetchInBatches(allLeadIds, ids =>
            supabase
                .from('vendas')
                .select('id_venda, id_lead, forma_pagamento, status_pagamento, valor_bruto')
                .in('id_lead', ids)
                .order('id_venda')
        );

        // ─── Enrich leads with pending payment info ────────────────────────────
        const vendaLeadIds = new Set(leads.filter((l: any) => l.status_atual === 'Venda').map((l: any) => l.id_lead));
        let pendenteMap: Record<number, number> = {};
        for (const p of allVendas) {
            if (p.status_pagamento !== 'pendente' || !vendaLeadIds.has(p.id_lead)) continue;
            pendenteMap[p.id_lead] = (pendenteMap[p.id_lead] || 0) + (parseFloat(p.valor_bruto) || 0);
        }

        const leadsWithPendente = leads.map((l: any) => ({
            ...l,
            tem_pendente: !!pendenteMap[l.id_lead],
            valor_pendente: pendenteMap[l.id_lead] || 0,
        }));

        // ─── Enrich leads with payment methods ────────────────────────────────
        let formasMap: Record<number, string[]> = {};
        for (const v of allVendas) {
            const base = (v.forma_pagamento || '')
                .replace(/ \(Entrada\)| \(Parcelas\)/g, '').trim();
            if (!base) continue;
            if (!formasMap[v.id_lead]) formasMap[v.id_lead] = [];
            if (!formasMap[v.id_lead].includes(base)) formasMap[v.id_lead].push(base);
        }

        const enriched = leadsWithPendente.map((l: any) => ({
            ...l,
            formas_pagamento: formasMap[l.id_lead] || [],
        }));

        // ─── Enrich leads with product IDs ────────────────────────────────────
        const vendaToLeadMap: Record<number, number> = {};
        for (const v of allVendas) {
            vendaToLeadMap[v.id_venda] = v.id_lead;
        }

        const allVendaIds = allVendas.map((v: any) => v.id_venda);
        let produtosMap: Record<number, number[]> = {}; // lead_id -> [id_produto, ...]
        if (allVendaIds.length > 0) {
            const vpRows = await fetchInBatches(allVendaIds, ids =>
                supabase
                    .from('venda_produtos')
                    .select('id_venda, id_produto')
                    .in('id_venda', ids)
                    .order('id_venda')
                    .order('id_produto')
            );
            for (const vp of vpRows) {
                const leadId = vendaToLeadMap[vp.id_venda];
                if (!leadId) continue;
                if (!produtosMap[leadId]) produtosMap[leadId] = [];
                if (!produtosMap[leadId].includes(vp.id_produto)) {
                    produtosMap[leadId].push(vp.id_produto);
                }
            }
        }

        const fullyEnriched = enriched.map((l: any) => ({
            ...l,
            produtos_ids: produtosMap[l.id_lead] || [],
        }));

        return NextResponse.json(fullyEnriched);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const {
            id_lead, status_atual, nome, telefone, instagram, email, origem,
            id_sdr_responsavel, id_closer_responsavel, observacoes_gerais, id_projeto, is_full_update, data_entrada, off_metricas, data_call
        } = body;

        if (!id_lead) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

        if (is_full_update) {
            const updateData: any = { nome, telefone: telefone || null, instagram: instagram || null, email: email || null, origem: origem || null, id_sdr_responsavel: id_sdr_responsavel || null, id_closer_responsavel: id_closer_responsavel || null, observacoes_gerais: observacoes_gerais || null, id_projeto: id_projeto || null, off_metricas: off_metricas === true };
            if (data_entrada) updateData.data_entrada = data_entrada;
            if (data_call !== undefined) updateData.data_call = data_call || null;

            const { error } = await supabase.from('leads').update(updateData).eq('id_lead', id_lead);
            if (error) throw error;

            logActivity({
                id_projeto: id_projeto ? parseInt(id_projeto) : null,
                id_usuario: body.id_usuario ?? null,
                usuario_nome: body.usuario_nome ?? null,
                usuario_tipo: body.usuario_tipo ?? null,
                tipo: 'lead_editado',
                descricao: `Lead "${nome}" atualizado`,
                meta: { lead_id: id_lead, lead_nome: nome },
            });

            return NextResponse.json({ success: true, id_lead });
        } else {
            if (!status_atual) return NextResponse.json({ error: 'Missing status' }, { status: 400 });

            // Fetch current status for the log
            const { data: currentLead } = await supabase.from('leads').select('status_atual, nome, id_projeto').eq('id_lead', id_lead).single();
            const statusAnterior = currentLead?.status_atual ?? '?';
            const leadNome       = currentLead?.nome         ?? `Lead #${id_lead}`;
            const projetoId      = currentLead?.id_projeto   ?? null;

            const updatePayload: any = { status_atual };
            if (body.motivo_reembolso !== undefined) updatePayload.motivo_reembolso = body.motivo_reembolso;
            // Remarcado: nova data da call; a data de entrada não muda
            if (data_call !== undefined) updatePayload.data_call = data_call || null;
            const { error } = await supabase.from('leads').update(updatePayload).eq('id_lead', id_lead);
            if (error) throw error;

            logActivity({
                id_projeto: projetoId,
                id_usuario: body.id_usuario ?? null,
                usuario_nome: body.usuario_nome ?? null,
                usuario_tipo: body.usuario_tipo ?? null,
                tipo: 'status_alterado',
                descricao: `"${leadNome}" movido de ${statusAnterior} → ${status_atual}`,
                meta: { lead_id: id_lead, lead_nome: leadNome, status_de: statusAnterior, status_para: status_atual },
            });

            return NextResponse.json({ success: true, id_lead, status_atual });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nome, telefone, instagram, email, origem, id_sdr_responsavel, id_closer_responsavel, observacoes_gerais, id_projeto, data_entrada, off_metricas, data_call } = body;

        if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
        if (!id_projeto) return NextResponse.json({ error: 'Projeto é obrigatório' }, { status: 400 });

        const insertData: any = { nome, telefone: telefone || null, instagram: instagram || null, email: email || null, origem: origem || null, id_sdr_responsavel: id_sdr_responsavel || null, id_closer_responsavel: id_closer_responsavel || null, observacoes_gerais: observacoes_gerais || null, id_projeto, off_metricas: off_metricas === true };
        if (data_entrada) insertData.data_entrada = data_entrada;
        if (data_call) insertData.data_call = data_call;

        const { data, error } = await supabase.from('leads').insert(insertData).select('id_lead').single();
        if (error) throw error;

        // ─── Log activity ──────────────────────────────────────────────────────
        // Lookup SDR name AND tipo for richer log
        let sdrNome = body.usuario_nome ?? null;
        let sdrTipo = body.usuario_tipo ?? null;
        if ((!sdrNome || !sdrTipo) && id_sdr_responsavel) {
            const { data: u } = await supabase.from('usuarios').select('nome, tipo').eq('id_usuario', id_sdr_responsavel).single();
            if (!sdrNome) sdrNome = u?.nome ?? null;
            if (!sdrTipo) sdrTipo = u?.tipo ?? null;
        }
        logActivity({
            id_projeto: parseInt(id_projeto),
            id_usuario: id_sdr_responsavel ? parseInt(id_sdr_responsavel) : (body.id_usuario ?? null),
            usuario_nome: sdrNome,
            usuario_tipo: sdrTipo,
            tipo: 'lead_criado',
            descricao: `Lead "${nome}" adicionado ao pipeline`,
            meta: { lead_id: data.id_lead, lead_nome: nome, origem: origem || null },
        });

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

        // Fetch lead info before deletion for the log
        const { data: leadInfo } = await supabase.from('leads').select('nome, id_projeto').eq('id_lead', id_lead).single();

        await supabase.from('vendas').delete().eq('id_lead', id_lead);
        await supabase.from('oportunidades').delete().eq('id_lead', id_lead);
        const { error } = await supabase.from('leads').delete().eq('id_lead', id_lead);
        if (error) throw error;

        logActivity({
            id_projeto: leadInfo?.id_projeto ?? null,
            tipo: 'lead_deletado',
            descricao: `Lead "${leadInfo?.nome ?? `#${id_lead}`}" removido do sistema`,
            meta: { lead_id: parseInt(id_lead), lead_nome: leadInfo?.nome ?? null },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
