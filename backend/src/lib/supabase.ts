import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !publishableKey || !secretKey) {
  throw new Error(
    'Missing environment variables: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY are required (see backend/.env.example).'
  );
}

/**
 * Server-privileged client (bypasses RLS). Use only for operations that are
 * not per-user, such as writing to the shared price cache.
 */
export const supabaseAdmin = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Client "as the user": uses the publishable key, but attaches the user's
 * JWT to every request. Postgres RLS then guarantees it can only access its
 * own rows — we don't need to repeat the user_id filter manually.
 */
export function supabaseForUser(accessToken: string) {
  return createClient(supabaseUrl!, publishableKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
