import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const isSsr = process.env.BUILD_SSR === '1'

export default isSsr
  ? defineConfig({
      plugins: [react()],
      build: {
        ssr: 'src/entry.server.tsx',
        outDir: 'functions',
        emptyOutDir: false,
        copyPublicDir: false,
        rollupOptions: {
          output: {
            format: 'esm',
            entryFileNames: 'ssr.js',
          },
        },
      },
      ssr: {
        target: 'webworker',
        noExternal: true,
      },
    })
  : defineConfig(({ mode }) => {
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
