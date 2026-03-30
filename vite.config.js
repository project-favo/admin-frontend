import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Local dev: leave VITE_API_BASE_URL empty — browser calls /api/* on the dev server, proxied to Spring Boot.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // 127.0.0.1: bazı Windows kurulumlarında localhost çözümlemesi sorun çıkarabiliyor
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})
