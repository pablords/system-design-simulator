import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@xyflow')) {
              return 'vendor-xyflow'
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide'
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-recharts'
            }
            if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
              return 'vendor-framer'
            }
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/') ||
              id.includes('/use-sync-external-store/')
            ) {
              return 'vendor-react'
            }
          }
        },
      },
    },
  },
})
