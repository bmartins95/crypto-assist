import { buildAuthUrl } from '@/lib/cognito/client';

const searchParams = new URLSearchParams(window.location.search);
const authError = searchParams.get('error');

export default function AuthClient() {
  const handleGoogle = async () => {
    window.location.href = await buildAuthUrl('Google');
  };

  const handleEmail = async () => {
    window.location.href = await buildAuthUrl();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <i className="ti ti-currency-bitcoin" /> Carteira de Criptoativos
        </h1>
        <p style={{ color: 'var(--text3)', marginBottom: 24 }}>
          Entre ou crie sua conta para continuar
        </p>

        <button
          onClick={handleGoogle}
          className="btn-sm"
          style={{ width: '100%', justifyContent: 'center', padding: '10px 0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <i className="ti ti-brand-google" /> Continuar com Google
        </button>

        <button
          onClick={handleEmail}
          className="btn-sm"
          style={{ width: '100%', justifyContent: 'center', padding: '10px 0', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <i className="ti ti-mail" /> Entrar com e-mail
        </button>

        {authError && (
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text3)' }}>
            Falha na autenticação. Tente novamente.
          </p>
        )}
      </div>
    </div>
  );
}
