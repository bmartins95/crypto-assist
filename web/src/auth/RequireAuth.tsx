import { redirect } from '@tanstack/react-router';
import { isAuthenticated } from './useAuth';

export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) {
    throw redirect({ to: '/login' });
  }
}

export async function redirectIfAuthenticated(): Promise<void> {
  if (await isAuthenticated()) {
    throw redirect({ to: '/wallet' });
  }
}
