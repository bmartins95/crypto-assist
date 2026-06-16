import { redirect } from 'next/navigation';

// proxy.ts already guarantees unauthenticated users are sent to /auth;
// here we just decide where to send authenticated users.
export default function Home() {
  redirect('/dashboard');
}
