import { defineConfig } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const rootDir = dirname(fileURLToPath(import.meta.url));
const manifest = (() => {
  try { return JSON.parse(readFileSync('./manifest.json', 'utf-8')); } catch { return { version: '0.0.0' }; }
})();

export default defineConfig({
  define: {
    'process.env.NODE_ENV': '"production"',
    '__APP_VERSION__': JSON.stringify(manifest.version || '0.0.0'),
  },
  build: {
    lib: {
      entry: resolve(rootDir, 'src/index.ts'),
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
