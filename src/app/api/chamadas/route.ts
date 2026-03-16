import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const month = searchParams.get('month'); // formato: YYYY-MM
        
        let query = supabase
            .from('chamadas')
            .select(`
                *,
                lead:leads(nome, telefone),
                sdr:usuarios!id_sdr(nome),
                closer:usuarios!id_closer(nome)
            `)
            .order('data_hora_inicio', { ascending: true });

        if (projectId) query = query.eq('id_projeto', projectId);

        if (month) {
            const start = `${month}-01T00:00:00`;
            const [y, m] = month.split('-').map(Number);
            const lastDay = new Date(y, m, 0).getDate();
            const end = `${month}-${lastDay}T23:59:59`;
            query = query.gte('data_hora_inicio', start).lte('data_hora_inicio', end);
        }

        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json(data || []);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { titulo, id_lead, id_sdr, id_closer, status_chamada, data_hora_inicio, duracao_minutos, observacoes, id_projeto } = body;

        const { data, error } = await supabase
            .from('chamadas')
            .insert({ titulo: titulo || 'Chamada', id_lead, id_sdr, id_closer, status_chamada: status_chamada || 'agendada', data_hora_inicio, duracao_minutos, observacoes, id_projeto })
            .select()
            .single();

        if (error) throw error;

        // Tentar criar evento no Google Calendar (opcional, sem bloquear)
        try {
            const supabaseAuth = await createClient();
            const { data: { user } } = await supabaseAuth.auth.getUser();
            if (user?.email) {
                await createGoogleEvent(user.email, data);
            }
        } catch (gcErr) {
            console.warn('[Google Calendar] Erro ao criar evento (ignorado):', gcErr);
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id_chamada, titulo, id_lead, id_sdr, id_closer, status_chamada, data_hora_inicio, duracao_minutos, observacoes } = body;
        if (!id_chamada) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

        const { data, error } = await supabase
            .from('chamadas')
            .update({ titulo, id_lead, id_sdr, id_closer, status_chamada, data_hora_inicio, duracao_minutos, observacoes })
            .eq('id_chamada', id_chamada)
            .select()
            .single();

        if (error) throw error;

        // Atualizar evento no Google Calendar (opcional, sem bloquear)
        try {
            const supabaseAuth = await createClient();
            const { data: { user } } = await supabaseAuth.auth.getUser();
            if (user?.email && data?.google_event_id) {
                await updateGoogleEvent(user.email, data.google_event_id, data);
            }
        } catch (gcErr) {
            console.warn('[Google Calendar] Erro ao atualizar evento (ignorado):', gcErr);
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id_chamada = searchParams.get('id');
        if (!id_chamada) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

        // Buscar google_event_id antes de deletar
        const { data: chamada } = await supabase.from('chamadas').select('google_event_id').eq('id_chamada', id_chamada).single();

        const { error } = await supabase.from('chamadas').delete().eq('id_chamada', id_chamada);
        if (error) throw error;

        // Deletar evento no Google (opcional, sem bloquear)
        try {
            if (chamada?.google_event_id) {
                const supabaseAuth = await createClient();
                const { data: { user } } = await supabaseAuth.auth.getUser();
                if (user?.email) await deleteGoogleEvent(user.email, chamada.google_event_id);
            }
        } catch (gcErr) {
            console.warn('[Google Calendar] Erro ao deletar evento (ignorado):', gcErr);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ============================================================
// Helpers de Google Calendar
// ============================================================

async function getAccessToken(userEmail: string): Promise<string | null> {
    const { data: tokenData } = await supabase
        .from('google_tokens')
        .select('*')
        .eq('user_email', userEmail)
        .single();

    if (!tokenData) return null;

    // Verificar se o token expirou
    if (new Date(tokenData.expires_at) <= new Date()) {
        // Refresh
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

async function createGoogleEvent(userEmail: string, chamada: any) {
    const token = await getAccessToken(userEmail);
    if (!token) return;

    const startDt = new Date(chamada.data_hora_inicio);
    const endDt = new Date(startDt.getTime() + (chamada.duracao_minutos || 60) * 60000);

    const event = {
        summary: chamada.titulo || 'Chamada CRM',
        description: chamada.observacoes || '',
        start: { dateTime: startDt.toISOString(), timeZone: 'America/Sao_Paulo' },
        end: { dateTime: endDt.toISOString(), timeZone: 'America/Sao_Paulo' }
    };

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
    });
    const created = await res.json();

    if (created.id) {
        await supabase.from('chamadas').update({ google_event_id: created.id }).eq('id_chamada', chamada.id_chamada);
    }
}

async function updateGoogleEvent(userEmail: string, eventId: string, chamada: any) {
    const token = await getAccessToken(userEmail);
    if (!token) return;

    const startDt = new Date(chamada.data_hora_inicio);
    const endDt = new Date(startDt.getTime() + (chamada.duracao_minutos || 60) * 60000);

    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            summary: chamada.titulo || 'Chamada CRM',
            description: chamada.observacoes || '',
            start: { dateTime: startDt.toISOString(), timeZone: 'America/Sao_Paulo' },
            end: { dateTime: endDt.toISOString(), timeZone: 'America/Sao_Paulo' }
        })
    });
}

async function deleteGoogleEvent(userEmail: string, eventId: string) {
    const token = await getAccessToken(userEmail);
    if (!token) return;
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    });
}
