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
