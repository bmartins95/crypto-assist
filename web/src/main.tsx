import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { ThemeProvider } from './context/ThemeContext';
import { LocaleProvider } from './context/LocaleContext';
import { BalanceProvider } from './context/BalanceContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { PriceRefreshProvider } from './context/PriceRefreshContext';
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
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [`${window.location.origin}/auth/callback`],
          redirectSignOut: [window.location.origin],
          responseType: 'code',
        },
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LocaleProvider>
        <BalanceProvider>
          <CurrencyProvider>
            <PriceRefreshProvider>
              <RouterProvider router={router} />
            </PriceRefreshProvider>
          </CurrencyProvider>
        </BalanceProvider>
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>
);
