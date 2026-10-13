import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

const DEFAULT_PASSWORD = '000000'; // Mínimo de 6 caracteres exigido pelo Supabase Auth

/**
 * Cria ou atualiza conta no Supabase Auth (auth.users) para um email.
 * Usa a Service Role Key para poder chamar auth.admin.
 */
async function ensureAuthUser(email: string, password?: string) {
    if (!email) return;
    const cleanEmail = email.toLowerCase().trim();
    // '0000' ou vazio mapeia para DEFAULT_PASSWORD ('000000') para cumprir a regra de min 6 chars do Supabase Auth
    let pwd = DEFAULT_PASSWORD;
    if (password && password.trim()) {
        const trimmed = password.trim();
        pwd = (trimmed === '0000') ? DEFAULT_PASSWORD : (trimmed.length >= 6 ? trimmed : DEFAULT_PASSWORD);
    }
    try {
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) {
            console.error('[Auth] Erro ao listar usuários:', listError);
            return;
        }
        const existing = users?.find((u: any) => u.email?.toLowerCase().trim() === cleanEmail);
        if (!existing) {
            const { error: createError } = await supabase.auth.admin.createUser({
                email: cleanEmail,
                password: pwd,
                email_confirm: true
            });
            if (createError) {
                console.error(`[Auth] Erro ao criar conta para ${cleanEmail}:`, createError);
            } else {
                console.log(`[Auth] Conta criada com sucesso para: ${cleanEmail}`);
            }
        } else if (password && password.trim()) {
            // Se forneceu uma senha específica, atualiza a senha no Auth
            const { error: updError } = await supabase.auth.admin.updateUserById(existing.id, { password: pwd });
            if (updError) {
                console.error(`[Auth] Erro ao atualizar senha para ${cleanEmail}:`, updError);
            } else {
                console.log(`[Auth] Senha atualizada para: ${cleanEmail}`);
            }
        }
    } catch (err) {
        console.error('[Auth] Erro ao gerenciar conta auth:', err);
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        let query = supabase
            .from('usuarios')
            .select('id_usuario, nome, email, tipo, ativo, salario_fixo_mensal, percentual_comissao_sdr, percentual_comissao_closer, id_projeto');

        if (projectId) query = query.eq('id_projeto', projectId);

        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nome, email, tipo, salario, pctSdr, pctCloser, id_projeto, senha } = body;
        if (!id_projeto) return NextResponse.json({ error: 'Projeto é obrigatório' }, { status: 400 });

        const { data, error } = await supabase
            .from('usuarios')
            .insert({ nome, email, tipo, ativo: true, salario_fixo_mensal: salario || 0, percentual_comissao_sdr: pctSdr || 0, percentual_comissao_closer: pctCloser || 0, id_projeto })
            .select('id_usuario')
            .single();

        if (error) throw error;

        // Criar conta Auth automaticamente para o novo membro
        await ensureAuthUser(email, senha);

        return NextResponse.json({ id: data.id_usuario, ...body });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id_usuario, nome, email, tipo, ativo, salario, pctSdr, pctCloser, id_projeto, senha } = body;
        if (!id_usuario) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        if (!id_projeto) return NextResponse.json({ error: 'Projeto é obrigatório' }, { status: 400 });

        // Buscar e-mail atual ANTES de atualizar, para sincronizar com auth se mudar
        const { data: currentUser } = await supabase
            .from('usuarios')
            .select('email')
            .eq('id_usuario', id_usuario)
            .single();

        const isAtivo = ativo === undefined || ativo === true || String(ativo) === '1';
        const { error } = await supabase
            .from('usuarios')
            .update({ nome, email, tipo, ativo: isAtivo, salario_fixo_mensal: salario || 0, percentual_comissao_sdr: pctSdr || 0, percentual_comissao_closer: pctCloser || 0, id_projeto })
            .eq('id_usuario', id_usuario);

        if (error) throw error;

        // ── Sincronizar e-mail e senha no Auth se foi alterado ────────────────────
        const oldEmail = currentUser?.email?.toLowerCase().trim();
        const newEmail = email?.toLowerCase().trim();
        try {
            const { data: { users } } = await supabase.auth.admin.listUsers();
            let authUser = users?.find((u: any) => u.email === (oldEmail || newEmail));

            // Se a senha foi informada como '0000', mapeia para DEFAULT_PASSWORD ('000000')
            let effectivePassword: string | null = null;
            if (senha && senha.trim()) {
                const trimmed = senha.trim();
                effectivePassword = (trimmed === '0000') ? DEFAULT_PASSWORD : (trimmed.length >= 6 ? trimmed : null);
            }

            if (oldEmail && newEmail && oldEmail !== newEmail) {
                if (authUser) {
                    await supabase.auth.admin.updateUserById(authUser.id, {
                        email: newEmail,
                        email_confirm: true,
                        ...(effectivePassword ? { password: effectivePassword } : {})
                    });
                    console.log(`[Auth] E-mail atualizado: ${oldEmail} → ${newEmail}`);
                } else {
                    await supabase.auth.admin.createUser({
                        email: newEmail,
                        password: effectivePassword || DEFAULT_PASSWORD,
                        email_confirm: true,
                    });
                    console.log(`[Auth] Conta criada para novo e-mail: ${newEmail}`);
                }
            } else if (authUser && effectivePassword) {
                await supabase.auth.admin.updateUserById(authUser.id, { password: effectivePassword });
                console.log(`[Auth] Senha atualizada para: ${newEmail}`);
            } else if (!authUser && newEmail) {
                await supabase.auth.admin.createUser({
                    email: newEmail,
                    password: effectivePassword || DEFAULT_PASSWORD,
                    email_confirm: true,
                });
            }
        } catch (authErr) {
            console.error('[Auth] Erro ao sincronizar credenciais no auth:', authErr);
        }

        return NextResponse.json({ success: true, id_usuario });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id_usuario = url.searchParams.get('id');
        if (!id_usuario) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });

        const { error } = await supabase.from('usuarios').delete().eq('id_usuario', id_usuario);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
