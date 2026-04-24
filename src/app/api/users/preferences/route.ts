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

        const { data, error } = await supabase
            .from('usuarios')
            .select('dashboard_prefs')
            .eq('email', email)
            .single();

        if (error) throw error;
        
        return NextResponse.json({ prefs: data.dashboard_prefs || {} });
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
