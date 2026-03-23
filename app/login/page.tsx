import { LoginButton } from '@/components/login-button'

export default function LoginPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-100 px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col items-center justify-center">
        <p className="mb-8 text-center text-4xl font-black tracking-tight text-slate-900 sm:text-6xl">
          Humor Project Admin Panel
        </p>

        <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="flex justify-center">
            <div className="relative">
              <div className="absolute -right-6 top-0 max-w-xs rounded-3xl border-4 border-slate-900 bg-white px-6 py-4 text-lg font-bold leading-8 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.15)] sm:text-2xl">
                you don&apos;t <span className="italic">LOOK</span> like a super admin...
                <div className="absolute -bottom-5 left-10 h-8 w-8 rotate-45 border-b-4 border-r-4 border-slate-900 bg-white" />
              </div>

              <div className="relative mt-24 flex h-[420px] w-[320px] items-center justify-center rounded-[45%] border-4 border-slate-900 bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
                <div className="absolute top-16 h-20 w-40 rounded-full bg-slate-900/5 blur-2xl" />

                <div className="absolute left-10 top-32 h-20 w-20 rounded-full border-4 border-slate-900 bg-white">
                  <div className="eye-pupil absolute left-[28px] top-[16px] h-8 w-8 rounded-full bg-slate-900" />
                  <div className="absolute left-[38px] top-[24px] h-2.5 w-2.5 rounded-full bg-white" />
                </div>

                <div className="absolute right-10 top-32 h-20 w-20 rounded-full border-4 border-slate-900 bg-white">
                  <div className="eye-pupil absolute left-[28px] top-[16px] h-8 w-8 rounded-full bg-slate-900" />
                  <div className="absolute left-[38px] top-[24px] h-2.5 w-2.5 rounded-full bg-white" />
                </div>

                <div className="absolute top-[235px] h-5 w-5 rounded-full bg-slate-900" />

                <div className="absolute bottom-24 h-14 w-32 rounded-b-full border-b-4 border-slate-900" />

                <div className="absolute -bottom-8 left-1/2 h-10 w-44 -translate-x-1/2 rounded-full bg-slate-900/10 blur-xl" />
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border-2 border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-600">
              Restricted Access
            </p>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Prove it.
            </h1>

            <p className="mt-4 text-lg leading-8 text-slate-600">
              Sign in with Google to access the admin panel. This page is protected, mildly judgmental,
              and reserved for users with{' '}
              <code className="rounded-lg bg-slate-100 px-2 py-1 text-base text-slate-800">
                profiles.is_superadmin = true
              </code>
              .
            </p>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <LoginButton />
            </div>
          </section>
        </div>
      </div>

      <style>{`
        .eye-pupil {
          animation: lookUpDown 2.8s ease-in-out infinite;
        }

        @keyframes lookUpDown {
          0%, 100% {
            transform: translateY(-8px);
          }
          50% {
            transform: translateY(10px);
          }
        }
      `}</style>
    </main>
  )
}
