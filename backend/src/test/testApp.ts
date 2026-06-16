import express, { type Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Mounts a single router behind a fake auth middleware that injects the
 * given userId/supabase stub directly into req, bypassing the real
 * requireAuth (and therefore the real Supabase JWT verification). Lets
 * route tests focus purely on the route handler's own logic.
 */
export function mountRouterForTest(path: string, router: Router, opts: { userId?: string; supabase?: unknown } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = opts.userId ?? 'test-user-id';
    req.supabase = (opts.supabase as SupabaseClient) ?? undefined;
    next();
  });
  app.use(path, router);
  return app;
}
