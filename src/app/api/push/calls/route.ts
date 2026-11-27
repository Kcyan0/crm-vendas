import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { enviarPush, inscricoesPorEmail, pushConfigurado } from '@/lib/push';

/**
 * Relógio dos avisos de call (2026-11-27): o banco chama esta rota a cada minuto (pg_cron, ver
 * db/add_avisos_call.sql) e ela avisa no celular o closer e o SDR de cada call dos próximos 15 minutos.
 * A call é a data e o horário colocados no lead ao criar em "Novo" ou ao mover para "Remarcado"
 * (leads.data_call), só de leads nesses dois status; a agenda do Calendário não entra (pedido em 2026-11-27).
 * Cada call avisa uma vez (avisos_call_enviados); remarcada para outro horário avisa de novo.
 * Protegida pelo CRON_SECRET: só o relógio do banco chama.
 */

export const dynamic = 'force-dynamic';

const ANTECEDENCIA_MIN = 15;
const STATUS_COM_CALL = ['Novo', 'Remarcado'];

const horaBrasilia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

type Call = { chave: string; inicio: Date; nome: string; pessoas: Set<number> };

export async function GET(request: Request) {
    const segredo = process.env.CRON_SECRET;
    if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!pushConfigurado()) return NextResponse.json({ error: 'VAPID_PRIVATE_KEY não configurada' }, { status: 503 });

    try {
        const agora = new Date();
        const ate = new Date(agora.getTime() + ANTECEDENCIA_MIN * 60_000);

        const { data: leads, error: erroLeads } = await supabase.from('leads')
            .select('id_lead, nome, data_call, id_sdr_responsavel, id_closer_responsavel')
            .in('status_atual', STATUS_COM_CALL)
            .eq('call_a_definir', false) // Remarcado com "Data a definir" ainda não tem horário novo
            .gt('data_call', agora.toISOString()).lte('data_call', ate.toISOString());
        if (erroLeads) throw erroLeads;

        const calls: Call[] = (leads || []).map((l) => {
            const inicio = new Date(l.data_call);
            return {
                chave: `lead:${l.id_lead}:${inicio.toISOString().slice(0, 16)}`, inicio, nome: l.nome,
                pessoas: new Set([l.id_closer_responsavel, l.id_sdr_responsavel].filter(Boolean) as number[]),
            };
        });
        if (calls.length === 0) return NextResponse.json({ calls: 0, avisos: 0 });

        // Marca como avisada antes de mandar: só segue quem ainda não estava marcado (evita aviso dobrado)
        const { data: novas, error: erroMarca } = await supabase
            .from('avisos_call_enviados')
            .upsert(calls.map((c) => ({ chave: c.chave })), { onConflict: 'chave', ignoreDuplicates: true })
            .select('chave');
        if (erroMarca) throw erroMarca;
        const chavesNovas = new Set((novas || []).map((n) => n.chave));
        const aAvisar = calls.filter((c) => chavesNovas.has(c.chave));
        if (aAvisar.length === 0) return NextResponse.json({ calls: calls.length, avisos: 0 });

        // id_usuario → e-mail → aparelhos
        const ids = [...new Set(aAvisar.flatMap((c) => [...c.pessoas]))];
        const { data: usuarios, error: erroUsuarios } = ids.length
            ? await supabase.from('usuarios').select('id_usuario, email').in('id_usuario', ids)
            : { data: [], error: null };
        if (erroUsuarios) throw erroUsuarios;
        const emailDe = new Map((usuarios || []).filter((u) => u.email).map((u) => [u.id_usuario, String(u.email).toLowerCase()]));
        const aparelhos = await inscricoesPorEmail([...emailDe.values()]);

        let avisos = 0;
        const envios: Promise<void>[] = [];
        for (const call of aAvisar) {
            const minutos = Math.max(1, Math.round((call.inicio.getTime() - agora.getTime()) / 60_000));
            const aviso = {
                titulo: `Call em ${minutos} min · ${horaBrasilia.format(call.inicio)}`,
                corpo: call.nome,
                url: '/',
                tag: call.chave,
            };
            // A mesma pessoa pode ser closer e SDR, ou ter o mesmo e-mail em dois projetos: um aviso por aparelho
            const emails = new Set([...call.pessoas].map((id) => emailDe.get(id)).filter(Boolean) as string[]);
            const endpoints = new Set<string>();
            for (const email of emails) {
                for (const aparelho of aparelhos.get(email) || []) {
                    if (endpoints.has(aparelho.endpoint)) continue;
                    endpoints.add(aparelho.endpoint);
                    envios.push(enviarPush(aparelho, aviso).then((ok) => { if (ok) avisos++; }));
                }
            }
        }
        await Promise.all(envios);
        return NextResponse.json({ calls: calls.length, novas: aAvisar.length, avisos });
    } catch (erro) {
        const error = erro as { message?: string };
        console.error('Erro nos avisos de call', error?.message);
        return NextResponse.json({ error: error?.message || 'Erro nos avisos de call' }, { status: 500 });
    }
}
