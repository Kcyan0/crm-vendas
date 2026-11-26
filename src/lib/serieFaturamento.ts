import { addDaysToDate, toBrasiliaDate } from './brasilia';

/**
 * Série do gráfico "Faturamento no período" da Dashboard (pedido em 2026-11-25).
 * Mesma regra da Receita Bruta: quem chama passa as mesmas linhas (pago + pendente) que entram
 * na Receita Bruta; aqui elas são somadas pelo dia da venda em Brasília.
 */

export type PontoFaturamento = { inicio: string; fim: string; valor: number };
export type SerieFaturamento = { agrupamento: 'dia' | 'semana'; pontos: PontoFaturamento[] };

/** Até esse número de dias (um trimestre) o gráfico vai dia a dia; acima, por semana. */
export const MAX_DIAS_SERIE_DIARIA = 92;

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const centavos = (valor: unknown) => Math.round((parseFloat(String(valor)) || 0) * 100);

export function serieFaturamento(
    vendas: { data_venda: string; valor_bruto: unknown }[],
    inicio: string,
    fim: string,
): SerieFaturamento {
    if (!DATA_ISO.test(inicio) || !DATA_ISO.test(fim) || inicio > fim) return { agrupamento: 'dia', pontos: [] };

    // Soma em centavos: a soma dos pontos bate com a Receita Bruta sem sobra de arredondamento
    const porDia = new Map<string, number>();
    for (const v of vendas) {
        if (!v.data_venda) continue;
        const dia = toBrasiliaDate(v.data_venda);
        porDia.set(dia, (porDia.get(dia) || 0) + centavos(v.valor_bruto));
    }

    // Todos os dias do período, com 0 nos dias sem venda, para a linha não pular dias
    const dias: string[] = [];
    for (let d = inicio; d <= fim; d = addDaysToDate(d, 1)) dias.push(d);

    if (dias.length <= MAX_DIAS_SERIE_DIARIA) {
        return { agrupamento: 'dia', pontos: dias.map(d => ({ inicio: d, fim: d, valor: (porDia.get(d) || 0) / 100 })) };
    }

    // Semanas de segunda a domingo; a primeira e a última são cortadas no limite do período
    const semanas: { inicio: string; fim: string; centavos: number }[] = [];
    for (const d of dias) {
        const diaDaSemana = new Date(`${d}T12:00:00Z`).getUTCDay(); // 0 = domingo
        const segunda = addDaysToDate(d, -((diaDaSemana + 6) % 7));
        const atual = semanas[semanas.length - 1];
        if (!atual || segunda > atual.inicio) {
            const domingo = addDaysToDate(segunda, 6);
            semanas.push({ inicio: segunda < inicio ? inicio : segunda, fim: domingo > fim ? fim : domingo, centavos: 0 });
        }
        semanas[semanas.length - 1].centavos += porDia.get(d) || 0;
    }
    return { agrupamento: 'semana', pontos: semanas.map(s => ({ inicio: s.inicio, fim: s.fim, valor: s.centavos / 100 })) };
}
