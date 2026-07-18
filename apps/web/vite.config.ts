/// <reference types="vitest/config" />
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Copy the vendored Stockfish WASM build (~7 MB) into public/engine/ so it is
// served in dev and emitted to dist on build — instead of committing the binary.
// public/engine/ is gitignored; delete it to pick up a stockfish version bump.
function copyStockfishEngine(): Plugin {
  const files = ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm'];
  const copy = () => {
    const require = createRequire(import.meta.url);
    const binDir = join(dirname(require.resolve('stockfish/package.json')), 'bin');
    const destDir = join(import.meta.dirname, 'public', 'engine');
    mkdirSync(destDir, { recursive: true });
    for (const f of files) {
      const dest = join(destDir, f);
      if (!existsSync(dest)) cpSync(join(binDir, f), dest);
    }
  };
  return {
    name: 'copy-stockfish-engine',
    // configResolved runs once at startup for BOTH dev and build, before the dev
    // server serves any request — so /engine/* exists on a fresh checkout (the
    // buildStart hook alone doesn't fire early enough in dev). buildStart is kept
    // as belt-and-suspenders for the build.
    configResolved: copy,
    buildStart: copy,
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The Supabase values live in the repo-root .env. Expose ONLY the two
  // client-safe ones to the bundle; the secret key / DB password never leak.
  const repoRoot = join(import.meta.dirname, '..', '..');
  const env = loadEnv(mode, repoRoot, '');
  return {
    envDir: repoRoot,
    define: {
      'import.meta.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL ?? ''),
      'import.meta.env.SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY ?? ''),
    },
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
      // Unit tests only; Playwright e2e specs live in e2e/ and run separately.
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
