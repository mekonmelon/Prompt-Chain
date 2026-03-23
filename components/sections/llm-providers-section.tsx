'use client'

type GenericRow = Record<string, unknown>
type ActionState = (formData: FormData) => void | Promise<void>

function asText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function LlmProvidersSection({ rows, createProvider, updateProvider, deleteProvider }: { rows: GenericRow[]; createProvider: ActionState; updateProvider: ActionState; deleteProvider: ActionState }) {
  return (
    <section className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" id="quick-create">
        <h2 className="text-lg font-semibold text-slate-900">LLM Providers</h2>
        <p className="mb-4 text-sm text-slate-500">Provider configuration entries and operational flags.</p>

        <form action={createProvider} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
          <input className="rounded-md border border-slate-300 px-3 py-2" name="name" placeholder="provider name" required />
          <input className="rounded-md border border-slate-300 px-3 py-2" name="status" placeholder="status/config indicator" />
          <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><input defaultChecked name="is_active" type="checkbox" /> Active</label>
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 md:col-span-3" type="submit">Create Provider</button>
        </form>
      </section>

      <section className="space-y-2">
        {rows.map((row, idx) => {
          const id = asText(row.id)
          return (
            <article key={id || idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{asText(row.name || row.provider_name) || 'Unnamed provider'}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.is_active === false ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{row.is_active === false ? 'Inactive' : 'Active'}</span>
              </div>
              <p className="text-xs text-slate-500">Status: {asText(row.status || row.config_status || row.notes) || '—'}</p>

              <form action={updateProvider} className="mt-3 grid gap-2 md:grid-cols-3">
                <input name="id" type="hidden" value={id} />
                <input className="rounded-md border border-slate-300 px-3 py-2" defaultValue={asText(row.name || row.provider_name)} name="name" />
                <input className="rounded-md border border-slate-300 px-3 py-2" defaultValue={asText(row.status || row.config_status)} name="status" />
                <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><input defaultChecked={row.is_active !== false} name="is_active" type="checkbox" /> Active</label>
                <button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700" type="submit">Save</button>
              </form>
              <form action={deleteProvider} className="mt-2" onSubmit={(e) => { if (!confirm('Delete provider?')) e.preventDefault() }}>
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
