import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LogoutButton from '@/components/LogoutButton';

// Server Component: verifies the session on the server (defense in depth —
// proxy.ts already does this optimistically, see the Next.js docs on the DAL).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '8px 16px', fontSize: 12, color: 'var(--text3)' }}>
        <span>{user.email}</span>
        <LogoutButton />
      </div>
      {children}
    </div>
  );
}
