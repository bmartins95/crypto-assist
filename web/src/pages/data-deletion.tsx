import type { CSSProperties } from 'react';

const wrap: CSSProperties = { maxWidth: 720, margin: '0 auto', padding: '48px 24px', lineHeight: 1.6, color: 'var(--text)' };
const h2: CSSProperties = { fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 8 };

export default function DataDeletionPage() {
  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 16 }}>Exclusão de Dados</h1>
      <p>Você pode excluir seus dados do Carteira de Criptoativos a qualquer momento.</p>

      <h2 style={h2}>Excluir suas operações</h2>
      <p>
        Na tela de Configurações do aplicativo, na seção "Zona de perigo", use o botão
        "Limpar carteira" para apagar imediatamente todas as suas operações registradas.
      </p>

      <h2 style={h2}>Excluir sua conta por completo</h2>
      <p>
        Para remover também sua conta de autenticação (e-mail, Google ou Facebook) além dos dados
        de operações, envie um e-mail para bruno.martins.cesfi@gmail.com solicitando a exclusão da
        sua conta, informando o e-mail usado no login. O pedido é processado em até 7 dias.
      </p>
    </div>
  );
}
