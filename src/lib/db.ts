import { createClient } from '@supabase/supabase-js';

// Fallback dummy values to prevent crash during Next.js static build phase on Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy-build.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-key';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

export default supabase;
