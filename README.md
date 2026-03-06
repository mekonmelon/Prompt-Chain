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

- Every app route is protected.
- Unauthenticated users are redirected to `/login`.
- Authenticated users must have `profiles.is_superadmin = true`.
- Non-superadmins are redirected to `/unauthorized`.

## 5) Dashboard sections

The home dashboard contains a statistics overview and three management sections:

- **Statistics**: total users, total images, average captions per image, and top 5 upvoted captions from `caption_votes`.
- **Users**: Read-only table of all rows from `profiles`.
- **Images**: View all images, create image rows, edit `description`, and delete rows from `images`.
- **Captions**: Read-only list of all rows from `captions`.

## 6) SQL to grant superadmin for testing

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

## 7) Vercel deployment protection

To disable Vercel Deployment Protection for testing:

1. Open your Vercel project.
2. Go to **Settings → Deployment Protection**.
3. Disable protection for the environment you're testing (usually Preview).

## 8) Styling

- UI uses Tailwind utility classes (loaded via Tailwind Play CDN in `app/layout.tsx`) to render the dashboard cards, ranking list, and table layouts.


## 9) OAuth button troubleshooting

If the **Continue with Google** button does not redirect:

1. Confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in your environment (local + Vercel).
2. In Supabase Auth → URL Configuration, ensure Site URL is your app URL.
3. Add callback URLs including:
   - `http://localhost:3000/auth/callback`
   - `https://<your-domain>/auth/callback`
4. In Supabase Auth → Providers → Google, ensure Google provider is enabled and credentials are valid.
