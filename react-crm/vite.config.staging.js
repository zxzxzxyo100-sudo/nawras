import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ── إعدادات بناء البيئة التجريبية ──────────────────────────────────
// staging.nawras-ly.com → يخدم من جذر فرع staging مباشرة
// لذلك outDir = '../' حتى يكون index.html في الجذر
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
