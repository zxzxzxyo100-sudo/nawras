import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __STAGING__: false,
    __BUILD_ID__: JSON.stringify(''),
  },
  build: {
    outDir: '../',
    emptyOutDir: false,
  },
  server: {
    proxy: {
      '/api-php': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
})
