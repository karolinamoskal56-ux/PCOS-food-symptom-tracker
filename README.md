# Food, Symptom & Cycle Log

A personal daily tracker — food timing, energy, brain fog, migraines, sleep, the
2pm/5pm snack check-in, and an estimated cycle phase — built as a plain static
site (no build step) backed by Supabase for real persistence.

## Local structure

- `index.html`, `style.css`, `app.js` — the app
- `cycle.js` — cycle-phase estimation math (pure functions, no dependencies)
- `supabase-config.js` — your Supabase project URL + anon key (public values, safe to commit — real security is the Row Level Security policies below)
- `supabase/schema.sql` — run this once in the Supabase SQL Editor to create the tables
- `manifest.webmanifest`, `sw.js`, `icons/` — basic PWA support (installable, works offline for already-loaded data)

## One-time setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, paste and run `supabase/schema.sql`.
3. In Project Settings → API, copy the **Project URL** and **anon public key** into `supabase-config.js`.
4. In Authentication → Providers, make sure **Email** is enabled (it is by default) — sign-in uses a magic link, no password.
5. Deploy the folder as a static site (Netlify drag-and-drop, or connect a GitHub repo to Netlify/Vercel).
6. In Authentication → URL Configuration, add your deployed URL (e.g. `https://your-app.netlify.app`) to **Site URL** and **Redirect URLs**, so the magic-link email sends people back to the right place.

## Data export

Use the "Export JSON" / "Export CSV" buttons at the bottom of the app any time — this is your independent backup, not tied to Supabase or this app staying online.
