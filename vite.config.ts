/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves the site from /<repo-name>/ — keep `base` in sync with the repo name.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/NASA-Space-Apps-Hackathon/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
