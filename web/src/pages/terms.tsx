import type { CSSProperties } from 'react';

const wrap: CSSProperties = { maxWidth: 720, margin: '0 auto', padding: '48px 24px', lineHeight: 1.6, color: 'var(--text)' };
const h2: CSSProperties = { fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 8 };

export default function TermsPage() {
  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 16 }}>Termos de Uso</h1>
      <p>Ao criar uma conta ou usar o Datum, você concorda com estes termos.</p>

      <h2 style={h2}>Descrição do serviço</h2>
      <p>
        o Datum é uma ferramenta para você registrar manualmente suas operações de
        criptoativos e acompanhar preços, lucro e histórico. O aplicativo não executa ordens de compra
        ou venda em nenhuma corretora ou exchange, não custodia ativos e não tem acesso às suas
        carteiras ou contas externas.
      </p>

      <h2 style={h2}>Sua conta</h2>
      <p>
        Você é responsável por manter suas credenciais de acesso seguras e por garantir que os dados
        de operações que você registra são precisos. O aplicativo exibe cálculos com base exclusivamente
        nos dados que você informa.
      </p>

      <h2 style={h2}>Não é aconselhamento financeiro</h2>
      <p>
        As informações exibidas (preços, lucro, histórico) são apenas para fins informativos e não
        constituem aconselhamento de investimento. Decisões de investimento são de sua exclusiva
        responsabilidade.
      </p>

      <h2 style={h2}>Encerramento de conta</h2>
      <p>
        Você pode encerrar sua conta a qualquer momento pela página de configurações. Veja a página de{' '}
        <a href="/data-deletion">exclusão de dados</a> para instruções sobre remoção de dados.
      </p>

      <h2 style={h2}>Privacidade</h2>
      <p>
        Consulte nossa <a href="/privacy">Política de Privacidade</a> para saber como seus dados são
        coletados e usados.
      </p>

      <h2 style={h2}>Contato</h2>
      <p>Dúvidas sobre estes termos: bruno.martins.cesfi@gmail.com</p>
    </div>
  );
}
