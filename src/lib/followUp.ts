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
 * Quantos dias se passaram desde o dia do follow (em Brasília) até hoje.
 */
export function diasDeAtraso(dataProximo: string, hoje: string = todayBrasilia()): number {
    const dia = toBrasiliaDate(dataProximo);
    const diff = new Date(`${hoje}T12:00:00Z`).getTime() - new Date(`${dia}T12:00:00Z`).getTime();
    return Math.round(diff / 86_400_000);
}
