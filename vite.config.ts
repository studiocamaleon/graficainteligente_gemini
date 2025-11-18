import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: [
        'buffer',
        'process',
        'util',
        'stream',
        'zlib',
        'events',
        'assert',
        'crypto',
        'path',
        'fs',
        'constants',
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: [
      '@react-pdf/renderer',
      '@react-pdf/primitives',
      '@react-pdf/layout',
      '@react-pdf/pdfkit',
      '@react-pdf/font',
      '@react-pdf/render',
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      stream: 'stream-browserify',
      zlib: 'browserify-zlib',
      util: 'util',
      assert: 'assert',
      process: 'process/browser',
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
