import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// Nest services rely on TypeScript decorator metadata for dependency injection.
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.spec.ts'],
  },
});
