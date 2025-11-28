import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['pdfjs-dist'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    // Eliminar console.logs y debugger solo en builds de producción
    esbuildOptions: {
      drop: ['console', 'debugger'],
    },
  },
  // No eliminar console.logs en desarrollo para permitir debugging
});
