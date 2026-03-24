import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-10 text-[var(--foreground)]">
      <div className="w-full max-w-2xl rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-400">Restricted access</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">You are signed in, but this studio is locked.</h1>
        <p className="mt-4 text-lg leading-8 text-[var(--muted-foreground)]">
          Prompt Chain Studio only allows profiles where either <code className="rounded bg-[var(--panel-muted)] px-2 py-1">is_superadmin = true</code> or{' '}
          <code className="rounded bg-[var(--panel-muted)] px-2 py-1">is_matrix_admin = true</code>.
        </p>
        <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">Ask an authorized administrator to update your row in public.profiles. Authenticated access alone is not enough.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white" href="/login">Back to login</Link>
          <Link className="rounded-full border border-[var(--panel-border)] bg-[var(--panel-muted)] px-5 py-2 text-sm font-semibold" href="/">Try again</Link>
        </div>
      </div>
    </main>
  )
}
