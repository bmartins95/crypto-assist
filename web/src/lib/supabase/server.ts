import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Client para uso em Server Components, Server Actions e Route Handlers.
// Sempre crie um novo client por requisição — nunca compartilhe entre requests.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Chamado de um Server Component (sem acesso de escrita a cookies).
            // Pode ser ignorado se houver um proxy.ts atualizando a sessão.
          }
        },
      },
    }
  );
}
