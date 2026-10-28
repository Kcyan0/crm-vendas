/**
 * Cópia da lista de leads no navegador: o painel abre na hora com ela e atualiza em segundo plano.
 * Guarda dados pessoais dos leads, por isso é apagada ao sair da conta (limparCacheLeads).
 */
const PREFIXO = 'feracrm_leads_cache_v1_';

export function lerCacheLeads<T>(projectId: number): T[] | null {
    try {
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
            if (key.startsWith(PREFIXO)) localStorage.removeItem(key);
        }
    } catch {
        // Armazenamento bloqueado: não há cópia para apagar
    }
}
