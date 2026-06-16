import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    'Faltam variáveis de ambiente: SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são obrigatórias (ver backend/.env.example).'
  );
}

/**
 * Client com privilégio de servidor (ignora RLS). Use apenas para operações
 * que não são por-usuário, como escrever no cache de preços compartilhado.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Client "como o usuário": usa a anon key, mas anexa o JWT do usuário em
 * todas as requisições. O RLS do Postgres garante que ele só acesse as
 * próprias linhas — não precisamos repetir o filtro de user_id manualmente.
 */
export function supabaseForUser(accessToken: string) {
  return createClient(supabaseUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
