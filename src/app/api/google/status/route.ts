import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    if (!email) return NextResponse.json({ connected: false });

    const { data } = await supabase.from('google_tokens').select('access_token').eq('user_email', email).single();
    return NextResponse.json({ connected: !!data?.access_token });
}
