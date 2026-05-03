import { createClient } from '@supabase/supabase-js';

// No fallbacks. A missing env var must FAIL LOUD — silently writing to a
// hardcoded project is how forks accidentally pollute your production data.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
        'Set them in .env (see .env.example) before running the app.',
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
