/**
 * Busca todas as linhas de uma consulta do Supabase, de 1000 em 1000.
 * O Supabase devolve no máximo 1000 linhas por consulta e corta o resto sem erro.
 * A consulta precisa de um .order() estável para a paginação não repetir nem pular linhas.
 */
export async function fetchAll(queryBuilder: any) {
    let allData: any[] = [];
    let from = 0;
    const step = 999;
    while (true) {
        const { data, error } = await queryBuilder.range(from, from + step);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length <= step) break;
        from += step + 1;
    }
    return allData;
}
