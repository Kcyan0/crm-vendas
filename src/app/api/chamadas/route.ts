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
            let targetEmail = null;
            let closerEmail = null;
            let sdrEmail = null;

            // 1. Pegar email do Closer e ver se ele tem token
            if (id_closer) {
                const { data: closerUser } = await supabase.from('usuarios').select('email').eq('id_usuario', id_closer).single();
                if (closerUser?.email) {
                    closerEmail = closerUser.email;
                    const { data: hasToken } = await supabase.from('google_tokens').select('id').eq('user_email', closerEmail).single();
                    if (hasToken) targetEmail = closerEmail;
                }
            }

            // Pegar email do SDR para adicionar como convidado
            if (id_sdr) {
                const { data: sdrUser } = await supabase.from('usuarios').select('email').eq('id_usuario', id_sdr).single();
                if (sdrUser?.email) {
                    sdrEmail = sdrUser.email;
                }
            }

            // Pegar email do lead para adicionar como convidado
            let leadEmail = null;
            if (id_lead) {
                const { data: leadInfo } = await supabase.from('leads').select('email').eq('id_lead', id_lead).single();
                if (leadInfo?.email) {
                    leadEmail = leadInfo.email;
                }
            }

            // 2. Fallback para quem está criando logado (Admin)
            if (!targetEmail) {
                const supabaseAuth = await createClient();
                const { data: { user } } = await supabaseAuth.auth.getUser();
                if (user?.email) targetEmail = user.email;
            }

            if (targetEmail) {
                await createGoogleEvent(targetEmail, data, closerEmail, sdrEmail, leadEmail);
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
            if (data?.google_event_id) {
                let targetEmail = null;
                let closerEmail = null;
                let sdrEmail = null;

                if (id_closer) {
                    const { data: closerUser } = await supabase.from('usuarios').select('email').eq('id_usuario', id_closer).single();
                    if (closerUser?.email) {
                        closerEmail = closerUser.email;
                        const { data: hasToken } = await supabase.from('google_tokens').select('id').eq('user_email', closerEmail).single();
                        if (hasToken) targetEmail = closerEmail;
                    }
                }

                if (id_sdr) {
                    const { data: sdrUser } = await supabase.from('usuarios').select('email').eq('id_usuario', id_sdr).single();
                    if (sdrUser?.email) sdrEmail = sdrUser.email;
                }

                let leadEmail = null;
                if (id_lead) {
                    const { data: leadInfo } = await supabase.from('leads').select('email').eq('id_lead', id_lead).single();
                    if (leadInfo?.email) leadEmail = leadInfo.email;
                }

                if (!targetEmail) {
                    const supabaseAuth = await createClient();
                    const { data: { user } } = await supabaseAuth.auth.getUser();
                    if (user?.email) targetEmail = user.email;
                }

                if (targetEmail) {
                    await updateGoogleEvent(targetEmail, data.google_event_id, data, closerEmail, sdrEmail, leadEmail);
                }
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

        // Buscar evento e id_closer antes de deletar
        const { data: chamada } = await supabase.from('chamadas').select('google_event_id, id_closer').eq('id_chamada', id_chamada).single();

        const { error } = await supabase.from('chamadas').delete().eq('id_chamada', id_chamada);
        if (error) throw error;

        // Deletar evento no Google (opcional, sem bloquear)
        try {
            if (chamada?.google_event_id) {
                let targetEmail = null;

                if (chamada.id_closer) {
                    const { data: closerUser } = await supabase.from('usuarios').select('email').eq('id_usuario', chamada.id_closer).single();
                    if (closerUser?.email) targetEmail = closerUser.email;
                }

                if (!targetEmail) {
                    const supabaseAuth = await createClient();
                    const { data: { user } } = await supabaseAuth.auth.getUser();
                    if (user?.email) targetEmail = user.email;
                }
                
                if (targetEmail) {
                    await deleteGoogleEvent(targetEmail, chamada.google_event_id);
                }
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

async function createGoogleEvent(userEmail: string, chamada: any, closerEmail?: string | null, sdrEmail?: string | null, leadEmail?: string | null) {
    const token = await getAccessToken(userEmail);
    if (!token) return;

    const startDt = new Date(chamada.data_hora_inicio);
    const endDt = new Date(startDt.getTime() + (chamada.duracao_minutos || 60) * 60000);

    const attendees: any[] = [];
    if (closerEmail && closerEmail !== userEmail) attendees.push({ email: closerEmail });
    // SDR não recebe convite — apenas o Lead e o Closer são convidados
    if (leadEmail && leadEmail !== userEmail) attendees.push({ email: leadEmail });

    const event: any = {
        summary: chamada.titulo || 'Chamada CRM',
        description: chamada.observacoes || '',
        start: { dateTime: startDt.toISOString(), timeZone: 'America/Sao_Paulo' },
        end: { dateTime: endDt.toISOString(), timeZone: 'America/Sao_Paulo' }
    };

    if (attendees.length > 0) {
        event.attendees = attendees;
    }

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
    });
    const created = await res.json();

    if (created.id) {
        await supabase.from('chamadas').update({ google_event_id: created.id }).eq('id_chamada', chamada.id_chamada);
    }
}

async function updateGoogleEvent(userEmail: string, eventId: string, chamada: any, closerEmail?: string | null, sdrEmail?: string | null, leadEmail?: string | null) {
    const token = await getAccessToken(userEmail);
    if (!token) return;

    const startDt = new Date(chamada.data_hora_inicio);
    const endDt = new Date(startDt.getTime() + (chamada.duracao_minutos || 60) * 60000);

    const attendees: any[] = [];
    if (closerEmail && closerEmail !== userEmail) attendees.push({ email: closerEmail });
    // SDR não recebe convite — apenas o Lead e o Closer são convidados
    if (leadEmail && leadEmail !== userEmail) attendees.push({ email: leadEmail });

    const event: any = {
        summary: chamada.titulo || 'Chamada CRM',
        description: chamada.observacoes || '',
        start: { dateTime: startDt.toISOString(), timeZone: 'America/Sao_Paulo' },
        end: { dateTime: endDt.toISOString(), timeZone: 'America/Sao_Paulo' }
    };

    if (attendees.length > 0) {
        event.attendees = attendees;
    }

    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
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
