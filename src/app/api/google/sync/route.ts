import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

async function getValidAccessToken(userEmail: string): Promise<string | null> {
    const { data: tokenData } = await supabase.from('google_tokens').select('*').eq('user_email', userEmail).single();
    if (!tokenData) return null;

    if (new Date(tokenData.expires_at) <= new Date()) {
        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                refresh_token: tokenData.refresh_token,
                grant_type: 'refresh_token'
            })
        });
        const refreshed = await res.json();
        if (!refreshed.access_token) return null;
        await supabase.from('google_tokens').update({
            access_token: refreshed.access_token,
            expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
        }).eq('user_email', userEmail);
        return refreshed.access_token;
    }
    return tokenData.access_token;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { month } = body; // formato: YYYY-MM

        const supabaseAuth = await createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const token = await getValidAccessToken(user.email);
        if (!token) return NextResponse.json({ error: 'Google não conectado' }, { status: 400 });

        // Definir range do mês
        const [y, m] = (month || `${new Date().getFullYear()}-${new Date().getMonth() + 1}`).split('-').map(Number);
        const timeMin = new Date(y, m - 1, 1).toISOString();
        const timeMax = new Date(y, m, 0, 23, 59, 59).toISOString();

        // Buscar eventos do Google Calendar
        const gcRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&maxResults=250`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const gcData = await gcRes.json();
        const googleEvents = gcData.items || [];

        // Buscar chamadas já existentes no banco com google_event_id
        const { data: existingChamadas } = await supabase.from('chamadas').select('google_event_id').not('google_event_id', 'is', null);
        const existingGcIds = new Set((existingChamadas || []).map((c: any) => c.google_event_id));

        let criados = 0;
        for (const event of googleEvents) {
            if (!event.start?.dateTime || existingGcIds.has(event.id)) continue;

            await supabase.from('chamadas').insert({
                titulo: event.summary || 'Evento Google',
                data_hora_inicio: event.start.dateTime,
                duracao_minutos: event.end?.dateTime
                    ? Math.round((new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / 60000)
                    : 60,
                status_chamada: 'agendada',
                observacoes: event.description || '',
                google_event_id: event.id,
            });
            criados++;
        }

        return NextResponse.json({ success: true, synced: criados, total: googleEvents.length });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
