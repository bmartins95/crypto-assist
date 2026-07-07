import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/context/LocaleContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { BalanceProvider } from '@/context/BalanceContext';
import { CurrencyProvider } from '@/context/CurrencyContext';

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
        <BalanceProvider><CurrencyProvider>{children}</CurrencyProvider></BalanceProvider>
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

  it('price-refresh select remains a disabled placeholder', () => {
    renderSettings();
    const allSelects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const disabled = allSelects.filter(s => s.disabled);
    expect(disabled.length).toBe(1);
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

    it('Clear Wallet button shows confirm dialog and calls clearOps on confirm', async () => {
      const { api } = await import('@/lib/api/client');
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.spyOn(window, 'alert').mockImplementation(() => {});
      renderSettings();
      const clearBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Limpar'));
      if (!clearBtn) throw new Error('Clear wallet button not found');
      fireEvent.click(clearBtn);
      await waitFor(() => expect(api.clearOps).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
    });

    it('Import file selection calls importData with the file and portfolio reload', async () => {
      const { importData } = await import('@/lib/dataHandlers');
      vi.spyOn(window, 'alert').mockImplementation(() => {});
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

    it('Import failure shows an alert including the error detail', async () => {
      const { importData } = await import('@/lib/dataHandlers');
      vi.mocked(importData).mockRejectedValueOnce(new Error('violates check constraint'));
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      renderSettings();
      const file = new File(['nonsense'], 'backup.json', { type: 'application/json' });
      const input = screen.getByLabelText('Importar') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });
      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
      expect(alertSpy.mock.calls[0][0]).toContain('violates check constraint');
    });

    it('Clear Wallet failure shows an alert', async () => {
      const { api } = await import('@/lib/api/client');
      vi.mocked(api.clearOps).mockRejectedValueOnce(new Error('fail'));
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      renderSettings();
      const clearBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Limpar'));
      if (!clearBtn) throw new Error('Clear wallet button not found');
      fireEvent.click(clearBtn);
      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    });

    it('Clear Wallet button does not call clearOps on cancel', async () => {
      const { api } = await import('@/lib/api/client');
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderSettings();
      const clearBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Limpar'));
      if (!clearBtn) throw new Error('Clear wallet button not found');
      fireEvent.click(clearBtn);
      expect(api.clearOps).not.toHaveBeenCalled();
    });
  });
});
