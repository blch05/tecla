import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    // lógica pura en node (rápido); los tests que tocan el DOM piden jsdom con @vitest-environment
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    css: false,
    restoreMocks: true,
    globals: true,
  },
});
