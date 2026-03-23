'use client'

import { useMemo, useState } from 'react'

type GenericRow = Record<string, unknown>
type ActionState = (formData: FormData) => void | Promise<void>

function asText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function WhitelistedEmailsSection({ rows, createEmail, deleteEmail }: { rows: GenericRow[]; createEmail: ActionState; deleteEmail: ActionState }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => asText(row.email_address || row.email).toLowerCase().includes(q))
  }, [rows, query])

  return (
    <section className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" id="quick-create">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Whitelisted Emails</h2>
            <p className="text-sm text-slate-500">Direct invite allowlist controls.</p>
          </div>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs" onChange={(e) => setQuery(e.target.value)} placeholder="Search email (hint: press /)" value={query} />
        </div>

        <form action={createEmail} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row">
          <input className="flex-1 rounded-md border border-slate-300 px-3 py-2" name="email_address" placeholder="person@example.org" required />
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" type="submit">Add Email</button>
        </form>
      </section>

      <section className="space-y-2">
        {filtered.map((row, idx) => {
          const id = asText(row.id)
          return (
            <article key={id || idx} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50">
              <div>
                <p className="text-sm font-semibold text-slate-900">{asText(row.email_address || row.email) || 'unknown email'}</p>
                <p className="text-xs text-slate-500">Created: {asText(row.created_datetime_utc) || '—'}</p>
              </div>
              <form action={deleteEmail} onSubmit={(e) => { if (!confirm('Delete whitelisted email?')) e.preventDefault() }}>
                <input name="id" type="hidden" value={id} />
                <button className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700" type="submit">Delete</button>
              </form>
            </article>
          )
        })}
      </section>
    </section>
  )
}
