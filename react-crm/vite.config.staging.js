import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// staging.nawras-ly.com → ينشر من فرع staging إلى /public_html/staging
// base: '/'  لأن السابدومين يخدم من جذر المجلد مباشرة
const buildStamp = new Date().toISOString().slice(0, 19).replace('T', ' ')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  define: {
    __STAGING__: true,
    /** يُعرَض في الشريط الجانبي للتأكد أن المتصفح يحمّل آخر بناء بعد الرفع */
    __BUILD_ID__: JSON.stringify(buildStamp),
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
