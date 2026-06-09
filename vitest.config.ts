import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // The client has its own toolchain; keep server tests isolated.
    exclude: ['client/**', 'node_modules/**', 'dist/**'],
  },
});
