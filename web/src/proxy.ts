import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// Next.js 16 renomeou "middleware" para "proxy" (mesmo arquivo, mesmo lugar,
// mesmo comportamento — só a convenção de nome mudou).
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Roda em todas as rotas exceto assets estáticos, imagens e o favicon.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
