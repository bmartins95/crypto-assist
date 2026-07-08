import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportData, importData } from './dataHandlers';

vi.mock('./api/client', () => ({
  api: {
    exportBackup: vi.fn(),
    importBackup: vi.fn(),
  },
}));

const BACKUP = {
  version: 1,
  exportedAt: '2026-07-08T00:00:00.000Z',
  ops: [],
  exitPrices: {},
};

describe('exportData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('triggers a JSON file download with the exported backup content', async () => {
    const { api } = await import('./api/client');
    vi.mocked(api.exportBackup).mockResolvedValue(BACKUP);

    const clickSpy = vi.fn();
    const fakeAnchor = { click: clickSpy, href: '', download: '' } as unknown as HTMLAnchorElement;
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(fakeAnchor);

    await exportData();

    expect(api.exportBackup).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createElementSpy.mockRestore();
  });
});

describe('importData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function fileFor(content: string): File {
    return new File([content], 'backup.json', { type: 'application/json' });
  }

  it('imports a valid backup and runs the success callback', async () => {
    const { api } = await import('./api/client');
    vi.mocked(api.importBackup).mockResolvedValue(undefined);
    const onSuccess = vi.fn().mockResolvedValue(undefined);

    await importData(fileFor(JSON.stringify(BACKUP)), onSuccess);

    expect(api.importBackup).toHaveBeenCalledWith(BACKUP);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('imports a valid backup without a success callback', async () => {
    const { api } = await import('./api/client');
    vi.mocked(api.importBackup).mockResolvedValue(undefined);

    await importData(fileFor(JSON.stringify(BACKUP)));

    expect(api.importBackup).toHaveBeenCalledWith(BACKUP);
  });

  it('rejects a payload missing the ops array without calling the API', async () => {
    const { api } = await import('./api/client');

    await expect(importData(fileFor(JSON.stringify({ version: 1 })))).rejects.toThrow(
      'invalid-format'
    );
    expect(api.importBackup).not.toHaveBeenCalled();
  });

  it('rejects a file that is not valid JSON without calling the API', async () => {
    const { api } = await import('./api/client');

    await expect(importData(fileFor('not json'))).rejects.toThrow();
    expect(api.importBackup).not.toHaveBeenCalled();
  });
});
