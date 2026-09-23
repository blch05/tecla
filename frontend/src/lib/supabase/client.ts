import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null | undefined;

/**
 * Cliente de Supabase para el navegador. Devuelve null si faltan las variables
 * de entorno: en ese caso la app sigue funcionando y guarda todo en localStorage.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // la clave nueva se llama "publishable"; la vieja "anon" sigue funcionando
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = !!url && !!key && !url.includes('TU-PROYECTO');
  client = configured
    ? createClient(url!, key!, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } })
    : null;
  return client;
}
