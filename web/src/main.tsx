import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { ThemeProvider } from './context/ThemeContext';
import { LocaleProvider } from './context/LocaleContext';
import { ToastProvider } from './context/ToastContext';
import { BalanceProvider } from './context/BalanceContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { PriceRefreshProvider } from './context/PriceRefreshContext';
import { api } from './lib/api/client';
import './app/globals.css';

const cognitoDomain = (import.meta.env.VITE_COGNITO_DOMAIN as string).replace(/^https?:\/\//, '');

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string,
      loginWith: {
        oauth: {
          domain: cognitoDomain,
          // aws.cognito.signin.user.admin is required for GetUser (fetchUserAttributes)
          // calls made with the access token issued by this OAuth flow — without it,
          // Cognito returns 400 on any post-login GetUser call.
          scopes: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
          redirectSignIn: [`${window.location.origin}/auth/callback`],
          redirectSignOut: [window.location.origin],
          responseType: 'code',
        },
      },
    },
  },
});

// Fired unconditionally, before React even mounts: Aurora's 0-ACU serverless cluster
// needs several seconds to wake from a cold state, and AppLayout's first authenticated
// fetch right after login can't afford to wait for that. Starting the wake-up as early
// as possible — even before the visitor has finished typing credentials — gives it the
// most lead time. Best-effort: a failure here must never block anything else.
api.warmupDb().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LocaleProvider>
        <ToastProvider>
          <BalanceProvider>
            <CurrencyProvider>
              <PriceRefreshProvider>
                <RouterProvider router={router} />
              </PriceRefreshProvider>
            </CurrencyProvider>
          </BalanceProvider>
        </ToastProvider>
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>
);

// Hand off from index.html's static pre-React spinner now that real content is mounting.
document.getElementById('boot-loader')?.remove();
