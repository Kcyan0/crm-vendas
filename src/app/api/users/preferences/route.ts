import { NextResponse } from 'next/server';
import supabase from '@/lib/db'; // Service role key
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');
        if (!email) {
            return NextResponse.json({ error: 'Email required' }, { status: 400 });
        }

        // O mesmo email pode ter várias linhas em usuarios (uma por perfil/projeto): .single() dava 500 e o
        // layout salvo nunca carregava. O POST grava em todas, então junta as prefs de todas as linhas.
        const { data, error } = await supabase
            .from('usuarios')
            .select('dashboard_prefs')
            .eq('email', email)
            .order('id_usuario', { ascending: true });

        if (error) throw error;

        const prefs = Object.assign({}, ...(data || []).map((u: { dashboard_prefs: Record<string, unknown> | null }) => u.dashboard_prefs || {}));
        return NextResponse.json({ prefs });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, prefs } = body;

        if (!email) {
            return NextResponse.json({ error: 'Email required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('usuarios')
            .update({ dashboard_prefs: prefs })
            .eq('email', email);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
