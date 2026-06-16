import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// Next.js 16 renamed "middleware" to "proxy" (same file, same place, same
// behavior — only the naming convention changed).
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Runs on every route except static assets, images and the favicon.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
