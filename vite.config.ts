import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import manifest from './extension/manifest'

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: 'dist-extension',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})


