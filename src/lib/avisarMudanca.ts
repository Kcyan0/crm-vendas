import { after } from 'next/server';
import supabase from '@/lib/db';
import { CANAL_MUDANCAS, EVENTO_MUDANCA, type AvisoMudanca, type TipoMudanca } from '@/lib/mudancas';

/**
 * Lado do servidor dos avisos em tempo real: envolve uma rota que salva dados e, quando ela responde
 * com sucesso, avisa as telas abertas (Broadcast do Supabase Realtime, pela API HTTP).
 * O aviso sai depois da resposta (after), então não deixa o salvar mais lento, e uma falha nele
 * nunca afeta o que foi salvo: no pior caso a tela dos outros só atualiza no próximo aviso ou F5.
 * Leva o projeto (descobre pelo lead quando o pedido não traz) para telas de outros projetos não
 * buscarem à toa, e o id do lead para o Quadro buscar só ele (2026-11-27, banco sobrecarregado).
 */

const comoNumero = (valor: unknown): number | null => {
    const texto = String(valor ?? '');
    return /^\d+$/.test(texto) ? Number(texto) : null;
};

async function lerJson(mensagem: Request | Response): Promise<Record<string, unknown> | null> {
    try {
        const corpo = await mensagem.json();
        return corpo && typeof corpo === 'object' && !Array.isArray(corpo) ? corpo : null;
    } catch {
        return null; // sem corpo ou corpo que não é JSON
    }
}

async function projetoDoLead(idLead: number): Promise<number | null> {
    const { data } = await supabase.from('leads').select('id_projeto').eq('id_lead', idLead).maybeSingle();
    return comoNumero(data?.id_projeto);
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

/**
 * Uso: `export const PUT = comAviso(['leads'], salvarLead);`
 * leadNaUrl: nome do parâmetro da URL com o id do lead (ex.: DELETE /api/leads?id=123).
 */
export function comAviso<R extends Request>(tipos: TipoMudanca[], rota: (pedido: R) => Promise<Response>, opcoes: { leadNaUrl?: string } = {}) {
    return async (pedido: R): Promise<Response> => {
        const copiaPedido = pedido.clone(); // a rota consome o corpo; a cópia serve para achar lead e projeto
        const url = new URL(pedido.url);
        const leadDaUrl = opcoes.leadNaUrl ? comoNumero(url.searchParams.get(opcoes.leadNaUrl)) : null;
        // Ao apagar, o lead some: o projeto precisa ser lido antes
        const projetoAntes = pedido.method === 'DELETE' && leadDaUrl !== null ? await projetoDoLead(leadDaUrl) : null;

        const resposta = await rota(pedido);
        if (!resposta.ok) return resposta;

        const copiaResposta = resposta.clone(); // lead novo: o id só vem na resposta
        after(async () => {
            const corpo = await lerJson(copiaPedido);
            const idLead = comoNumero(corpo?.id_lead) ?? leadDaUrl ?? comoNumero((await lerJson(copiaResposta))?.id_lead);
            let projeto = comoNumero(url.searchParams.get('projectId') ?? url.searchParams.get('id_projeto'))
                ?? comoNumero(corpo?.id_projeto ?? corpo?.projectId)
                ?? projetoAntes;
            if (projeto === null && idLead !== null) projeto = await projetoDoLead(idLead);
            await enviarAviso({ tipos, projeto, ...(idLead !== null ? { leads: [idLead] } : {}) });
        });
        return resposta;
    };
}
