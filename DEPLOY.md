# RK Studio v149

Netlify:
- Build command: leave blank
- Publish directory: .
- No frontend environment variables required for this static deploy.

The browser uses the Supabase project URL + publishable key. Supabase publishable
keys are intended for client-side use; access is controlled by Auth and RLS.
Never publish a Supabase secret/service-role key.

The existing `rk-admin-users` Supabase Edge Function remains deployed in Supabase
and is not a Netlify Function.

After deploy: login, Settings → Cloud Primary, then test Customers, Invoice,
Payment screenshot, and Add User.
