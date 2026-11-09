/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
  readonly VITE_GEOCODE_API_KEY: string;
  readonly VITE_CAPTCHA_SITE_KEY: string;
  readonly VITE_CAPTCHA_SECRET_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** @deprecated Old name for VITE_SUPABASE_PUBLISHABLE_KEY; still read as a fallback. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
