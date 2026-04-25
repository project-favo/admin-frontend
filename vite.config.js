import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Local dev: VITE_API_BASE_URL boş → tarayıcı /api/* çağırır; Vite proxy hedefi .env içindeki VITE_DEV_PROXY_TARGET (varsayılan 127.0.0.1:8080).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target =
    env.VITE_DEV_PROXY_TARGET?.trim() || 'http://127.0.0.1:8080'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
        },
      },
    },
  }
})
