// Service-role Supabase client for Edge Functions.
// This file MUST NEVER be imported from the browser bundle.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

let _client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (_client) return _client;

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  _client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
