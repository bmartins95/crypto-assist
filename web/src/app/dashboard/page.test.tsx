import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DashboardPage from './page';
import { api } from '@/lib/api/client';
import { LocaleProvider } from '@/context/LocaleContext';

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

function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

function stubFileReader(fileContent: string) {
  class MockFileReader {
    onload: ((ev: { target: { result: string } }) => void) | null = null;
    readAsText = vi.fn(() => {
      Promise.resolve().then(() =>
        this.onload?.({ target: { result: fileContent } })
      );
    });
  }
  vi.stubGlobal('FileReader', MockFileReader);
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('downloads a JSON file with the expected filename when Exportar is clicked', async () => {
    const anchors: HTMLAnchorElement[] = [];
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') anchors.push(el as HTMLAnchorElement);
      return el;
    });

    renderWithLocale(<DashboardPage />);
    fireEvent.click(screen.getByText('Exportar'));

    await waitFor(() => expect(api.exportBackup).toHaveBeenCalled());
    expect(URL.createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'application/json' }),
    );
    expect(anchors[0]?.download).toMatch(/^carteira-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('exports a valid blob even when there are no operations', async () => {
    renderWithLocale(<DashboardPage />);
    fireEvent.click(screen.getByText('Exportar'));
    await waitFor(() => expect(api.exportBackup).toHaveBeenCalled());
    expect(URL.createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'application/json' }),
    );
  });

  it('calls importBackup with parsed data when a valid JSON file is selected', async () => {
    const payload = JSON.stringify({ version: 1, exportedAt: '2026-01-01T00:00:00.000Z', ops: [] });
    stubFileReader(payload);

    renderWithLocale(<DashboardPage />);
    const file = new File([payload], 'backup.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(api.importBackup).toHaveBeenCalledWith(
      expect.objectContaining({ ops: [] })
    ));
  });

  it('shows an error alert and skips importBackup when the file has no ops array', async () => {
    const payload = JSON.stringify({ notOps: true });
    stubFileReader(payload);

    renderWithLocale(<DashboardPage />);
    const file = new File([payload], 'bad.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(window.alert).toHaveBeenCalled());
    expect(api.importBackup).not.toHaveBeenCalled();
  });

  it('renders header with Exportar and Importar but no Drive controls', async () => {
    renderWithLocale(<DashboardPage />);
    await waitFor(() =>
      expect(screen.queryByText('Carregando sua carteira...')).not.toBeInTheDocument()
    );

    expect(screen.getByText('Exportar')).toBeInTheDocument();
    expect(screen.getByText('Importar')).toBeInTheDocument();
    expect(screen.queryByText(/Drive/i)).not.toBeInTheDocument();
    expect(document.querySelector('[title*="Drive"]')).toBeNull();
  });
});
