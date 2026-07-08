import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    coverage: {
      thresholds: {
        'src/lib/dataHandlers.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/lib/cognito/client.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@crypto-assist/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
