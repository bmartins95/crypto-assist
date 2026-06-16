import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    'Missing environment variables: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required (see backend/.env.example).'
  );
}

/**
 * Server-privileged client (bypasses RLS). Use only for operations that are
 * not per-user, such as writing to the shared price cache.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Client "as the user": uses the anon key, but attaches the user's JWT to
 * every request. Postgres RLS then guarantees it can only access its own
 * rows — we don't need to repeat the user_id filter manually.
 */
export function supabaseForUser(accessToken: string) {
  return createClient(supabaseUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
