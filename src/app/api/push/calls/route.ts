import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { pushConfigurado } from '@/lib/push';
import type { AvisoPush } from '@/lib/pushChave';
import { todayBrasilia, startOfDayBrasiliaISO } from '@/lib/brasilia';
import { CARGOS_GESTAO, STATUS_COM_CALL, emailsDosUsuarios, horaBrasilia, mandarParaEmails, marcarNovas } from '@/lib/avisosPush';

/**
 * Relógio dos avisos (2026-11-27): o banco chama esta rota a cada minuto (pg_cron, ver
 * db/add_avisos_call.sql). Regras em src/lib/avisosPush.ts:
 * - 1 hora antes de cada call, aviso para o closer do lead;
 * - às 9h (Brasília), resumo do dia: closer recebe as calls dele; Admin e Expert, o total do time.
 * ?simular=1 mostra o que mandaria agora, sem marcar nem enviar (para testar).
 * Protegida pelo CRON_SECRET: só o relógio do banco chama.
 */

export const dynamic = 'force-dynamic';

const ANTECEDENCIA_MIN = 60;
// Resumo sai às 9h; se o relógio ficou parado, ainda sai até o meio-dia, depois disso não faz sentido
const RESUMO_DAS = 9;
const RESUMO_ATE = 12;

type Envio = { chave: string; emails: Set<string>; aviso: AvisoPush };
type LeadCall = { id_lead: number; nome: string; data_call: string; id_closer_responsavel: number | null; id_projeto: number | null };

const horaAgoraBrasilia = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()));

async function callsEntre(de: Date, ate: Date): Promise<LeadCall[]> {
    const { data, error } = await supabase.from('leads')
        .select('id_lead, nome, data_call, id_closer_responsavel, id_projeto')
        .in('status_atual', STATUS_COM_CALL)
        .eq('call_a_definir', false) // Remarcado com "Data a definir" ainda não tem horário
        .gt('data_call', de.toISOString()).lte('data_call', ate.toISOString())
        .order('data_call');
    if (error) throw error;
    return (data || []) as LeadCall[];
}

// 1 hora antes: um aviso por call, para o closer do lead
async function avisosDaHora(agora: Date): Promise<Envio[]> {
    const calls = await callsEntre(agora, new Date(agora.getTime() + ANTECEDENCIA_MIN * 60_000));
    const emailDe = await emailsDosUsuarios(calls.map((c) => c.id_closer_responsavel as number));
    return calls.flatMap((c) => {
        const email = c.id_closer_responsavel ? emailDe.get(c.id_closer_responsavel) : undefined;
        if (!email) return [];
        const inicio = new Date(c.data_call);
        const minutos = Math.max(1, Math.round((inicio.getTime() - agora.getTime()) / 60_000));
        const falta = minutos >= 55 ? '1 hora' : `${minutos} min`;
        const chave = `1h:lead:${c.id_lead}:${inicio.toISOString().slice(0, 16)}`; // remarcada = outra chave, avisa de novo
        return [{ chave, emails: new Set([email]), aviso: { titulo: `Call em ${falta} · ${horaBrasilia.format(inicio)}`, corpo: c.nome.trim(), url: '/', tag: chave } }];
    });
}

// 9h: resumo do dia para cada closer (as calls dele) e para Admin/Expert (total do time nos projetos deles).
// Conta as calls que ainda vão acontecer hoje (se o resumo atrasar, as que já passaram ficam de fora).
async function resumosDoDia(agora: Date): Promise<Envio[]> {
    const hoje = todayBrasilia();
    const fimDoDia = new Date(new Date(startOfDayBrasiliaISO(hoje)).getTime() + 24 * 3600_000 - 1);
    const calls = await callsEntre(agora, fimDoDia);
    const envios: Envio[] = [];

    // Closer: por e-mail (a mesma pessoa tem um id_usuario em cada projeto)
    const emailDe = await emailsDosUsuarios(calls.map((c) => c.id_closer_responsavel as number));
    const porCloser = new Map<string, LeadCall[]>();
    for (const c of calls) {
        const email = c.id_closer_responsavel ? emailDe.get(c.id_closer_responsavel) : undefined;
        if (email) porCloser.set(email, [...(porCloser.get(email) || []), c]);
    }
    for (const [email, minhas] of porCloser) {
        const lista = minhas.map((c) => `${horaBrasilia.format(new Date(c.data_call))} ${c.nome.trim().split(/\s+/)[0]}`);
        envios.push({
            chave: `resumo:${hoje}:closer:${email}`,
            emails: new Set([email]),
            aviso: {
                titulo: `Bom dia! ${minhas.length === 1 ? 'Você tem 1 call hoje' : `Você tem ${minhas.length} calls hoje`}`,
                corpo: lista.length > 6 ? `${lista.slice(0, 6).join(' · ')} e mais ${lista.length - 6}` : lista.join(' · '),
                url: '/', tag: `resumo-closer-${hoje}`,
            },
        });
    }

    // Admin e Expert: total de calls do dia nos projetos em que estão
    const [{ data: gestores, error: erroGestores }, { data: projetos }] = await Promise.all([
        supabase.from('usuarios').select('email, id_projeto, tipo').in('tipo', CARGOS_GESTAO),
        supabase.from('projetos').select('id_projeto, nome'),
    ]);
    if (erroGestores) throw erroGestores;
    const nomeProjeto = new Map((projetos || []).map((p) => [p.id_projeto, p.nome]));
    const projetosDe = new Map<string, Set<number>>();
    for (const g of gestores || []) {
        if (!g.email || !g.id_projeto) continue;
        const email = String(g.email).trim().toLowerCase();
        projetosDe.set(email, (projetosDe.get(email) || new Set()).add(g.id_projeto));
    }
    for (const [email, meus] of projetosDe) {
        const porProjeto = [...meus].map((id) => ({ id, total: calls.filter((c) => c.id_projeto === id).length }))
            .filter((p) => p.total > 0)
            .sort((a, b) => b.total - a.total || String(nomeProjeto.get(a.id)).localeCompare(String(nomeProjeto.get(b.id))));
        const total = porProjeto.reduce((s, p) => s + p.total, 0);
        if (total === 0) continue; // dia sem call: não manda aviso vazio
        const primeira = calls.find((c) => c.id_projeto !== null && meus.has(c.id_projeto));
        envios.push({
            chave: `resumo:${hoje}:gestao:${email}`,
            emails: new Set([email]),
            aviso: {
                titulo: `Bom dia! ${total === 1 ? '1 call hoje no time' : `${total} calls hoje no time`}`,
                corpo: porProjeto.length > 1
                    ? porProjeto.map((p) => `${nomeProjeto.get(p.id) || 'Projeto'}: ${p.total}`).join(' · ')
                    : `A primeira é às ${horaBrasilia.format(new Date(primeira!.data_call))}`,
                url: '/dashboard', tag: `resumo-gestao-${hoje}`,
            },
        });
    }
    return envios;
}

export async function GET(request: Request) {
    const segredo = process.env.CRON_SECRET;
    if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!pushConfigurado()) return NextResponse.json({ error: 'VAPID_PRIVATE_KEY não configurada' }, { status: 503 });
    const simular = new URL(request.url).searchParams.get('simular') === '1';

    try {
        const agora = new Date();
        const hora = horaAgoraBrasilia();
        const ehHoraDoResumo = (hora >= RESUMO_DAS && hora < RESUMO_ATE) || simular;
        const envios = [...await avisosDaHora(agora), ...(ehHoraDoResumo ? await resumosDoDia(agora) : [])];

        if (simular) {
            return NextResponse.json({
                simulacao: true, horaBrasilia: hora,
                envios: envios.map((e) => ({ tipo: e.chave.split(':').slice(0, 2).join(':'), pessoas: e.emails.size, titulo: e.aviso.titulo, corpo: e.aviso.corpo })),
            });
        }
        if (envios.length === 0) return NextResponse.json({ envios: 0, avisos: 0 });

        // Marca antes de mandar: só segue o que ainda não tinha saído (evita aviso dobrado)
        const novas = await marcarNovas(envios.map((e) => e.chave));
        const aMandar = envios.filter((e) => novas.has(e.chave));
        const avisos = (await Promise.all(aMandar.map((e) => mandarParaEmails(e.emails, e.aviso)))).reduce((s, n) => s + n, 0);
        return NextResponse.json({ envios: envios.length, novos: aMandar.length, avisos });
    } catch (erro) {
        const error = erro as { message?: string };
        console.error('Erro nos avisos', error?.message);
        return NextResponse.json({ error: error?.message || 'Erro nos avisos' }, { status: 500 });
    }
}
