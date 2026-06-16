import { createBrowserClient } from '@supabase/ssr';

// Client para uso em Client Components (browser). Persiste a sessão em cookies
// (não localStorage), para que o proxy.ts e os Server Components também a vejam.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
