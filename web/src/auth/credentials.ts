interface PasswordCredentialCtor {
  new (data: { id: string; password: string }): Credential;
}

declare global {
  interface Window {
    PasswordCredential?: PasswordCredentialCtor;
  }
}

// Chrome's heuristic save prompt is deliberately never triggered by our auth screens
// (see PasswordField.tsx), so this explicit Credential Management API call is the one
// and only path that offers to save a password — invoked strictly after an auth
// operation actually succeeds.
export async function storePasswordCredential(email: string, password: string): Promise<void> {
  if (!('credentials' in navigator) || !window.PasswordCredential || !email || !password) return;
  try {
    await navigator.credentials.store(new window.PasswordCredential({ id: email, password }));
  } catch {
    // Offering to save the password is best-effort UX sugar; a store failure must
    // never surface as an error on an otherwise successful login.
  }
}
