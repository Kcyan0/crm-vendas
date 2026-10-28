import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import supabase from '@/lib/db';
import { fetchAll } from '@/lib/fetchAll';
import { logActivity } from '@/lib/logger';
import { todayBrasilia, addDaysToDate, startOfDayBrasiliaISO } from '@/lib/brasilia';
import { FOLLOW_CLOSED_STATUSES, FOLLOW_DEFAULT_DAYS } from '@/lib/followUp';

const CLOSED_FILTER = `(${FOLLOW_CLOSED_STATUSES.map(s => `"${s}"`).join(',')})`;

// GET ?projectId=X            → leads em Follow-up + qualquer lead aberto com follow atrasado
// GET ?projectId=X&summary=1  → só o número de atrasados (contador do menu)
export async function GET(request: Request) {
    try {
        const supabaseAuth = await createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user || !user.email) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        if (!projectId) return NextResponse.json({ error: 'Projeto é obrigatório' }, { status: 400 });

        const hoje = todayBrasilia();
        const inicioDeHoje = startOfDayBrasiliaISO(hoje);

        if (searchParams.get('summary')) {
            const { count, error } = await supabase
                .from('leads')
                .select('id_lead', { count: 'exact', head: true })
                .eq('id_projeto', projectId)
                .not('status_atual', 'in', CLOSED_FILTER)
                .lt('data_proximo_follow', inicioDeHoje);
            if (error) throw error;
            return NextResponse.json({ atrasados: count || 0 });
        }

        // Inclui leads de outros status com follow atrasado para a lista bater com o contador do menu
        const leads = await fetchAll(
            supabase
                .from('leads')
                .select(`
                    id_lead, nome, telefone, instagram, status_atual, data_proximo_follow, off_metricas, data_entrada,
                    id_sdr_responsavel, id_closer_responsavel,
                    sdr:usuarios!id_sdr_responsavel(nome),
                    closer:usuarios!id_closer_responsavel(nome)
                `)
                .eq('id_projeto', projectId)
                .not('status_atual', 'in', CLOSED_FILTER)
                .or(`status_atual.eq.Follow-up,data_proximo_follow.lt."${inicioDeHoje}"`)
                .order('id_lead', { ascending: true })
        );

        // Último follow, total de follows e quando entrou em Follow-up (em lotes para não estourar a URL)
        const leadIds = leads.map((l: any) => l.id_lead);
        const ultimoFollow: Record<number, any> = {};
        const totalFollows: Record<number, number> = {};
        const entrouEmFollow: Record<number, string> = {};
        for (let i = 0; i < leadIds.length; i += 200) {
            const batch = leadIds.slice(i, i + 200);
            const [follows, historico] = await Promise.all([
                fetchAll(
                    supabase
                        .from('follow_ups')
                        .select('id_follow, id_lead, data_feito, observacao, usuario:usuarios(nome)')
                        .in('id_lead', batch)
                        .order('id_follow', { ascending: true })
                ),
                fetchAll(
                    supabase
                        .from('lead_historico')
                        .select('id, id_lead, criado_em')
                        .in('id_lead', batch)
                        .like('acao', 'Status alterado para%Follow-up%')
                        .order('id', { ascending: true })
                ),
            ]);
            for (const f of follows) {
                totalFollows[f.id_lead] = (totalFollows[f.id_lead] || 0) + 1;
                const atual = ultimoFollow[f.id_lead];
                if (!atual || new Date(f.data_feito) >= new Date(atual.data_feito)) ultimoFollow[f.id_lead] = f;
            }
            for (const h of historico) {
                const atual = entrouEmFollow[h.id_lead];
                if (!atual || new Date(h.criado_em) >= new Date(atual)) entrouEmFollow[h.id_lead] = h.criado_em;
            }
        }

        const result = leads.map((l: any) => {
            const ultimo = ultimoFollow[l.id_lead];
            // Último contato: o mais recente entre último follow e entrada em Follow-up; sem nenhum, a entrada do lead
            const contatos = [ultimo?.data_feito, entrouEmFollow[l.id_lead]].filter(Boolean) as string[];
            const ultimoContato = contatos.length > 0
                ? contatos.reduce((a, b) => (new Date(a) >= new Date(b) ? a : b))
                : l.data_entrada || null;
            return {
                id_lead: l.id_lead,
                nome: l.nome,
                telefone: l.telefone,
                instagram: l.instagram,
                status_atual: l.status_atual,
                data_proximo_follow: l.data_proximo_follow,
                off_metricas: l.off_metricas,
                id_sdr_responsavel: l.id_sdr_responsavel,
                id_closer_responsavel: l.id_closer_responsavel,
                sdr_nome: l.sdr?.nome || null,
                closer_nome: l.closer?.nome || null,
                total_follows: totalFollows[l.id_lead] || 0,
                ultimo_contato: ultimoContato,
                ultimo_follow: ultimo
                    ? { data_feito: ultimo.data_feito, observacao: ultimo.observacao, usuario_nome: ultimo.usuario?.nome || null }
                    : null,
            };
        });

        // Vencidos primeiro (data mais antiga no topo); leads sem data por último
        result.sort((a: any, b: any) => {
            if (!a.data_proximo_follow && !b.data_proximo_follow) return a.nome.localeCompare(b.nome);
            if (!a.data_proximo_follow) return 1;
            if (!b.data_proximo_follow) return -1;
            return new Date(a.data_proximo_follow).getTime() - new Date(b.data_proximo_follow).getTime();
        });

        return NextResponse.json({ hoje, leads: result });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST { id_lead, data_proximo?: "YYYY-MM-DD", observacao? } → registra o follow feito agora
export async function POST(request: Request) {
    try {
        const supabaseAuth = await createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user || !user.email) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { id_lead, observacao } = body;
        if (!id_lead) return NextResponse.json({ error: 'Lead é obrigatório' }, { status: 400 });

        const hoje = todayBrasilia();
        const dataProximo: string = body.data_proximo || addDaysToDate(hoje, FOLLOW_DEFAULT_DAYS);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataProximo)) {
            return NextResponse.json({ error: 'Data do próximo follow inválida' }, { status: 400 });
        }
        if (dataProximo < hoje) {
            return NextResponse.json({ error: 'A data do próximo follow não pode estar no passado' }, { status: 400 });
        }

        const { data: lead, error: leadError } = await supabase
            .from('leads')
            .select('id_lead, nome, id_projeto')
            .eq('id_lead', id_lead)
            .single();
        if (leadError || !lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });

        // Quem fez o follow é identificado por id_usuario (há pessoas com nomes iguais)
        const { data: usuario } = await supabase
            .from('usuarios')
            .select('id_usuario, nome, tipo')
            .ilike('email', user.email)
            .eq('id_projeto', lead.id_projeto)
            .limit(1)
            .maybeSingle();

        const dataProximoISO = startOfDayBrasiliaISO(dataProximo);

        const { error: insertError } = await supabase.from('follow_ups').insert({
            id_lead: lead.id_lead,
            id_usuario: usuario?.id_usuario ?? null,
            id_projeto: lead.id_projeto,
            data_proximo: dataProximoISO,
            observacao: observacao?.trim() || null,
        });
        if (insertError) throw insertError;

        const { error: updateError } = await supabase
            .from('leads')
            .update({ data_proximo_follow: dataProximoISO })
            .eq('id_lead', lead.id_lead);
        if (updateError) throw updateError;

        logActivity({
            id_projeto: lead.id_projeto,
            id_usuario: usuario?.id_usuario ?? null,
            usuario_nome: usuario?.nome ?? user.email.split('@')[0],
            usuario_tipo: usuario?.tipo ?? null,
            tipo: 'follow_registrado',
            descricao: `Follow registrado com "${lead.nome}"`,
            meta: { lead_id: lead.id_lead, lead_nome: lead.nome, data_proximo: dataProximo },
        });

        return NextResponse.json({ success: true, data_proximo_follow: dataProximoISO });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
