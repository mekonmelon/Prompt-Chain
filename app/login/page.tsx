import { LoginButton } from '@/components/login-button'

export default function LoginPage() {
  return (
    <main className="mx-auto mt-16 w-[95%] max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
      <p className="text-sm uppercase tracking-[0.2em] text-violet-600">The Humor Project</p>
      <h1 className="mt-2 text-4xl font-bold text-slate-900">Admin Login</h1>
      <p className="mt-3 text-lg text-slate-600">
        Sign in with Google to access the protected admin panel. Access is granted only to users with
        <code className="mx-1 rounded bg-slate-100 px-2 py-1 text-sm">profiles.is_superadmin = true</code>.
      </p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <LoginButton />
      </div>

      <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">If clicking the button does not redirect:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Enable Google provider in Supabase Auth settings.</li>
          <li>Set your Supabase Site URL and add the callback URL: <code>/auth/callback</code>.</li>
          <li>Verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in Vercel env vars.</li>
        </ul>
      </div>
    </main>
  )
}
