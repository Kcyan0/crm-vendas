import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import supabase from '@/lib/db';
import { fetchAll } from '@/lib/fetchAll';
import { todayBrasilia, addDaysToDate, startOfDayBrasiliaISO, mondayOf } from '@/lib/brasilia';

type Destaque = {
    valor: number;
    pessoas: { id_usuario: number; nome: string; cargo: string | null }[];
} | null;

// GET ?projectId=X → destaques da semana atual (segunda a domingo, fuso de Brasília)
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

        const segunda = mondayOf(todayBrasilia());
        const domingo = addDaysToDate(segunda, 6);
        const inicio = startOfDayBrasiliaISO(segunda);
        const fim = startOfDayBrasiliaISO(addDaysToDate(segunda, 7));

        // Nome e cargo por id_usuario (nunca por nome: há pessoas com nomes iguais)
        const usuarios = await fetchAll(
            supabase.from('usuarios').select('id_usuario, nome, tipo').order('id_usuario', { ascending: true })
        );
        const usersMap: Record<number, { nome: string; tipo: string | null }> = {};
        for (const u of usuarios) usersMap[u.id_usuario] = { nome: u.nome, tipo: u.tipo ?? null };

        // Inclui leads off_metricas: nos destaques contam todas as vendas e follows (pedido em 28/10/2026),
        // diferente do ranking do time na dashboard, que deixa os OFF de fora
        const leads = await fetchAll(
            supabase
                .from('leads')
                .select('id_lead, id_closer_responsavel, status_atual')
                .eq('id_projeto', projectId)
                .order('id_lead', { ascending: true })
        );
        const leadMap: Record<number, { closer: number | null; status: string }> = {};
        for (const l of leads) leadMap[l.id_lead] = { closer: l.id_closer_responsavel ?? null, status: l.status_atual };

        // ─── Vendas da semana (pago + pendente), uma por oportunidade como na dashboard ──
        const vendas = await fetchAll(
            supabase
                .from('vendas')
                .select('id_venda, id_oportunidade, id_lead, id_closer, valor_bruto')
                .in('status_pagamento', ['pago', 'pendente'])
                .gte('data_venda', inicio)
                .lt('data_venda', fim)
                .order('id_venda', { ascending: true })
        );
        const porOportunidade: Record<string, { closer: number | null; valor: number }> = {};
        for (const v of vendas) {
            const lead = leadMap[v.id_lead];
            if (!lead || lead.status === 'Reembolsado' || lead.status === 'Loss') continue;
            const chave = v.id_oportunidade ? `o${v.id_oportunidade}` : `l${v.id_lead}`;
            if (!porOportunidade[chave]) porOportunidade[chave] = { closer: null, valor: 0 };
            // Closer da venda; sem ele, o closer responsável pelo lead
            porOportunidade[chave].closer ??= v.id_closer ?? lead.closer;
            porOportunidade[chave].valor += parseFloat(v.valor_bruto) || 0;
        }
        const vendasPorUsuario: Record<number, number> = {};
        const faturamentoPorUsuario: Record<number, number> = {};
        for (const venda of Object.values(porOportunidade)) {
            if (!venda.closer) continue;
            vendasPorUsuario[venda.closer] = (vendasPorUsuario[venda.closer] || 0) + 1;
            faturamentoPorUsuario[venda.closer] = (faturamentoPorUsuario[venda.closer] || 0) + venda.valor;
        }

        // ─── Follows registrados na semana ────────────────────────────────────────
        const follows = await fetchAll(
            supabase
                .from('follow_ups')
                .select('id_follow, id_lead, id_usuario')
                .eq('id_projeto', projectId)
                .gte('data_feito', inicio)
                .lt('data_feito', fim)
                .order('id_follow', { ascending: true })
        );
        const followsPorUsuario: Record<number, number> = {};
        for (const f of follows) {
            if (!f.id_usuario || !leadMap[f.id_lead]) continue;
            followsPorUsuario[f.id_usuario] = (followsPorUsuario[f.id_usuario] || 0) + 1;
        }

        // Em caso de empate, todos com o maior número aparecem
        const destaque = (porUsuario: Record<number, number>): Destaque => {
            const valores = Object.values(porUsuario);
            const maior = valores.length > 0 ? Math.max(...valores) : 0;
            if (maior <= 0) return null;
            const pessoas = Object.entries(porUsuario)
                .filter(([, valor]) => Math.abs(valor - maior) < 0.005)
                .map(([id]) => ({
                    id_usuario: Number(id),
                    nome: usersMap[Number(id)]?.nome || 'Desconhecido',
                    cargo: usersMap[Number(id)]?.tipo ?? null,
                }))
                .sort((a, b) => a.nome.localeCompare(b.nome));
            return { valor: maior, pessoas };
        };

        return NextResponse.json({
            semana: { inicio: segunda, fim: domingo },
            maisVendeu: destaque(vendasPorUsuario),
            maisFollow: destaque(followsPorUsuario),
            maisResultado: destaque(faturamentoPorUsuario),
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
