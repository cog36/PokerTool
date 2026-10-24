import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'Frontend',
  base: './',
  plugins: [react()],
  // Browser requests stay same-origin; only Vite talks to the local Python API.
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8000' } },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Keep the five auditable chart datasets out of the application-code chunk.
        manualChunks(id) {
          const chart = id.match(/charts\/MTT_(5|10|20|40|100)_GTO\.json$/);
          if (chart) return `preflop-${chart[1]}bb`;
        },
      },
      input: {
        index: resolve(__dirname, 'Frontend/index.html'),
        doc: resolve(__dirname, 'Frontend/doc.html'),
      },
    },
  },
});

