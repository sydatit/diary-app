import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// In dev, proxy /api to the backend so the browser sees a single origin (no CORS).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // A time zone with daylight-saving changes, so day maths that assumes 24h days fails here.
    env: { TZ: 'America/New_York' },
    restoreMocks: true,
  },
})
