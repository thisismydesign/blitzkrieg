/// <reference types="vitest/config" />
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Copy the vendored Stockfish WASM build (~7 MB) into public/engine/ so it is
// served in dev and emitted to dist on build — instead of committing the binary.
// public/engine/ is gitignored; delete it to pick up a stockfish version bump.
function copyStockfishEngine(): Plugin {
  const files = ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm'];
  return {
    name: 'copy-stockfish-engine',
    buildStart() {
      const require = createRequire(import.meta.url);
      const binDir = join(dirname(require.resolve('stockfish/package.json')), 'bin');
      const destDir = join(import.meta.dirname, 'public', 'engine');
      mkdirSync(destDir, { recursive: true });
      for (const f of files) {
        const dest = join(destDir, f);
        if (!existsSync(dest)) cpSync(join(binDir, f), dest);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), copyStockfishEngine()],
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
