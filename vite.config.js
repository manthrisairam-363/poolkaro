import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Every production build gets a unique id. The app compares its own id with
// /version.json when it opens or comes back to the foreground, and reloads
// itself when a newer build is live. This is what fixes iOS home-screen apps
// (and the Play Store wrapper) that keep running weeks-old code.
const BUILD_ID = String(Date.now())

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    {
      name: 'carpoolkaro-version-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ build: BUILD_ID, built_at: new Date().toISOString() }),
        })
      },
    },
  ],
})
