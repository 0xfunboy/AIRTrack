import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173 },
  build: {
    target: 'es2020',
    sourcemap: false,
    outDir: 'dist',
    emptyOutDir: true
  }
});
