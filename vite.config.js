import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-is'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-is', 'react-router-dom'],
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
})