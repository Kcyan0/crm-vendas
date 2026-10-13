import { createClient } from '@supabase/supabase-js';

// Fallback dummy values to prevent crash during Next.js static build phase on Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy-build.supabase.co';
const DEFAULT_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZXB0eHJiZGVsdmR1bWx2Y2xlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY1NzQ4MCwiZXhwIjoyMDg4MjMzNDgwfQ.Bs1lZZXYfmDTKcFMbtkD8oYSQrGjO9RccRxWa194V-8';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

export default supabase;
