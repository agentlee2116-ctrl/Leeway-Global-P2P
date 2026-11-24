import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // UI assets are referenced by relative URL; copy them into dist/src/assets
    // so GitHub Pages /app/ and native shells resolve them without a bundler.
    {
      name: 'copy-unbundled-src-assets',
      apply: 'build',
      closeBundle() {
        const distDir = path.resolve(process.cwd(), 'dist');
        const srcAssets = path.resolve(process.cwd(), 'src/assets');
        const distAssets = path.join(distDir, 'src/assets');
        if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
          fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
        }
      },
    },
  ],
  base: './',
  build: { outDir: 'dist', sourcemap: true, target: 'es2022' },
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
});
