import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin, supabaseForUser } from '../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// Extends Express's Request with the data this middleware populates.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      accessToken?: string;
      supabase?: SupabaseClient;
    }
  }
}

/**
 * Requires an `Authorization: Bearer <token>` header with a valid Supabase
 * access token. On success, populates:
 * - req.userId      -> the authenticated user's id
 * - req.accessToken -> the received token
 * - req.supabase    -> a Supabase client authenticated as that user (RLS-aware)
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    res.status(401).json({ error: 'Missing authentication token.' });
    return;
  }

  // getUser() contacts the Supabase Auth server and validates the token.
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }

  req.userId = data.user.id;
  req.accessToken = token;
  req.supabase = supabaseForUser(token);
  next();
}
