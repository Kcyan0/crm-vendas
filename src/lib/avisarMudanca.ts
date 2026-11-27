import { after } from 'next/server';
import { CANAL_MUDANCAS, EVENTO_MUDANCA, type AvisoMudanca, type TipoMudanca } from '@/lib/mudancas';

/**
 * Lado do servidor dos avisos em tempo real: envolve uma rota que salva dados e, quando ela responde
 * com sucesso, avisa as telas abertas (Broadcast do Supabase Realtime, pela API HTTP).
 * O aviso sai depois da resposta (after), então não deixa o salvar mais lento, e uma falha nele
 * nunca afeta o que foi salvo: no pior caso a tela dos outros só atualiza no próximo aviso ou F5.
 */

const comoNumero = (valor: unknown): number | null => {
    const texto = String(valor ?? '');
    return /^\d+$/.test(texto) ? Number(texto) : null;
};

// Projeto da mudança, quando o pedido traz (na URL ou no corpo); sem ele o aviso vale para todos
async function projetoDoPedido(pedido: Request): Promise<number | null> {
    const url = new URL(pedido.url);
    const daUrl = comoNumero(url.searchParams.get('projectId') ?? url.searchParams.get('id_projeto'));
    if (daUrl !== null) return daUrl;
    try {
        const corpo = await pedido.json();
        return comoNumero(corpo?.id_projeto ?? corpo?.projectId);
    } catch {
        return null; // sem corpo ou corpo que não é JSON
    }
}

async function enviarAviso(aviso: AvisoMudanca) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !chave) return;
    try {
        await fetch(`${url}/realtime/v1/api/broadcast`, {
            method: 'POST',
            headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ topic: CANAL_MUDANCAS, event: EVENTO_MUDANCA, payload: aviso, private: false }] }),
            signal: AbortSignal.timeout(5000),
        });
    } catch {
        // O aviso é só conveniência: o dado já foi salvo
    }
}

/** Uso: `export const PUT = comAviso(['leads'], salvarLead);` */
export function comAviso<R extends Request>(tipos: TipoMudanca[], rota: (pedido: R) => Promise<Response>) {
    return async (pedido: R): Promise<Response> => {
        const copia = pedido.clone(); // a rota consome o corpo; a cópia serve para achar o projeto
        const resposta = await rota(pedido);
        if (resposta.ok) after(async () => enviarAviso({ tipos, projeto: await projetoDoPedido(copia) }));
        return resposta;
    };
}
