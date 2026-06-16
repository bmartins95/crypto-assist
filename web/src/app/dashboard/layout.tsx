import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LogoutButton from '@/components/LogoutButton';

// Server Component: verifica a sessão no servidor (defesa em profundidade —
// o proxy.ts já faz isso de forma otimista, ver docs do Next.js sobre DAL).
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
