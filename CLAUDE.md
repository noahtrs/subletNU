# SubletNU

Sublet marketplace for Northeastern students (subletnu.com). Users sign up with a `@northeastern.edu` email, post listings with photos, filter/save listings, and message each other.

## Stack

- Vite + React 18 + TypeScript, Tailwind, shadcn/ui (`src/components/ui/` is generated — don't hand-edit unless needed)
- Supabase: Postgres, Auth, Storage (`sublet-photos` bucket), Realtime, Edge Functions (project ref `vojxqyfkkkdxnbevnqmi`)
- Vercel hosting; `vercel.json` rewrites all routes to `index.html` (there are currently no `api/` serverless functions)
- Google Maps (Places autocomplete, Distance Matrix, Geocoding), Cloudflare Turnstile captcha, Resend for email
- Originally scaffolded with Lovable (`lovable-tagger`, `gptengineer.js` script tag in `index.html` must stay)

## Commands

```sh
npm run dev        # Vite on :3002 (proxies /api to :3001)
npm run dev:full   # vercel dev on :3001 + vite on :3002, only needed if api/ functions are added
npm run build
npm run lint       # has many pre-existing errors (mostly no-explicit-any); don't treat a non-zero exit as new breakage
npx tsc -p tsconfig.app.json --noEmit
```

There is no test suite. Verify changes with `tsc`, `npm run build`, and by running the app.

## Env vars

Client (`VITE_*`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`; `client.ts` falls back to the old `VITE_SUPABASE_ANON_KEY` name and warns if the key is a legacy `eyJ...` JWT), `GOOGLE_MAPS_API_KEY`, `GEOCODE_API_KEY`, `CAPTCHA_SITE_KEY`.
Edge functions: `RESEND_API_KEY`, `CAPTCHA_SECRET_KEY`, plus the platform-injected `SUPABASE_URL` and `SUPABASE_SECRET_KEYS` (JSON dict; `_shared/supabase-admin.ts` uses its `default` key, falling back to the legacy `SUPABASE_SERVICE_ROLE_KEY`). Don't read `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` in new code: they hold the legacy JWT keys Supabase is retiring at the end of 2026.
Admin scripts (`scripts/`): `SUPABASE_SECRET_KEY` (`sb_secret_...`), never `VITE_`-prefixed.

## Architecture

- `src/contexts/AppContext.tsx` nests providers: Auth → Sublet → Message → Filter. Order matters (each uses the one above).
- Email confirmation: the Supabase "Confirm signup" template links to `{{ .SiteURL }}/confirm?token_hash={{ .TokenHash }}&type=email`; `ConfirmPage` calls `supabase.auth.verifyOtp`, which also logs the user in. Never confirm users server-side from an email address alone.
- `AuthContext`: Supabase session; `isLoadingAuth` is true until the stored session is restored. Protected pages must wait for it before redirecting to `/auth`, or a hard refresh bounces logged-in users.
- `SubletContext`: loads all sublets and refetches on any realtime change to `sublets`. Each refetch creates new object identities, so don't key effects on a `sublet` object if that would reset user input (see `EditSubletPage`'s `hasInitializedForm`).
- `MessageContext`: messages for the current user; realtime subscription only covers rows where the user is the receiver, so `sendMessage` appends the sender's own message locally. Context callbacks used as effect deps must be `useCallback`-stable. Contact names are loaded from `profiles` in `MessagesPage`, not the context.
- `FilterContext`: client-side filtering of `sublets` (defaults: max $3000, max 5 mi).
- `useSavedListings` is a hook, not a context — each caller has its own state.
- DB rows are snake_case; app types in `src/types/index.ts` are camelCase. Row→`Sublet` mapping is duplicated in SubletContext, SubletDetailPage, ProfilePage, useSavedListings — update all of them when adding a column.
- Generated DB types: `src/integrations/supabase/types.ts` (`src/types/database.types.ts` is an older unused copy).
- `CreateSubletPage` inserts into `sublets` directly (not via `addSublet`) and calls `send-new-listing-notification`, which is not in this repo.
- Captcha only runs when `import.meta.env.MODE !== 'development'`.
- CSP lives in two places: `index.html` meta tag (prod) and `vite.config.ts` server headers (dev). New external origins must be added to both.

## Edge functions (`supabase/functions/`)

Deployed separately with the Supabase CLI; changing files here does nothing until deployed. All three have `verify_jwt = false` in `supabase/config.toml`: the platform JWT gate rejects publishable keys (not JWTs), so functions authenticate callers themselves. Call them with `supabase.functions.invoke` (it sends the key in the `apikey` header; a bare `Authorization: Bearer <publishable key>` is rejected).
- `_shared/supabase-admin.ts` — `createAdminClient()` (secret key) and `getCallerUser(admin, req)`, which validates the caller's session token with Supabase Auth (`auth.getUser`, works for HS256 and asymmetric signing keys). `@supabase/server`'s `withSupabase` would need the project on asymmetric JWT signing keys; it rejects HS256 tokens.
- `verify-captcha` — Turnstile siteverify. Public (called before signup).
- `send-message-notification` — emails the receiver; requires the caller to be the message sender.
- `delete-user` — deletes the caller's sublets, messages, profile, and auth user.

## Known issues

- The `@northeastern.edu` restriction and the signup captcha check are client-side only; anyone calling Supabase Auth directly with the anon key can bypass them. Enforce server-side (Supabase Auth captcha setting and/or a before-user-created hook).
- Date columns are written with `toISOString()` and read with `new Date(str)`; if the columns are `date` (not `timestamptz`) displayed dates can be off by one in US timezones.
