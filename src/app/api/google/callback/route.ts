import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    const baseUrl = process.env.GOOGLE_REDIRECT_URI?.replace('/api/google/callback', '') || 'http://localhost:3000';

    if (error || !code) {
        return NextResponse.redirect(`${baseUrl}/calendar?google=error`);
    }

    try {
        // Trocar code por tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
                grant_type: 'authorization_code'
            })
        });
        const tokens = await tokenRes.json();

        if (!tokens.access_token) {
            return NextResponse.redirect(`${baseUrl}/calendar?google=error`);
        }

        // Pegar o email do usuário logado no Supabase Auth
        const supabaseAuth = await createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();

        if (!user?.email) {
            return NextResponse.redirect(`${baseUrl}/login`);
        }

        // Salvar ou atualizar tokens no banco
        await supabase.from('google_tokens').upsert({
            user_email: user.email,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_email' });

        return NextResponse.redirect(`${baseUrl}/calendar?google=connected`);
    } catch (err: any) {
        console.error('[Google Callback Error]', err);
        return NextResponse.redirect(`${baseUrl}/calendar?google=error`);
    }
}
