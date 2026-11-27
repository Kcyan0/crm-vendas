import webpush from 'web-push';
import supabase from '@/lib/db';
import { VAPID_CHAVE_PUBLICA, type AvisoPush } from '@/lib/pushChave';

/**
 * Envio dos avisos no celular (Web Push). Só no servidor: usa a chave privada VAPID_PRIVATE_KEY.
 * Inscrições ficam em push_inscricoes (db/add_avisos_call.sql), uma por aparelho, pelo e-mail da pessoa.
 */

export type Inscricao = { endpoint: string; p256dh: string; auth: string };

let configurado: boolean | null = null;
export function pushConfigurado(): boolean {
    if (configurado !== null) return configurado;
    const privada = process.env.VAPID_PRIVATE_KEY;
    if (!privada) return (configurado = false);
    webpush.setVapidDetails('https://crm-vendas-5cr9.vercel.app', VAPID_CHAVE_PUBLICA, privada);
    return (configurado = true);
}

/** Manda um aviso para um aparelho. Aparelho que saiu (desinstalou, trocou de celular) é apagado. */
export async function enviarPush(inscricao: Inscricao, aviso: AvisoPush): Promise<boolean> {
    if (!pushConfigurado()) return false;
    try {
        await webpush.sendNotification(
            { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } },
            JSON.stringify(aviso),
            { TTL: 60 * 60, urgency: 'high' }, // celular desligado: aviso com mais de 1 hora já não serve
        );
        return true;
    } catch (erro: unknown) {
        const status = (erro as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
            await supabase.from('push_inscricoes').delete().eq('endpoint', inscricao.endpoint);
        } else {
            console.error('Falha ao mandar aviso no celular', status, (erro as Error)?.message);
        }
        return false;
    }
}

/** Todos os aparelhos que ativaram os avisos, por e-mail (minúsculo). */
export async function inscricoesPorEmail(emails: string[]): Promise<Map<string, Inscricao[]>> {
    const mapa = new Map<string, Inscricao[]>();
    const unicos = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (unicos.length === 0) return mapa;
    const { data, error } = await supabase
        .from('push_inscricoes')
        .select('email, endpoint, p256dh, auth')
        .in('email', unicos);
    if (error) throw error;
    for (const linha of data || []) {
        const email = String(linha.email).toLowerCase();
        mapa.set(email, [...(mapa.get(email) || []), { endpoint: linha.endpoint, p256dh: linha.p256dh, auth: linha.auth }]);
    }
    return mapa;
}
