import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    conditions: ['browser'],
    // Under pnpm's non-flat node_modules, a dependency's own peer-resolved
    // react/react-dom (e.g. @likec4/diagram's, @likec4/icons') can end up
    // as a physically separate copy from this app's own, even when the
    // versions match - React's hook dispatcher is a per-module-instance
    // singleton, so two copies means "Invalid hook call". Force every
    // resolution to the one root copy.
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    exclude: ['@hpcc-js/wasm-graphviz'],
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 5000,
  },
  worker: {
    format: 'es',
  },
})
