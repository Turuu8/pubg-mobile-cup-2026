import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so `npm run build` output can also be opened from a
  // plain static host (or a subfolder) without rewriting URLs.
  base: './',
  server: { host: true, port: 5173 },
  build: { outDir: 'dist', sourcemap: false },
});
