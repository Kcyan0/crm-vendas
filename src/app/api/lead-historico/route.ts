import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const leadId = searchParams.get('leadId');
        if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

        const { data, error } = await supabase
            .from('lead_historico')
            .select('*')
            .eq('id_lead', leadId)
            .order('criado_em', { ascending: false });

        if (error) throw error;
        return NextResponse.json(data || []);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id_lead, acao, usuario_nome } = body;
        if (!id_lead || !acao) return NextResponse.json({ error: 'id_lead e acao são obrigatórios' }, { status: 400 });

        const { error } = await supabase
            .from('lead_historico')
            .insert({ id_lead, acao, usuario_nome: usuario_nome || null });

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
