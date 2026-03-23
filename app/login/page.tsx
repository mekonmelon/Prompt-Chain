import { LoginButton } from '@/components/login-button'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.18),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 px-8 py-10 text-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(168,85,247,0.28),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.2),_transparent_24%)]" />
            <div className="relative">
              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-violet-200 backdrop-blur">
                The Humor Project
              </div>

              <h1 className="mt-6 max-w-3xl text-5xl font-black tracking-tight text-white sm:text-6xl">
                Admin login,
                <br />
                but make it
                <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-sky-300 bg-clip-text text-transparent">
                  {' '}
                  slightly unhinged
                </span>
                .
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Welcome to the behind-the-scenes control room where captions are judged, dashboards are
                polished, and chaos is kept to a professionally acceptable level.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-sm font-semibold text-white">Step 1</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Sign in with Google like the responsible internet citizen you are.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-sm font-semibold text-white">Step 2</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Enter the admin panel and inspect the comedy pipeline with great power.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-sm font-semibold text-white">Step 3</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Use that power exclusively for spreadsheets, steps, and tasteful mischief.</p>
                </div>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-200">
                  Google OAuth
                </span>
                <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sky-200">
                  Supabase
                </span>
                <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-violet-200">
                  Protected Admin Access
                </span>
              </div>
            </div>
          </section>

          <aside className="rounded-[2rem] border border-slate-200 bg-white/85 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.10)] backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-600">Admin Access</p>

            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Enter the control panel
            </h2>

            <p className="mt-4 text-base leading-7 text-slate-600">
              Sign in with Google to access the protected admin workspace. Access is granted only to users with{' '}
              <code className="rounded-lg bg-slate-100 px-2 py-1 text-sm text-slate-800">
                profiles.is_superadmin = true
              </code>
              .
            </p>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
              <LoginButton />
            </div>

            <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
              <p className="font-semibold">If the button acts dramatically but does not redirect:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5 leading-6 text-amber-900">
                <li>Enable the Google provider in Supabase Auth settings.</li>
                <li>
                  Set your Supabase Site URL and add the callback URL:{' '}
                  <code className="rounded bg-amber-100 px-2 py-1 text-xs">/auth/callback</code>
                </li>
                <li>Verify your Supabase URL and anon key are set in Vercel environment variables.</li>
              </ul>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Today’s official admin mood</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                “Let’s log in, fix nothing that isn’t broken, and pretend every chart was always this clean.”
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
