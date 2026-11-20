import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import manifest from './extension/manifest'

export default defineConfig({
  // manifest.ts exports `as const`, so host_permissions is a readonly tuple and
  // cannot be assigned to the plugin's ManifestV3Export (mutable string[]).
  // Type-only cast at the call site: the manifest object itself is untouched.
  plugins: [react(), crx({ manifest: manifest as unknown as Parameters<typeof crx>[0]['manifest'] })],
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
