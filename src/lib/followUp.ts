import { todayBrasilia, toBrasiliaDate } from '@/lib/brasilia';

// Leads nestes status saíram do funil: follow vencido não conta como atrasado.
export const FOLLOW_CLOSED_STATUSES = ['Venda', 'Loss', 'Reembolsado', 'Nao prosseguiu'];

// Prazo do próximo follow quando quem registra não informa a data.
export const FOLLOW_DEFAULT_DAYS = 2;

// Avisa o menu lateral para atualizar o contador de atrasados.
export const FOLLOWUPS_CHANGED_EVENT = 'followups:changed';

export type FollowSituacao = 'atrasado' | 'hoje' | 'agendado' | 'sem_data';

/**
 * Situação do follow de um lead, comparando dias no fuso de Brasília.
 * Atrasado = próximo follow marcado para um dia anterior a hoje.
 * Retorna null para leads fechados (Venda, Loss, Reembolsado, Nao prosseguiu).
 */
export function followSituacao(
    dataProximo: string | null | undefined,
    status: string,
    hoje: string = todayBrasilia()
): FollowSituacao | null {
    if (FOLLOW_CLOSED_STATUSES.includes(status)) return null;
    if (!dataProximo) return 'sem_data';
    const dia = toBrasiliaDate(dataProximo);
    if (dia < hoje) return 'atrasado';
    if (dia === hoje) return 'hoje';
    return 'agendado';
}

/**
 * Quantos dias se passaram desde o dia da data (em Brasília) até hoje.
 */
export function diasDesde(data: string, hoje: string = todayBrasilia()): number {
    const dia = toBrasiliaDate(data);
    const diff = new Date(`${hoje}T12:00:00Z`).getTime() - new Date(`${dia}T12:00:00Z`).getTime();
    return Math.round(diff / 86_400_000);
}

/**
 * Quantos dias se passaram desde o dia do follow (em Brasília) até hoje.
 */
export function diasDeAtraso(dataProximo: string, hoje: string = todayBrasilia()): number {
    return diasDesde(dataProximo, hoje);
}

// Crítico: follow atrasado há 3+ dias, ou parado sem contato de 7 a 30 dias (ainda dá para recuperar).
// Esquecido: mais de 30 dias sem atenção, provavelmente perdido.
export const CRITICO_ATRASO_DIAS = 3;
export const CRITICO_PARADO_DIAS = 7;
export const ESQUECIDO_DIAS = 30;

export type FollowPrioridade = 'critico' | 'esquecido';

export type FollowAtencao = {
    prioridade: FollowPrioridade | null;
    dias: number;              // dias de atraso, ou dias sem contato quando não há follow marcado
    motivo: 'atraso' | 'parado';
};

/**
 * Há quanto tempo o lead espera atenção e se isso o torna crítico ou esquecido.
 * ultimoContato = último follow registrado ou, sem nenhum, quando o lead entrou em Follow-up.
 * Retorna null quando o próximo follow é hoje ou no futuro, ou o lead está fechado.
 */
export function followAtencao(
    dataProximo: string | null | undefined,
    status: string,
    ultimoContato: string | null | undefined,
    hoje: string = todayBrasilia()
): FollowAtencao | null {
    const situacao = followSituacao(dataProximo, status, hoje);
    let dias: number;
    let motivo: FollowAtencao['motivo'];
    if (situacao === 'atrasado' && dataProximo) {
        dias = diasDesde(dataProximo, hoje);
        motivo = 'atraso';
    } else if (situacao === 'sem_data' && ultimoContato) {
        dias = diasDesde(ultimoContato, hoje);
        motivo = 'parado';
    } else {
        return null;
    }
    const limite = motivo === 'atraso' ? CRITICO_ATRASO_DIAS : CRITICO_PARADO_DIAS;
    const prioridade = dias > ESQUECIDO_DIAS ? 'esquecido' : dias >= limite ? 'critico' : null;
    return { prioridade, dias, motivo };
}
