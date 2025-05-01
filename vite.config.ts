import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
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