/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 3,
        // Strip developer diagnostics from the shipped bundle.
        drop_console: true,
        drop_debugger: true,
      },
      mangle: {
        // Also shorten top-level/module-scope names, not just locals.
        toplevel: true,
      },
      format: {
        comments: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
