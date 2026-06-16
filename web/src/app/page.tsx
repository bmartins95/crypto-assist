import { redirect } from 'next/navigation';

// O proxy.ts já garante que usuários não autenticados sejam enviados a /auth;
// aqui só decidimos para onde mandar usuários autenticados.
export default function Home() {
  redirect('/dashboard');
}
