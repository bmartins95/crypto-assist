import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { ThemeProvider } from './context/ThemeContext';
import { LocaleProvider } from './context/LocaleContext';
import { BalanceProvider } from './context/BalanceContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { PriceRefreshProvider } from './context/PriceRefreshContext';
import './app/globals.css';

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
