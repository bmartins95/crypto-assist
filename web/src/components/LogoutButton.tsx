'use client';

import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  return (
    <button className="btn-sm" onClick={handleLogout} title="Sair da conta">
      <i className="ti ti-logout" /> Sair
    </button>
  );
}
