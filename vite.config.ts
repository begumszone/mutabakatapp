import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site from /<repo>/, so assets have to be asked
  // for relative to that. A relative base works both there and when the dist
  // folder is opened straight off disk.
  base: './',
});
