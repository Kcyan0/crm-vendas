/**
 * Utilitários de data/hora para o fuso horário de Brasília (America/Sao_Paulo).
 * Use estas funções em vez de `new Date()` com getTimezoneOffset() para garantir
 * que a data e hora sempre reflitam o horário de Brasília, independentemente do
 * fuso configurado no servidor ou no navegador.
 */

const TZ = 'America/Sao_Paulo';

/**
 * Retorna uma string "YYYY-MM-DD" com a data atual em Brasília.
 */
export function todayBrasilia(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

/**
 * Retorna uma string "YYYY-MM-DDTHH:mm" com data e hora atual em Brasília,
 * pronta para ser usada em inputs do tipo datetime-local.
 */
export function nowBrasiliaLocal(): string {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(now);

    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * Converte uma string de data (vinda do banco, ex: "2024-05-01 14:30:00")
 * para o formato "YYYY-MM-DDTHH:mm" interpretando-a como horário de Brasília.
 * Útil para preencher inputs datetime-local corretamente ao editar registros.
 */
export function dbDateToBrasiliaLocal(dbStr: string): string {
    // Strings sem sufixo 'Z' ou offset são tratadas como horário local do JS (UTC).
    // Ao acrescentar '-03:00', forçamos a interpretação como Brasília.
    const normalized = dbStr.replace(' ', 'T');
    if (!normalized.includes('Z') && !normalized.includes('+') && !/\d{2}-\d{2}$/.test(normalized)) {
        // Assumir que veio sem timezone, tratar como Brasília
        return normalized.slice(0, 16);
    }
    // Com timezone explícito — converter para Brasília
    const date = new Date(normalized);
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * Converte um instante (ex: timestamptz vindo do banco) para "YYYY-MM-DD" em Brasília.
 */
export function toBrasiliaDate(value: string | Date): string {
    const date = typeof value === 'string' ? new Date(value) : value;
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

/**
 * Soma (ou subtrai, com valor negativo) dias a uma data "YYYY-MM-DD".
 */
export function addDaysToDate(dateStr: string, days: number): string {
    const date = new Date(`${dateStr}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

/**
 * Instante (ISO em UTC) em que começa o dia "YYYY-MM-DD" em Brasília.
 * Brasília não tem horário de verão desde 2019, então é sempre UTC-3.
 */
export function startOfDayBrasiliaISO(dateStr: string): string {
    return new Date(`${dateStr}T00:00:00-03:00`).toISOString();
}

/**
 * Segunda-feira da semana (segunda a domingo) que contém a data "YYYY-MM-DD".
 */
export function mondayOf(dateStr: string): string {
    const weekday = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0 = domingo
    return addDaysToDate(dateStr, -((weekday + 6) % 7));
}
