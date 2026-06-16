import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin, supabaseForUser } from '../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// Estende o Request do Express com os dados que o middleware popula.
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
 * Exige um header `Authorization: Bearer <token>` com um access token
 * Supabase válido. Em caso de sucesso, popula:
 * - req.userId      → id do usuário autenticado
 * - req.accessToken → o token recebido
 * - req.supabase    → client Supabase autenticado como esse usuário (respeita RLS)
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    res.status(401).json({ error: 'Token de autenticação ausente.' });
    return;
  }

  // getUser() contacta o servidor de Auth do Supabase e valida o token.
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
    return;
  }

  req.userId = data.user.id;
  req.accessToken = token;
  req.supabase = supabaseForUser(token);
  next();
}
