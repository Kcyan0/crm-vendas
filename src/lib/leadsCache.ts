/**
 * Cópia da lista de leads no navegador: o painel abre na hora com ela e atualiza em segundo plano.
 * Guarda dados pessoais dos leads, por isso é apagada ao sair da conta (limparCacheLeads).
 */
const PREFIXO = 'feracrm_leads_cache_v2_'; // v2: lista dos últimos 7 dias (a v1 era o banco inteiro)
const PREFIXOS_ANTIGOS = ['feracrm_leads_cache_v1_'];

export function lerCacheLeads<T>(projectId: number): T[] | null {
    try {
        // Apaga a cópia antiga (até ~700 KB por projeto) que não serve mais
        for (const key of Object.keys(localStorage)) {
            if (PREFIXOS_ANTIGOS.some((p) => key.startsWith(p))) localStorage.removeItem(key);
        }
        const raw = localStorage.getItem(PREFIXO + projectId);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : null;
    } catch {
        return null;
    }
}

export function salvarCacheLeads(projectId: number, leads: unknown[]) {
    try {
        localStorage.setItem(PREFIXO + projectId, JSON.stringify(leads));
    } catch {
        // Sem espaço ou armazenamento bloqueado: descarta a cópia antiga, o painel funciona sem ela
        try { localStorage.removeItem(PREFIXO + projectId); } catch { /* nada a fazer */ }
    }
}

export function limparCacheLeads() {
    try {
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith(PREFIXO) || PREFIXOS_ANTIGOS.some((p) => key.startsWith(p))) localStorage.removeItem(key);
        }
    } catch {
        // Armazenamento bloqueado: não há cópia para apagar
    }
}
