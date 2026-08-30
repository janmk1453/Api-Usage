import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ApiUsageStat',
      fileName: () => 'index.js',
      formats: ['es'],
    },
    outDir: '.',
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: (info) => {
          if (info.name && info.name.endsWith('.css')) return 'style.css';
          return info.name || 'asset';
        },
      },
    },
    target: 'es2020',
    minify: false,
  },
  esbuild: {
    target: 'es2020',
  },
});
