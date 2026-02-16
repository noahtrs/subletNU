# SubletNU Project Skills

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

SubletNU is a student-to-student sublet marketplace for Northeastern University students. It simplifies finding reliable sublets by allowing only student connections and displaying all relevant information (price, distance from campus, dates, amenities, etc.) in one place.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite 7
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend/Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth with email verification
- **Maps**: Google Maps JavaScript API + Geocoding API
- **Deployment**: Vercel
- **Email**: Resend (via Supabase Edge Functions)

## Development Commands

```bash
# Start development server (runs on port 3002, or next available)
npm run dev

# Start with Vercel serverless functions
npm run dev:vercel

# Start both Vite and Vercel dev servers concurrently
npm run dev:full

# Build for production
npm run build

# Build in development mode
npm run build:dev

# Run linter
npm run lint

# Preview production build
npm preview
```

## Environment Setup

Create a `.env` file in the root with:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Google Maps API Keys
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
VITE_GEOCODE_API_KEY=your-geocoding-api-key

# Cloudflare Turnstile (bot protection)
VITE_TURNSTILE_SITE_KEY=your-turnstile-site-key
```

## Architecture

### Context Providers (Nested in order)

The app uses a hierarchical context structure defined in `src/contexts/AppContext.tsx`:

1. **AuthProvider** - User authentication state, login/logout, email verification
2. **SubletProvider** - Sublet listings, CRUD operations, photo uploads
3. **MessageProvider** - Real-time messaging via Supabase Realtime
4. **FilterProvider** - Homepage filter state (price, distance, dates, etc.)

### Key Data Flow Patterns

**Sublet Creation/Editing:**
1. Photos uploaded to Supabase Storage (`sublet-photos` bucket)
2. Public URLs returned and stored in `photos` array (PostgreSQL)
3. Location geocoded via Google Geocoding API
4. Distance from NEU calculated and stored

**Image Handling:**
- **IMPORTANT**: HEIC files are NOT supported and will be rejected with instructions
- Only JPG, PNG, WebP, and other browser-compatible formats allowed
- Images stored in Supabase Storage with public URLs
- Maximum 5 photos per listing

**Real-time Updates:**
- Supabase Realtime subscriptions used for:
  - New sublet listings (HomePage auto-updates)
  - New messages (MessagesPage live updates)
  - Message read status

**Direct vs Context Fetching:**
- SubletDetailPage fetches directly from Supabase if listing not in context
- This allows deep linking to listings without loading all listings first
- Pattern: Check context first, fallback to direct fetch

### Database Schema (Supabase)

**Core Tables:**
- `profiles` - User profiles with email, notifications preferences
- `sublets` - Listing data (price, location, dates, photos URLs, amenities)
- `messages` - User-to-user messages
- `saved_listings` - User's saved/favorited listings

**Storage Buckets:**
- `sublet-photos` - Must be PUBLIC for images to display in browsers

### Route Structure

- `/` - HomePage (browse all listings, filters)
- `/create` - Create new sublet listing
- `/edit/:subletId` - Edit existing listing (owner only)
- `/sublet/:subletId` - Listing detail page
- `/messages` - Inbox view
- `/messages/:userId` - Conversation with specific user
- `/profile` - User profile and their listings
- `/saved-listings` - Saved/favorited listings
- `/auth` - Login/signup page
- `/confirm` - Email confirmation landing page
- `/debug-images` - Admin-only debug page (requires specific email)

### Supabase Edge Functions

Located in `supabase/functions/`:
- `verify-captcha` - Validates Cloudflare Turnstile tokens
- `send-message-notification` - Sends email when user receives message
- `delete-user` - Handles user account deletion

### Security Considerations

**Authentication:**
- Email verification required before posting listings
- Row Level Security (RLS) policies on all tables
- Cloudflare Turnstile CAPTCHA on signup

**Input Validation:**
- Frontend validation with react-hook-form + Zod
- Backend validation via Supabase RLS and database constraints

**File Uploads:**
- File type validation (images only)
- Size limits enforced
- HEIC format explicitly rejected (not browser-compatible)

**CORS:**
- Configured in `vite.config.ts` and Vercel settings
- Allows Supabase connections, Google Maps API

## Component Patterns

**Page Components** (`src/pages/`):
- Handle routing, data fetching, and page-level state
- Use context hooks: `useAuth()`, `useSublet()`, `useMessage()`, `useFilter()`
- Mobile-responsive with `useIsMobile()` hook

**shadcn/ui Components** (`src/components/ui/`):
- Pre-built, customizable Radix UI primitives
- Styled with Tailwind CSS
- Do not modify these directly; use composition

**Custom Components** (`src/components/`):
- `SubletCard` - Listing card with photo carousel, displays in grid or detail view
- `FilterBar` - Price, distance, date range, amenities filters
- `InteractiveMap` - Google Maps display for listing location
- `LocationAutocomplete` - Google Places autocomplete for addresses
- `AmenitiesSelector` - Multi-select amenities chips

## Common Patterns & Gotchas

### Google Maps Integration

Two separate API keys are used:
- `VITE_GOOGLE_MAPS_API_KEY` - For Maps JavaScript API (InteractiveMap component)
- `VITE_GEOCODE_API_KEY` - For Geocoding API (converting addresses to coordinates)

This separation allows different quota limits and restrictions.

### Photo Preview URLs

Use `URL.createObjectURL()` for previews, but **always revoke** when component unmounts or photo is removed:
```typescript
URL.revokeObjectURL(previewUrl);
```

### Distance Calculation

Distance from Northeastern University (42.3398, -71.0892) is calculated and stored in the database, not computed client-side. Update this if the address changes.

### Toast Notifications

Use the `useToast()` hook from `@/hooks/use-toast`:
- Success messages: default variant
- Errors: `variant: "destructive"`
- Long messages: set `duration: 8000` or higher

### State Management

- Global state via Context API (auth, sublets, messages, filters)
- Local component state for UI (modals, form inputs, loading states)
- React Query for caching (TanStack Query) - minimally used currently

## Deployment

**Vercel:**
- Auto-deploys from `main` branch
- Environment variables set in Vercel dashboard
- Rewrites configured in `vercel.json` for SPA routing

**Supabase:**
- Database migrations should be applied via Supabase dashboard
- Edge functions deployed via `supabase functions deploy <name>`

## Node Version

This project requires **Node.js 20.x** (specified in package.json engines). You may see warnings if using a different version.

## Code Guidelines

### Security - Credentials & Secrets

**NEVER hardcode credentials in frontend code:**
- ❌ No API keys, tokens, passwords, or secrets directly in TypeScript/JavaScript files
- ✅ All credentials must be in `.env` and accessed via `import.meta.env.VITE_*`
- ❌ No Supabase anon keys, service role keys, or connection strings in source code
- ❌ No Google Maps API keys hardcoded in components
- ✅ Use environment variables even for public keys (anon keys)
- **Exception**: Public keys may appear in build output, but never in source code

**Review checklist before committing:**
- Search codebase for patterns like `eyJ`, `sk_`, `pk_`, common key prefixes
- Ensure `.env` is in `.gitignore`
- No credentials in comments or console.logs
- No example/placeholder credentials that could be mistaken for real ones

### Code Style - Comments & Formatting

**Comments:**
- ❌ No unnecessary comments explaining obvious code
- ❌ No emoji in comments (🔥, ✨, 🎯, etc.)
- ❌ No commented-out code blocks (delete instead)
- ✅ Only add comments for non-obvious business logic or complex algorithms
- ✅ Use JSDoc for function documentation when necessary

**Console Logs:**
- ❌ No emoji in console.log statements
- ❌ Remove debug console.logs before committing (unless explicitly for debugging features)
- ✅ Use proper error logging for production errors

**Code Quality:**
- Write self-documenting code with clear variable/function names
- Keep functions focused and single-purpose
- Remove dead code rather than commenting it out

## Known Issues & Workarounds

### HEIC Image Format
- HEIC files are not supported by most browsers
- App explicitly rejects HEIC uploads with helpful error message
- Existing listings with HEIC images will not display properly
- Solution: Re-upload as JPG/PNG

### Vite Port Conflicts
- Default port 3002 may conflict with other services
- Vite will automatically try next available port (3003, 3004, etc.)
- Check console output for actual port

### Dev Server CSP
- Content Security Policy configured in `vite.config.ts`
- May need updates when adding new external services
- Includes rules for Supabase, Google Maps, Cloudflare Turnstile
