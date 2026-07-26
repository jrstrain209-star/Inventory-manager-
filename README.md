# Inventory Manager

Mobile-first inventory and service management for HVAC filters.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add the Inventory Manager Supabase project URL and publishable key.
4. Start the app with `npm run dev`.

## Required Vercel environment variables

Add both variables to Production, Preview, and Development:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The app also accepts the older `NEXT_PUBLIC_SUPABASE_ANON_KEY` name for
backward compatibility.

## Available pages

- `/` — dashboard
- `/stores` — stores and service worksheets
- `/inventory` — required, on-hand, and shortage totals by filter size
- `/routes` — route planning and route details
