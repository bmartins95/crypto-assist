import type { CSSProperties } from 'react';

const wrap: CSSProperties = { maxWidth: 720, margin: '0 auto', padding: '48px 24px', lineHeight: 1.6, color: 'var(--text)' };
const h2: CSSProperties = { fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 8 };

export default function PrivacyPage() {
  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 16 }}>Política de Privacidade</h1>
      <p>Esta página descreve como o Datum coleta, usa e protege seus dados.</p>

      <h2 style={h2}>Dados coletados</h2>
      <p>
        Coletamos seu endereço de e-mail (fornecido diretamente ou através do Google/Facebook no
        login) e os dados de operações que você registra manualmente no aplicativo (moeda, quantidade,
        preço, data e tipo da operação). Não coletamos dados de navegação, localização ou contatos.
      </p>

      <h2 style={h2}>Como os dados são usados</h2>
      <p>
        Seus dados de operações são usados exclusivamente para calcular e exibir sua carteira, lucro e
        histórico dentro do aplicativo. Não vendemos, compartilhamos ou usamos seus dados para
        publicidade.
      </p>

      <h2 style={h2}>Terceiros envolvidos</h2>
      <p>
        Usamos o AWS Cognito para autenticação (incluindo login social via Google e Facebook, que
        recebem apenas as permissões mínimas de e-mail e perfil público) e a CoinGecko para obter
        preços de mercado das criptomoedas. Nenhum dado de operações é enviado a esses terceiros.
      </p>

      <h2 style={h2}>Armazenamento</h2>
      <p>
        Seus dados ficam armazenados em um banco de dados AWS RDS, isolados por conta de usuário.
        Apenas você tem acesso às suas próprias operações.
      </p>

      <h2 style={h2}>Exclusão de dados</h2>
      <p>
        Veja a página de <a href="/data-deletion">exclusão de dados</a> para instruções sobre como
        remover seus dados.
      </p>

      <h2 style={h2}>Contato</h2>
      <p>Dúvidas sobre privacidade: bruno.martins.cesfi@gmail.com</p>
    </div>
  );
}
