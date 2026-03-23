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

export function TermsSection({ rows, createTerm, updateTerm, deleteTerm }: { rows: GenericRow[]; createTerm: ActionState; updateTerm: ActionState; deleteTerm: ActionState }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => asText(row.term || row.content || row.value).toLowerCase().includes(q) || asText(row.type || row.category).toLowerCase().includes(q))
  }, [rows, query])

  return (
    <section className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" id="quick-create">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Terms Governance</h2>
            <p className="text-sm text-slate-500">Moderation and exclusion vocabulary controls.</p>
          </div>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs" onChange={(e) => setQuery(e.target.value)} placeholder="Search terms (hint: press /)" value={query} />
        </div>

        <form action={createTerm} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
          <input className="rounded-md border border-slate-300 px-3 py-2" name="term" placeholder="term text" required />
          <input className="rounded-md border border-slate-300 px-3 py-2" name="type" placeholder="type/category" />
          <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><input defaultChecked name="is_active" type="checkbox" /> Active</label>
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 md:col-span-3" type="submit">Create Term</button>
        </form>
      </section>

      <section className="space-y-2">
        {filtered.map((row, idx) => {
          const id = asText(row.id)
          return (
            <article key={id || idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{asText(row.term || row.content || row.value) || 'Unnamed term'}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.is_active === false ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{row.is_active === false ? 'Inactive' : 'Active'}</span>
              </div>
              <p className="text-xs text-slate-500">Category: {asText(row.type || row.category) || '—'}</p>
              <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Edit term</summary>
                <form action={updateTerm} className="mt-2 grid gap-2 md:grid-cols-3">
                  <input name="id" type="hidden" value={id} />
                  <input className="rounded-md border border-slate-300 px-3 py-2" defaultValue={asText(row.term || row.content || row.value)} name="term" />
                  <input className="rounded-md border border-slate-300 px-3 py-2" defaultValue={asText(row.type || row.category)} name="type" />
                  <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><input defaultChecked={row.is_active !== false} name="is_active" type="checkbox" /> Active</label>
                  <button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 md:col-span-2" type="submit">Save</button>
                </form>
                <form action={deleteTerm} className="mt-2" onSubmit={(e) => { if (!confirm('Delete term?')) e.preventDefault() }}>
                  <input name="id" type="hidden" value={id} />
                  <button className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700" type="submit">Delete</button>
                </form>
              </details>
            </article>
          )
        })}
      </section>
    </section>
  )
}
