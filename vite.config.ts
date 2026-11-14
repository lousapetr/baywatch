import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  root: 'src/web',
  base: './',
  plugins: [preact()],
  build: {
    outDir: '../../dist/site',
    emptyOutDir: true,
  },
  test: {
    root: '.',
    include: ['src/**/*.test.ts'],
  },
});
