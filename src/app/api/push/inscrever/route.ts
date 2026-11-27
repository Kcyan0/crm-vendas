import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { enviarPush, pushConfigurado } from '@/lib/push';

/**
 * Ativar e desativar os avisos de call neste aparelho (convite ao entrar, src/components/ConviteAvisosCall.tsx).
 * POST { inscricao: PushSubscriptionJSON }  → guarda o aparelho; na primeira vez manda um aviso de confirmação.
 *                                             O app chama de novo ao abrir para manter o aparelho no e-mail certo.
 * DELETE { endpoint }                       → tira o aparelho
 * Só para quem está logado; o aparelho fica no e-mail da conta.
 */

async function emailLogado(): Promise<string | null> {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    return user?.email ? user.email.trim().toLowerCase() : null;
}

export async function POST(request: Request) {
    try {
        const email = await emailLogado();
        if (!email) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        if (!pushConfigurado()) return NextResponse.json({ error: 'Os avisos ainda não foram configurados no servidor.' }, { status: 503 });

        const { inscricao } = await request.json();
        const endpoint = inscricao?.endpoint;
        const p256dh = inscricao?.keys?.p256dh;
        const authChave = inscricao?.keys?.auth;
        if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !p256dh || !authChave) {
            return NextResponse.json({ error: 'Inscrição inválida' }, { status: 400 });
        }

        const aparelho = (request.headers.get('user-agent') || '').slice(0, 200);
        const { data: existente } = await supabase.from('push_inscricoes').select('email').eq('endpoint', endpoint).maybeSingle();
        const primeiraVez = !existente || existente.email !== email;
        const { error } = await supabase
            .from('push_inscricoes')
            .upsert({ email, endpoint, p256dh, auth: authChave, aparelho }, { onConflict: 'endpoint' });
        if (error) throw error;

        // Na primeira vez, confirma na hora que o caminho inteiro funciona (chave, banco, celular)
        const chegou = primeiraVez && await enviarPush(
            { endpoint, p256dh, auth: authChave },
            { titulo: 'Avisos de call ativados', corpo: 'Você vai receber um aviso 15 minutos antes de cada call sua.', tag: 'avisos-ativados' },
        );
        return NextResponse.json({ success: true, primeiraVez, confirmacaoEnviada: chegou });
    } catch (erro) {
        const error = erro as { message?: string };
        console.error('Erro ao ativar avisos', error?.message);
        return NextResponse.json({ error: error?.message || 'Erro ao ativar avisos' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const email = await emailLogado();
        if (!email) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        const { endpoint } = await request.json();
        if (typeof endpoint !== 'string') return NextResponse.json({ error: 'Aparelho inválido' }, { status: 400 });
        const { error } = await supabase.from('push_inscricoes').delete().eq('endpoint', endpoint).eq('email', email);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (erro) {
        const error = erro as { message?: string };
        return NextResponse.json({ error: error?.message || 'Erro ao desativar avisos' }, { status: 500 });
    }
}
