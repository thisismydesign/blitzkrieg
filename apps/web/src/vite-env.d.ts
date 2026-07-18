/// <reference types="vite/client" />

// Only these two Supabase values are exposed to the client bundle (see
// vite.config.ts `define`). The secret key / DB password never reach the browser.
interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
