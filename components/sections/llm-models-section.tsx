'use client'

type GenericRow = Record<string, unknown>
type ActionState = (formData: FormData) => void | Promise<void>

function asText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function LlmModelsSection({ rows, updateModel }: { rows: GenericRow[]; updateModel: ActionState }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">LLM Models Registry</h2>
        <p className="text-sm text-slate-500">Infrastructure registry for model metadata and active/deprecated states.</p>
      </div>

      <div className="space-y-2">
        {rows.map((row, idx) => {
          const id = asText(row.id)
          const active = row.is_active !== false
          return (
            <article key={id || idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{asText(row.model_name || row.name) || 'Unnamed model'}</p>
                  <p className="text-xs text-slate-500">Provider: {asText(row.provider || row.provider_id) || '—'}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{active ? 'Active' : 'Deprecated'}</span>
              </div>
              <p className="line-clamp-2 text-xs text-slate-600">{asText(row.config || row.metadata || row.notes) || 'No config metadata field found.'}</p>

              <form action={updateModel} className="mt-3 grid gap-2 md:grid-cols-4">
                <input name="id" type="hidden" value={id} />
                <input className="rounded-md border border-slate-300 px-3 py-2" defaultValue={asText(row.model_name || row.name)} name="model_name" placeholder="model name" />
                <input className="rounded-md border border-slate-300 px-3 py-2" defaultValue={asText(row.provider || row.provider_id)} name="provider" placeholder="provider" />
                <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><input defaultChecked={active} name="is_active" type="checkbox" /> Active</label>
                <button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700" type="submit">Save</button>
              </form>
            </article>
          )
        })}
      </div>
    </section>
  )
}
