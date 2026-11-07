import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'QR_'])

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/m": {
          target: process.env.QR_API_PROXY_TARGET ?? env.QR_API_PROXY_TARGET ?? "http://localhost:4000",
          changeOrigin: true,
        },
      },
    },
  }
})
