/**
 * Largura de cada quadro da Dashboard, escolhida no modo Layout (pedido em 2026-11-26).
 * Fica nas prefs do usuário ao lado da ordem e dos ocultos: prefs["larguras:<projeto>"] = { idDoQuadro: 1..4 }.
 * O número é quantas das 4 colunas o quadro ocupa na tela grande; na média a grade tem 2 colunas e no celular 1.
 */

export type Largura = 1 | 2 | 3 | 4;

// Classes escritas por extenso para o Tailwind gerar todas
export const CLASSE_LARGURA: Record<Largura, string> = {
    1: 'col-span-1',
    2: 'col-span-1 md:col-span-2',
    3: 'col-span-1 md:col-span-2 xl:col-span-3',
    4: 'col-span-1 md:col-span-2 xl:col-span-4',
};

export const NOME_LARGURA: Record<Largura, string> = {
    1: '1/4 da linha',
    2: 'metade da linha',
    3: '3/4 da linha',
    4: 'linha inteira',
};

/** Largura de fábrica do quadro, a partir das classes que ele já tinha. */
export const larguraPadrao = (colSpan: string): Largura =>
    colSpan.includes('xl:col-span-4') ? 4 : colSpan.includes('md:col-span-2') ? 2 : 1;

/** Só aceita 1 a 4 vindos das prefs (o resto volta ao padrão do quadro). */
export function lerLarguras(valor: unknown): Record<string, Largura> {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
    const out: Record<string, Largura> = {};
    for (const [id, l] of Object.entries(valor as Record<string, unknown>)) {
        if (l === 1 || l === 2 || l === 3 || l === 4) out[id] = l;
    }
    return out;
}
