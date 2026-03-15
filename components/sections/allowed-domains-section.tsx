'use client'

type GenericRow = Record<string, unknown>
type ActionState = (formData: FormData) => void | Promise<void>

function asText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function AllowedDomainsSection({ rows, createDomain, toggleDomain, deleteDomain }: { rows: GenericRow[]; createDomain: ActionState; toggleDomain: ActionState; deleteDomain: ActionState }) {
  return (
    <section className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" id="quick-create">
        <h2 className="text-lg font-semibold text-slate-900">Allowed Domains</h2>
        <p className="mb-4 text-sm text-slate-500">Enterprise access control for signup domains.</p>
        <form action={createDomain} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row">
          <input className="flex-1 rounded-md border border-slate-300 px-3 py-2" name="domain" placeholder="example.org" required />
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" type="submit">Add Domain</button>
        </form>
      </section>

      <section className="space-y-2">
        {rows.map((row, idx) => {
          const id = asText(row.id)
          const active = row.is_active !== false
          return (
            <article key={id || idx} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="text-sm font-semibold text-slate-900">{asText(row.domain || row.domain_name) || 'unknown domain'}</p>
                <p className="text-xs text-slate-500">Created: {asText(row.created_datetime_utc) || '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{active ? 'Active' : 'Inactive'}</span>
                <form action={toggleDomain}><input name="id" type="hidden" value={id} /><input name="is_active" type="hidden" value={active ? 'false' : 'true'} /><button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700" type="submit">Toggle</button></form>
                <form action={deleteDomain} onSubmit={(e) => { if (!confirm('Delete domain?')) e.preventDefault() }}><input name="id" type="hidden" value={id} /><button className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700" type="submit">Delete</button></form>
              </div>
            </article>
          )
        })}
      </section>
    </section>
  )
}
