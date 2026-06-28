import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/context/LocaleContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { BalanceProvider } from '@/context/BalanceContext';
import SettingsPage from './settings';

vi.mock('@/lib/api/client', () => ({
  api: {
    exportBackup: vi.fn().mockResolvedValue({ version: 1, exportedAt: '', ops: [], exitPrices: {} }),
    clearOps: vi.fn().mockResolvedValue({ deleted: 0 }),
    importBackup: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/dataHandlers', () => ({
  exportData: vi.fn().mockResolvedValue(undefined),
  importData: vi.fn().mockResolvedValue(undefined),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <BalanceProvider>{children}</BalanceProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

function renderSettings() {
  return render(<Wrapper><SettingsPage /></Wrapper>);
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.clearAllMocks();
  });
  afterEach(() => {
    localStorage.clear();
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

  it('theme select has an associated label', () => {
    renderSettings();
    expect(screen.getByLabelText(/tema/i)).toBeTruthy();
  });

  it('changing language select persists to localStorage', () => {
    renderSettings();
    const langSelect = screen.getByLabelText(/idioma/i) as HTMLSelectElement;
    fireEvent.change(langSelect, { target: { value: 'en-US' } });
    expect(localStorage.getItem('crypto-assist:locale')).toBe('en-US');
  });

  it('changing theme select to light sets data-theme="light"', () => {
    renderSettings();
    const themeSelect = screen.getByLabelText(/tema/i) as HTMLSelectElement;
    fireEvent.change(themeSelect, { target: { value: 'light' } });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('crypto-assist:theme')).toBe('light');
  });

  it('theme select defaults to system', () => {
    renderSettings();
    const themeSelect = screen.getByLabelText(/tema/i) as HTMLSelectElement;
    expect(themeSelect.value).toBe('system');
  });

  it('currency and price-refresh selects are disabled placeholders', () => {
    renderSettings();
    const allSelects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const disabled = allSelects.filter(s => s.disabled);
    expect(disabled.length).toBeGreaterThanOrEqual(2);
  });

  describe('US2 — Hide balances', () => {
    it('hide-balances checkbox starts unchecked', () => {
      renderSettings();
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('toggling hide-balances checkbox updates localStorage', () => {
      renderSettings();
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(localStorage.getItem('crypto-assist:balance-hidden')).toBe('true');
    });

    it('hide-balances checkbox reflects stored value', () => {
      localStorage.setItem('crypto-assist:balance-hidden', 'true');
      renderSettings();
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
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
