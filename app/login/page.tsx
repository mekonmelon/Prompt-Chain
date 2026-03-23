import { LoginButton } from '@/components/login-button'

export default function LoginPage() {
  return (
    <main className="mx-auto mt-16 w-[95%] max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm uppercase tracking-[0.2em] text-violet-600">The Humor Project</p>
      <h1 className="mt-2 text-4xl font-bold text-slate-900 dark:text-white">Prompt Chain Studio Login</h1>
      <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">
        Sign in with Google to access the protected Prompt Chain Studio. Access is granted only to users with
        <code className="mx-1 rounded bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800">profiles.is_superadmin = true</code>
        or
        <code className="mx-1 rounded bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800">profiles.is_matrix_admin = true</code>.
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
        <LoginButton />
      </div>

      <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">If the Google redirect does not start:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Enable the Google provider in Supabase Auth settings.</li>
          <li>Set the Supabase Site URL and callback URL to <code>/auth/callback</code>.</li>
          <li>Verify <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are present in Vercel.</li>
        </ul>
      </div>
    </main>
  )
}
