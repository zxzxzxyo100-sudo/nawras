import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// staging.nawras-ly.com → ينشر من فرع staging إلى /public_html/staging
// base: '/'  لأن السابدومين يخدم من جذر المجلد مباشرة
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  define: {
    __STAGING__: true,
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
