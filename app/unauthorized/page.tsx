export default function UnauthorizedPage() {
  return (
    <main className="mx-auto mt-16 w-[95%] max-w-2xl rounded-3xl border border-rose-200 bg-white p-8 shadow-lg dark:border-rose-900 dark:bg-slate-900">
      <p className="text-sm uppercase tracking-[0.2em] text-rose-500">Restricted Access</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">You are signed in, but not authorized for Prompt Chain Studio.</h1>
      <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
        This tool is limited to users whose profile is marked as a superadmin or matrix admin in <code>public.profiles</code>.
      </p>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Ask a course admin to update your profile if you should have access.</p>
    </main>
  )
}
