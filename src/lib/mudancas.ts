/**
 * Avisos de "alguém salvou" entre as telas abertas do CRM (tempo real, pedido em 2026-11-27).
 * O servidor manda o aviso pelo Broadcast do Supabase Realtime (src/lib/avisarMudanca.ts) e cada tela
 * aberta busca os dados de novo (src/lib/useAoVivo.ts). O aviso leva só o tipo, o projeto e os ids
 * dos leads que mudaram, nunca dados de leads.
 */
export const CANAL_MUDANCAS = 'crm-mudancas';
export const EVENTO_MUDANCA = 'mudou';

export type TipoMudanca = 'leads' | 'vendas' | 'follow-ups' | 'chamadas' | 'metas';

/**
 * projeto null = não deu para saber de qual projeto foi; toda tela que escuta esse tipo atualiza.
 * leads = ids dos leads que mudaram, quando se sabe: o Quadro busca só esses em vez da lista inteira.
 */
export type AvisoMudanca = { tipos: TipoMudanca[]; projeto: number | null; leads?: number[] };
