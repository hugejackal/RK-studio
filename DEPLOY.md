# RK Studio v148 — Production deployment

## GitHub
Push this folder to the `RK-studio` repository. Do not commit `config.js` or any secret key.

## Netlify
Import the GitHub repository as an existing project.
Build command:
`node scripts/generate-config.mjs`
Publish directory:
`.`

Set these Netlify environment variables in the site's UI:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Do not place `SUPABASE_SECRET_KEY` / `SUPABASE_SECRET_KEYS` in the frontend build variables.

## Supabase
The browser uses the publishable key only. Keep RLS enabled on every exposed table.
The `rk-admin-users` Edge Function uses server-side secret keys for Auth Admin actions.

## Supabase Edge Function
Deploy:
`supabase/functions/rk-admin-users/index.ts`
as the existing `rk-admin-users` Edge Function.

## Verification
1. Netlify deploy succeeds.
2. Open the deployed site.
3. Login with the Supabase Admin account.
4. Settings should show Cloud Primary.
5. Test customer, invoice, payment screenshot, and Add User.
6. Verify the browser console has no missing-config error.
