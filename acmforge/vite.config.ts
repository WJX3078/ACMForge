import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/** Match a package inside node_modules regardless of path separator. */
const inPkg = (id: string, pkg: string) =>
  new RegExp(`node_modules[\\\\/]${pkg}[\\\\/]`).test(id)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // route chunks are code-split; keep the limit tight so regressions surface
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return

          // React core + router must land in one chunk (shared by everything)
          if (
            /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\\/]/.test(
              id,
            )
          ) {
            return 'react-vendor'
          }

          // NOTE: recharts is deliberately NOT forced into a manual chunk here.
          // Only the dashboard imports it, via a dynamic import, so Rollup's
          // natural splitting already isolates it in the lazy Charts chunk.
          // Naming it explicitly makes the entry chunk import a shared binding
          // from it, which drags ~380 kB into every route's critical path.

          if (inPkg(id, 'framer-motion') || inPkg(id, 'motion-dom') || inPkg(id, 'motion-utils')) {
            return 'motion'
          }
          if (/node_modules[\\/]@radix-ui[\\/]/.test(id)) return 'radix'
          if (inPkg(id, 'lucide-react')) return 'icons'
        },
      },
    },
  },
})
