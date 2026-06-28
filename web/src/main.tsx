import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { ThemeProvider } from './context/ThemeContext';
import { LocaleProvider } from './context/LocaleContext';
import { BalanceProvider } from './context/BalanceContext';
import './app/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LocaleProvider>
        <BalanceProvider>
          <RouterProvider router={router} />
        </BalanceProvider>
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>
);
