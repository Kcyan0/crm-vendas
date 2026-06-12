import supabase from '@/lib/db';

export interface LogParams {
    id_projeto?: number | null;
    id_usuario?: number | null;
    usuario_nome?: string | null;
    usuario_tipo?: string | null;  // 'ADMIN' | 'EXPERT' | 'CLOSER' | 'SDR'
    tipo: string;
    descricao: string;
    meta?: Record<string, any>;
}

/**
 * Fire-and-forget activity logger.
 * Never throws — logging failures must never break the main operation.
 */
export function logActivity(params: LogParams): void {
    const meta = {
        ...(params.meta ?? {}),
        // Always embed the actor's role in meta so UI can display it
        ...(params.usuario_tipo ? { usuario_tipo: params.usuario_tipo } : {}),
    };
    supabase
        .from('atividades_log')
        .insert({
            id_projeto:   params.id_projeto   ?? null,
            id_usuario:   params.id_usuario   ?? null,
            usuario_nome: params.usuario_nome ?? 'Sistema',
            tipo:         params.tipo,
            descricao:    params.descricao,
            meta,
        })
        .then(({ error }) => {
            if (error) console.error('[logActivity]', error.message);
        });
}
