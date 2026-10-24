import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/ig/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/ig/api': 'http://127.0.0.1:3930',
      '/ig/public': 'http://127.0.0.1:3930',
    },
  },
})
