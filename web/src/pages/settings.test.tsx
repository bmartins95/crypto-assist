import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { LocaleProvider } from '@/context/LocaleContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { BalanceProvider } from '@/context/BalanceContext';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { PriceRefreshProvider } from '@/context/PriceRefreshContext';

beforeEach(() => {
  localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }));
});
import SettingsPage from './settings';

vi.mock('@/lib/api/client', () => ({
  api: {
    getExchangeRates: vi.fn().mockResolvedValue({ rates: { BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }, updatedAt: '2026-01-01T00:00:00Z' }),
    exportBackup: vi.fn().mockResolvedValue({ version: 1, exportedAt: '', ops: [], exitPrices: {} }),
    clearOps: vi.fn().mockResolvedValue({ deleted: 0 }),
    importBackup: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/dataHandlers', () => ({
  exportData: vi.fn().mockResolvedValue(undefined),
  importData: vi.fn().mockResolvedValue(undefined),
}));

const { reloadMock } = vi.hoisted(() => ({ reloadMock: vi.fn(async () => {}) }));
vi.mock('@/components/AppLayout', () => ({
  usePortfolio: () => ({ reload: reloadMock }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <ToastProvider>
          <BalanceProvider><CurrencyProvider><PriceRefreshProvider>{children}</PriceRefreshProvider></CurrencyProvider></BalanceProvider>
        </ToastProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

function renderSettings() {
  return render(<Wrapper><SettingsPage /></Wrapper>);
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear(); localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }));
    document.documentElement.removeAttribute('data-theme');
    vi.clearAllMocks();
  });
  afterEach(() => {
    localStorage.clear(); localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }));
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders all four section headings', () => {
    renderSettings();
    expect(screen.getByText('Aparência e idioma')).toBeTruthy();
    expect(screen.getByText('Moeda e preços')).toBeTruthy();
    expect(screen.getByText('Dados')).toBeTruthy();
    expect(screen.getByText('Zona de perigo')).toBeTruthy();
  });

  it('language select has an associated label', () => {
    renderSettings();
    expect(screen.getByLabelText(/idioma/i)).toBeTruthy();
  });

  it('theme segmented control is rendered with three buttons', () => {
    renderSettings();
    expect(screen.getByRole('group', { name: /tema/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /claro/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /escuro/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /sistema/i })).toBeTruthy();
  });

  it('changing language select persists to localStorage', () => {
    renderSettings();
    const langSelect = screen.getByLabelText(/idioma/i) as HTMLSelectElement;
    fireEvent.change(langSelect, { target: { value: 'en-US' } });
    expect(localStorage.getItem('crypto-assist:locale')).toBe('en-US');
  });

  it('clicking Claro button sets data-theme="light" and persists to localStorage', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /claro/i }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('crypto-assist:theme')).toBe('light');
  });

  it('Sistema button has aria-pressed="true" by default', () => {
    renderSettings();
    const sysBtn = screen.getByRole('button', { name: /sistema/i });
    expect(sysBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('price-refresh select has a label, is enabled, and defaults to Manual', () => {
    renderSettings();
    const select = screen.getByLabelText(/atualizar preços/i) as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    expect(select.value).toBe('null');
  });

  it('changing the price-refresh select persists the interval to localStorage', () => {
    renderSettings();
    const select = screen.getByLabelText(/atualizar preços/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '30000' } });
    expect(select.value).toBe('30000');
    expect(localStorage.getItem('price_refresh_interval')).toBe('30000');
  });

  describe('US1 — Display currency', () => {
    it('currency select has a label, is enabled, and defaults to BRL', () => {
      renderSettings();
      const select = screen.getByLabelText(/moeda/i) as HTMLSelectElement;
      expect(select.disabled).toBe(false);
      expect(select.value).toBe('BRL');
      expect(Array.from(select.options).map(o => o.value)).toEqual(['BRL', 'USD', 'EUR', 'GBP', 'JPY']);
    });

    it('changing the currency persists to localStorage', () => {
      renderSettings();
      const select = screen.getByLabelText(/moeda/i) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'USD' } });
      expect(localStorage.getItem('crypto-assist:currency')).toBe('USD');
      expect(select.value).toBe('USD');
    });

    it('restores the stored currency on load', () => {
      localStorage.setItem('crypto-assist:currency', 'JPY');
      renderSettings();
      const select = screen.getByLabelText(/moeda/i) as HTMLSelectElement;
      expect(select.value).toBe('JPY');
    });
  });

  describe('US2 — Hide balances', () => {
    it('hide-balances switch starts with aria-checked="false"', () => {
      renderSettings();
      const toggle = screen.getByRole('switch');
      expect(toggle.getAttribute('aria-checked')).toBe('false');
    });

    it('toggling hide-balances switch updates localStorage', () => {
      renderSettings();
      const toggle = screen.getByRole('switch');
      fireEvent.click(toggle);
      expect(localStorage.getItem('crypto-assist:balance-hidden')).toBe('true');
    });

    it('hide-balances switch reflects stored value', () => {
      localStorage.setItem('crypto-assist:balance-hidden', 'true');
      renderSettings();
      const toggle = screen.getByRole('switch');
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('US3 — Export / Import / Clear Wallet', () => {
    it('Export button calls exportData', async () => {
      const { exportData } = await import('@/lib/dataHandlers');
      renderSettings();
      const exportBtn = screen.getByRole('button', { name: /exportar/i });
      fireEvent.click(exportBtn);
      await waitFor(() => expect(exportData).toHaveBeenCalledTimes(1));
    });

    it('Export failure shows an in-app error message, not a native alert', async () => {
      const { exportData } = await import('@/lib/dataHandlers');
      vi.mocked(exportData).mockRejectedValueOnce(new Error('network error'));
      const alertSpy = vi.spyOn(window, 'alert');
      renderSettings();
      fireEvent.click(screen.getByRole('button', { name: /exportar/i }));
      expect(await screen.findByRole('status')).toBeTruthy();
      expect(screen.getByRole('status').textContent).toContain('Erro ao exportar backup.');
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('Clicking Clear Wallet opens an in-app confirm dialog, not a native confirm', () => {
      renderSettings();
      const confirmSpy = vi.spyOn(window, 'confirm');
      fireEvent.click(screen.getByRole('button', { name: /limpar dados/i }));
      expect(screen.getByRole('alertdialog')).toBeTruthy();
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('Confirming the Clear Wallet dialog calls clearOps, reloads, and shows an in-app success message', async () => {
      const { api } = await import('@/lib/api/client');
      renderSettings();
      fireEvent.click(screen.getByRole('button', { name: /limpar dados/i }));
      const dialog = screen.getByRole('alertdialog');
      fireEvent.click(within(dialog).getByRole('button', { name: /limpar dados/i }));
      await waitFor(() => expect(api.clearOps).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
      expect(await screen.findByRole('status')).toBeTruthy();
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('Cancelling the Clear Wallet dialog does not call clearOps and leaves no message', () => {
      renderSettings();
      fireEvent.click(screen.getByRole('button', { name: /limpar dados/i }));
      const dialog = screen.getByRole('alertdialog');
      fireEvent.click(within(dialog).getByRole('button', { name: /cancelar/i }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('Clear Wallet failure shows an in-app error message', async () => {
      const { api } = await import('@/lib/api/client');
      vi.mocked(api.clearOps).mockRejectedValueOnce(new Error('fail'));
      renderSettings();
      fireEvent.click(screen.getByRole('button', { name: /limpar dados/i }));
      const dialog = screen.getByRole('alertdialog');
      fireEvent.click(within(dialog).getByRole('button', { name: /limpar dados/i }));
      expect(await screen.findByRole('status')).toBeTruthy();
    });

    it('Import file selection calls importData with the file and portfolio reload', async () => {
      const { importData } = await import('@/lib/dataHandlers');
      renderSettings();
      const file = new File(['{"version":1,"ops":[]}'], 'backup.json', { type: 'application/json' });
      const input = screen.getByLabelText('Importar') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });
      await waitFor(() => expect(importData).toHaveBeenCalledWith(file, reloadMock));
    });

    it('Import button opens the hidden file input', () => {
      renderSettings();
      const input = screen.getByLabelText('Importar') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});
      fireEvent.click(screen.getByRole('button', { name: /importar/i }));
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('Import success shows a dedicated import message, never the wallet-cleared message', async () => {
      renderSettings();
      const file = new File(['{"version":1,"ops":[]}'], 'backup.json', { type: 'application/json' });
      const input = screen.getByLabelText('Importar') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });
      expect(await screen.findByRole('status')).toBeTruthy();
      const message = screen.getByRole('status').textContent;
      expect(message).toContain('importada');
      expect(message).not.toContain('limpa');
    });

    it('Dismissing the toast via its close button hides it', async () => {
      renderSettings();
      const file = new File(['{"version":1,"ops":[]}'], 'backup.json', { type: 'application/json' });
      const input = screen.getByLabelText('Importar') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });
      expect(await screen.findByRole('status')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /fechar/i }));
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('Import failure shows an in-app error message including the error detail', async () => {
      const { importData } = await import('@/lib/dataHandlers');
      vi.mocked(importData).mockRejectedValueOnce(new Error('violates check constraint'));
      const alertSpy = vi.spyOn(window, 'alert');
      renderSettings();
      const file = new File(['nonsense'], 'backup.json', { type: 'application/json' });
      const input = screen.getByLabelText('Importar') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });
      expect(await screen.findByRole('status')).toBeTruthy();
      expect(screen.getByRole('status').textContent).toContain('violates check constraint');
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });
});
