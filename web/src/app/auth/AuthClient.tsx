import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Mode = 'login' | 'signup';

export default function AuthClient() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const supabase = createClient();

  const handleGoogle = async () => {
    setMessage('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setMessage(error.message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(translateAuthError(error.message));
      else window.location.href = '/dashboard';
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setMessage(translateAuthError(error.message));
      else setMessage('Verifique seu e-mail para confirmar o cadastro.');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <i className="ti ti-currency-bitcoin" /> Carteira de Criptoativos
        </h1>
        <p style={{ color: 'var(--text3)', marginBottom: 24 }}>
          {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}
        </p>

        <button
          onClick={handleGoogle}
          className="btn-sm"
          style={{ width: '100%', justifyContent: 'center', padding: '10px 0', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <i className="ti ti-brand-google" /> Continuar com Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0', color: 'var(--text3)', fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border2)' }} />
          ou
          <div style={{ flex: 1, height: 1, background: 'var(--border2)' }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="E-mail"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border2)' }}
          />
          <input
            type="password"
            placeholder="Senha"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 'var(--radius)', border: '0.5px solid var(--border2)' }}
          />
          <button type="submit" disabled={loading} className="btn-sm" style={{ padding: '10px 0', justifyContent: 'center' }}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        {message && <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text3)' }}>{message}</p>}

        <p style={{ marginTop: 24, fontSize: 13, textAlign: 'center' }}>
          {mode === 'login' ? (
            <>Não tem conta? <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup'); setMessage(''); }}>Cadastre-se</a></>
          ) : (
            <>Já tem conta? <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setMessage(''); }}>Entrar</a></>
          )}
        </p>
      </div>
    </div>
  );
}

function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha inválidos.';
  if (msg.includes('User already registered')) return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.';
  return msg;
}
