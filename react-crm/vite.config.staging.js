import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ── إعدادات بناء البيئة التجريبية ──────────────────────────────────
// المخرجات تذهب إلى مجلد /staging/ في جذر المشروع
// الرابط يكون: https://yourdomain.com/staging/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/staging/',
  define: {
    __STAGING__: true,
  },
  build: {
    outDir: '../staging',
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
