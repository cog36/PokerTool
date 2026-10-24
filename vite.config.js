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
      input: {
        index: resolve(__dirname, 'Frontend/index.html'),
        doc: resolve(__dirname, 'Frontend/doc.html'),
      },
    },
  },
});

