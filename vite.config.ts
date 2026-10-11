import { defineConfig } from 'vitest/config';

// GitHub Pages serves the app from /<repo>/. The deploy workflow sets BASE_PATH;
// local dev and preview use the root.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
