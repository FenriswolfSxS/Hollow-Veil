# Hollow Veil FC

A from-scratch, Cloudflare-ready FFXIV Free Company website for **hollowveilfc.com**.

## Included
- Untouched entrance artwork as the full landing page
- Atmospheric responsive home page and shrine navigation
- Lodestone-backed roster endpoint with D1 caching
- Functional month calendar and detailed event creation
- Discord OAuth login
- Private Discord invite: returned only to approved member roles
- D1 migrations and Cloudflare Pages Functions

## Setup
1. `npm install`
2. Create a D1 database: `npx wrangler d1 create hollow-veil-db`
3. Put the returned database ID in `wrangler.toml`.
4. Copy `.dev.vars.example` to `.dev.vars` and fill in Discord credentials and a long session secret.
5. In the Discord Developer Portal, add these redirects:
   - Local: `http://localhost:8788/api/auth/callback`
   - Production: `https://hollowveilfc.com/api/auth/callback`
6. Apply schema locally: `npm run db:migrate:local`
7. Build: `npm run build`
8. Run the Cloudflare local environment: `npm run cf:dev`

## Production
- Connect the GitHub repository to Cloudflare Pages.
- Build command: `npm run build`
- Build output: `dist`
- Bind the D1 database as `DB`.
- Add encrypted secrets: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`, `DISCORD_INVITE_URL`.
- Add variables: `SITE_URL=https://hollowveilfc.com` and the Lodestone roster URL.
- Apply remote migrations: `npm run db:migrate:remote`.

## First administrator
After signing in once, use D1 Console:
```sql
UPDATE users SET role='owner' WHERE discord_id='YOUR_DISCORD_USER_ID';
```
New logins default to `pending`. Only `member`, `host`, `officer`, `admin`, and `owner` can reveal the private Discord invitation or create events. Admins can approve accounts through `/api/admin/members` (an admin UI can be added in the next content pass).

## Important roster note
The Lodestone member list has no official public roster API for this use case, so the server-side parser is cached and isolated. If Lodestone changes its HTML, update only `functions/api/roster.ts`; the rest of the site remains operational.
