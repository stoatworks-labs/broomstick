/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  build: { outDir: 'dist', sourcemap: false },
  test: {
    // The game's rules are pure, so the tests need no DOM and no canvas.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
