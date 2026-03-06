# The Humor Project Admin Panel

Next.js admin panel connected to Supabase with Google OAuth and superadmin-only access.

## 1) Configure environment

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 2) Configure Supabase Auth (Google)

In Supabase Dashboard:

1. Go to **Authentication → Providers → Google**.
2. Enable Google provider and provide Google OAuth client credentials.
3. Add this redirect URL:

- `http://localhost:3000/auth/callback`
- Your production URL equivalent: `https://<your-domain>/auth/callback`

## 3) Run locally

```bash
npm install
npm run dev
```

## 4) Access rules

- Every route is protected by middleware.
- Unauthenticated users are redirected to `/login`.
- Authenticated users must have `profiles.is_superadmin = true`.
- Non-superadmins are redirected to `/unauthorized`.

## 5) SQL to grant superadmin for testing

Run in Supabase SQL Editor (replace with your email):

```sql
update profiles
set is_superadmin = true
where id = (
  select id
  from auth.users
  where email = 'you@example.com'
);
```

## 6) Vercel deployment protection

To disable Vercel Deployment Protection for testing:

1. Open your Vercel project.
2. Go to **Settings → Deployment Protection**.
3. Disable protection for the environment you're testing (usually Preview).

