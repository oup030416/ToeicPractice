import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const DEFAULT_PAGES_BASE = '/ToeicPractice/'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base:
    mode === 'production'
      ? (process.env.VITE_BASE_PATH ?? DEFAULT_PAGES_BASE)
      : '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
}))
