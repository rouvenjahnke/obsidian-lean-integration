import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: 'src/main.ts',
      external: ['obsidian'],
      output: {
        entryFileNames: 'main.js',
        format: 'cjs',
      },
    },
  },
  server: {
    port: 3000,
    hmr: {
      overlay: false,
    },
  },
});