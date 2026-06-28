import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DashboardPage from './page';
import { api } from '@/lib/api/client';
import { LocaleProvider } from '@/context/LocaleContext';
import { BalanceProvider } from '@/context/BalanceContext';

vi.mock('@/lib/api/client', () => ({
  api: {
    getOps: vi.fn(async () => []),
    getExitPrices: vi.fn(async () => ({})),
    exportBackup: vi.fn(async () => ({
      version: 1,
      exportedAt: '2026-06-26T00:00:00.000Z',
      ops: [],
    })),
    importBackup: vi.fn(async () => undefined),
    getPrices: vi.fn(async () => ({})),
  },
}));

vi.mock('@/lib/dataHandlers', () => ({
  exportData: vi.fn(async () => undefined),
  importData: vi.fn(async () => undefined),
}));

vi.mock('@/lib/storage', () => ({
  storage: {
    getAvatars: vi.fn(() => ({})),
    setAvatars: vi.fn(),
  },
  getLegacyOps: vi.fn(() => []),
  getLegacyExitPrices: vi.fn(() => ({})),
  hasMigrationBeenDeclined: vi.fn(() => false),
  declineMigration: vi.fn(),
  clearLegacyData: vi.fn(),
}));

vi.mock('@/components/WalletTab', () => ({ default: () => null }));
vi.mock('@/components/ProfitTab', () => ({ default: () => null }));
vi.mock('@/components/HistoryTab', () => ({ default: () => null }));
vi.mock('@/lib/portfolio', () => ({ collectAssets: vi.fn(() => []) }));

function renderWithProviders(ui: React.ReactElement) {
  return render(<LocaleProvider><BalanceProvider>{ui}</BalanceProvider></LocaleProvider>);
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the dashboard title and tab navigation', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() =>
      expect(screen.queryByText('Carregando sua carteira...')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Carteira')).toBeInTheDocument();
    expect(screen.getByText('Lucro')).toBeInTheDocument();
    expect(screen.getByText('Histórico')).toBeInTheDocument();
  });

  it('does not render Drive controls', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() =>
      expect(screen.queryByText('Carregando sua carteira...')).not.toBeInTheDocument()
    );
    expect(screen.queryByText(/Drive/i)).not.toBeInTheDocument();
    expect(document.querySelector('[title*="Drive"]')).toBeNull();
  });

  it('calls importData when a valid JSON file is selected via the hidden input', async () => {
    const { importData } = await import('@/lib/dataHandlers');
    renderWithProviders(<DashboardPage />);
    const payload = JSON.stringify({ version: 1, ops: [] });
    const file = new File([payload], 'backup.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(importData).toHaveBeenCalledWith(file, expect.any(Function)));
  });
});
