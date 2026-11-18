/**
 * Motivos do Loss: lista fixa para dar para analisar por que as vendas se perdem.
 * O detalhe em texto é opcional, menos em "Outro", onde é obrigatório.
 * Mudar um texto daqui não muda os leads já gravados com o texto antigo.
 */
export const MOTIVO_LOSS_OUTRO = 'Outro';

export const MOTIVOS_LOSS = [
    'Sem dinheiro / preço',
    'Não é o momento',
    'Não viu valor na oferta',
    'Sumiu / parou de responder',
    'Fechou com outro',
    'Sem perfil / não qualificado',
    MOTIVO_LOSS_OUTRO,
] as const;

/** Mensagem de erro, ou null quando motivo e detalhe estão certos. */
export function validarMotivoLoss(motivo: unknown, detalhe: unknown): string | null {
    if (typeof motivo !== 'string' || !(MOTIVOS_LOSS as readonly string[]).includes(motivo)) {
        return 'Escolha o motivo do Loss';
    }
    const textoDetalhe = typeof detalhe === 'string' ? detalhe.trim() : '';
    if (motivo === MOTIVO_LOSS_OUTRO && !textoDetalhe) {
        return 'Descreva o motivo no detalhe';
    }
    return null;
}
