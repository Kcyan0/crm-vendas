import { addDaysToDate, dbDateToBrasiliaLocal, startOfDayBrasiliaISO } from './brasilia';

/**
 * Data de referência do lead nos filtros e contagens por período: a data da call;
 * sem call, a data de entrada.
 */

type Limites = { gte?: string; lt?: string; lte?: string };

const condicoes = (coluna: string, limites: Limites) =>
    Object.entries(limites).filter(([, v]) => v).map(([op, v]) => `${coluna}.${op}.${v}`).join(',');

/**
 * Filtro para o .or() do Supabase: call no período, ou sem call e entrada no período.
 * data_call é um instante (gravada com -03:00), então o dia de Brasília começa às 03:00Z.
 * Os limites de data_entrada vêm de cada tela, que já tinha o seu critério para ela.
 */
export function filtroCallOuEntrada(startDate: string | null, endDate: string | null, entrada: Limites): string {
    const call = condicoes('data_call', {
        gte: startDate ? startOfDayBrasiliaISO(startDate) : undefined,
        lt: endDate ? startOfDayBrasiliaISO(addDaysToDate(endDate, 1)) : undefined,
    });
    return `and(${call}),and(data_call.is.null,${condicoes('data_entrada', entrada)})`;
}

/**
 * "YYYY-MM-DDTHH:mm" no horário de Brasília, para ordenar pela data de referência.
 * data_entrada fica com a hora de Brasília como foi digitada, então é lida sem converter.
 */
export function dataDeReferenciaLocal(lead: { data_call?: string | null; data_entrada?: string | null }): string {
    if (lead.data_call) return dbDateToBrasiliaLocal(lead.data_call);
    return lead.data_entrada ? lead.data_entrada.replace(' ', 'T').slice(0, 16) : '';
}
