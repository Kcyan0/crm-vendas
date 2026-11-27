import supabase from '@/lib/db';
import { enviarPush, inscricoesPorEmail } from '@/lib/push';
import type { AvisoPush } from '@/lib/pushChave';

/**
 * Regras dos avisos no celular (pedido em 2026-11-27):
 * - Closer: às 9h, o resumo das calls dele no dia; e 1 hora antes de cada call.
 * - Admin e Expert: às 9h, o total de calls do dia nos projetos deles.
 * - Todos do projeto: quando um lead vira Venda, o aviso com o VGV.
 * Calls = data e horário da call dos leads em Novo e Remarcado (leads.data_call), sem "Data a definir".
 * Cada aviso sai uma vez: a chave dele fica em avisos_call_enviados antes do envio.
 */

export const STATUS_COM_CALL = ['Novo', 'Remarcado'];
export const CARGOS_GESTAO = ['ADMIN', 'EXPERT'];

export const horaBrasilia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
export const formatarBRL = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

/** Marca as chaves como enviadas e devolve só as que ainda não estavam (as que podem sair agora). */
export async function marcarNovas(chaves: string[]): Promise<Set<string>> {
    if (chaves.length === 0) return new Set();
    const { data, error } = await supabase
        .from('avisos_call_enviados')
        .upsert(chaves.map((chave) => ({ chave })), { onConflict: 'chave', ignoreDuplicates: true })
        .select('chave');
    if (error) throw error;
    return new Set((data || []).map((d) => d.chave));
}

/** Manda o mesmo aviso para todos os aparelhos desses e-mails, uma vez por aparelho. Devolve quantos chegaram. */
export async function mandarParaEmails(emails: Iterable<string>, aviso: AvisoPush): Promise<number> {
    const aparelhos = await inscricoesPorEmail([...emails]);
    const vistos = new Set<string>();
    const envios: Promise<boolean>[] = [];
    for (const lista of aparelhos.values()) {
        for (const aparelho of lista) {
            if (vistos.has(aparelho.endpoint)) continue;
            vistos.add(aparelho.endpoint);
            envios.push(enviarPush(aparelho, aviso));
        }
    }
    return (await Promise.all(envios)).filter(Boolean).length;
}

/** id_usuario → e-mail (minúsculo) de quem tem e-mail cadastrado. */
export async function emailsDosUsuarios(ids: number[]): Promise<Map<number, string>> {
    const unicos = [...new Set(ids.filter(Boolean))];
    if (unicos.length === 0) return new Map();
    const { data, error } = await supabase.from('usuarios').select('id_usuario, email').in('id_usuario', unicos);
    if (error) throw error;
    return new Map((data || []).filter((u) => u.email).map((u) => [u.id_usuario, String(u.email).trim().toLowerCase()]));
}

/**
 * Aviso de venda para todo o projeto (só venda nova; editar uma venda não avisa).
 * simular: devolve o que mandaria, sem marcar nem enviar.
 */
export async function avisarVenda(dados: { idLead: number; valor: number; idCloser?: number | null }, simular = false) {
    const { data: lead, error } = await supabase.from('leads').select('nome, id_projeto').eq('id_lead', dados.idLead).single();
    if (error || !lead?.id_projeto) return { avisos: 0 };

    const [{ data: time }, emailCloser] = await Promise.all([
        supabase.from('usuarios').select('email, nome, id_usuario').eq('id_projeto', lead.id_projeto),
        dados.idCloser ? supabase.from('usuarios').select('nome').eq('id_usuario', dados.idCloser).single() : Promise.resolve({ data: null }),
    ]);
    const emails = new Set((time || []).filter((u) => u.email).map((u) => String(u.email).trim().toLowerCase()));
    const closerNome = (emailCloser as { data: { nome?: string } | null }).data?.nome;
    const aviso: AvisoPush = {
        titulo: `Venda fechada! ${formatarBRL(dados.valor)} de VGV`,
        corpo: closerNome ? `${lead.nome} · closer ${closerNome}` : lead.nome,
        url: '/',
        tag: `venda:${dados.idLead}`,
    };
    if (simular) return { aviso, pessoas: emails.size };

    const chave = `venda:${dados.idLead}`;
    if (!(await marcarNovas([chave])).has(chave)) return { avisos: 0 }; // essa venda já avisou
    return { avisos: await mandarParaEmails(emails, aviso) };
}
