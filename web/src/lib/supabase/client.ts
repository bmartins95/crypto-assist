import { createBrowserClient } from '@supabase/ssr';

// Client for use in Client Components (browser). Persists the session in
// cookies (not localStorage), so proxy.ts and Server Components can see it too.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
